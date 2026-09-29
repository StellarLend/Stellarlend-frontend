import { vi, describe, expect, test, beforeEach, afterEach } from 'vitest';
vi.mock('server-only', () => ({}));

vi.mock('@/lib/account/delete', () => ({
  deleteAccount: vi.fn().mockResolvedValue({
    success: true,
    userId: 'challenge-test-user',
    anonymizedAt: new Date().toISOString(),
    notificationsRemoved: 0,
    cleanupJobsEnqueued: [],
    auditEventId: 'audit-1',
  }),
}));

import { NextRequest } from 'next/server';
import { GET as ChallengeGET } from './route';
import { DELETE as DeleteDELETE } from '@/app/api/account/delete/route';
import { signToken } from '@/lib/auth';
import {
  clearChallengeStore,
  verifyDeletionChallenge,
} from '@/lib/account/challenge-store';
import { clearAuditLog, getAuditEvents } from '@/lib/audit/events';
import { clearAccountBucketCache } from '@/lib/rate-limit/account-bucket';
import { deleteAccount } from '@/lib/account/delete';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const USER = { id: 'challenge-test-user', email: 'challenge@test.com' };
const ALT_USER = { id: 'other-user', email: 'other@test.com' };

function makeRequest(
  method: 'GET' | 'DELETE',
  url: string,
  opts: { token?: string; body?: unknown } = {},
): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  return new NextRequest(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function validToken(user = USER) {
  return signToken(user);
}

beforeEach(() => {
  clearChallengeStore();
  clearAuditLog();
  clearAccountBucketCache();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/account/delete/challenge — challenge issuance', () => {
  test('returns 401 when unauthenticated', async () => {
    const res = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge'),
    );
    expect(res.status).toBe(401);
  });

  test('returns 401 for invalid token', async () => {
    const res = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', {
        token: 'invalid-token',
      }),
    );
    expect(res.status).toBe(401);
  });

  test('returns a single-use challenge token bound to the user', async () => {
    const token = validToken();
    const res = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token }),
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.challenge).toBeDefined();
    expect(json.challenge.length).toBe(64);
    expect(json.expiresAt).toBeDefined();
    expect(json.message).toContain('Sign this challenge');

    const valid = verifyDeletionChallenge(json.challenge, USER.id);
    expect(valid).toBe(true);

    const replayed = verifyDeletionChallenge(json.challenge, USER.id);
    expect(replayed).toBe(false);
  });

  test('emits auth.challenge.issued audit event', async () => {
    const token = validToken();
    await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token }),
    );

    const events = getAuditEvents({ userId: USER.id, type: 'auth.challenge.issued' });
    expect(events.length).toBe(1);
    expect(events[0].metadata.challengeType).toBe('account_deletion');
  });
});

describe('DELETE /api/account/delete — challenge verification gate', () => {
  test('returns 401 when unauthenticated', async () => {
    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        body: { challenge: 'some-challenge' },
      }),
    );
    expect(res.status).toBe(401);
  });

  test('returns 400 when challenge is missing', async () => {
    const token = validToken();
    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', { token, body: {} }),
    );
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain('Missing deletion challenge');
  });

  test('returns 400 for malformed JSON body', async () => {
    const token = validToken();
    const req = new NextRequest('http://localhost/api/account/delete', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{ invalid json',
    });
    const res = await DeleteDELETE(req);
    expect(res.status).toBe(400);
  });

  test('returns 401 for an invalid (nonexistent) challenge', async () => {
    const token = validToken();
    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge: 'nonexistent-challenge' },
      }),
    );
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toContain('Invalid or expired');
  });

  test('returns 401 when challenge belongs to a different user', async () => {
    const altToken = validToken(ALT_USER);
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token: altToken }),
    );
    const { challenge } = await challengeRes.json();

    const token = validToken(USER);
    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      }),
    );
    expect(res.status).toBe(401);
  });

  test('accepts a valid challenge and proceeds to delete the account', async () => {
    const token = validToken();
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token }),
    );
    const { challenge } = await challengeRes.json();

    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      }),
    );
    expect(res.status).toBe(200);
    expect(deleteAccount).toHaveBeenCalledWith(USER.id);

    const json = await res.json();
    expect(json.message).toBe('Account deletion initiated');
  });

  test('rejects a replayed (already consumed) challenge', async () => {
    const token = validToken();
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token }),
    );
    const { challenge } = await challengeRes.json();

    const first = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      }),
    );
    expect(first.status).toBe(200);

    const second = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      }),
    );
    expect(second.status).toBe(401);

    const json = await second.json();
    expect(json.error).toContain('Invalid or expired');
  });

  test('rejects an expired challenge', async () => {
    vi.useFakeTimers();

    const token = validToken();
    const challengeRes = await ChallengeGET(
      makeRequest('GET', 'http://localhost/api/account/delete/challenge', { token }),
    );
    const { challenge } = await challengeRes.json();

    vi.advanceTimersByTime(CHALLENGE_TTL_MS + 1000);

    const res = await DeleteDELETE(
      makeRequest('DELETE', 'http://localhost/api/account/delete', {
        token,
        body: { challenge },
      }),
    );
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toContain('Invalid or expired');

    vi.useRealTimers();
  });
});
