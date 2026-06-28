import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { clearAccountBucketCache } from '@/lib/rate-limit/account-bucket';
import { getAuditEvents, clearAuditLog } from '@/lib/audit/events';
import { signToken } from '@/lib/auth';

vi.mock('@/lib/config', () => ({
  default: {
    rateLimit: {
      account: {
        limit: 2,
        windowMs: 1000,
        burst: 2,
      },
    },
  },
}));

import { GET as ChallengeGET } from './route';

const USER = { id: 'rate-limit-user', email: 'rate-limit@example.com' };

function makeRequest(token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new NextRequest('http://localhost/api/account/delete/challenge', {
    method: 'GET',
    headers,
  });
}

describe('GET /api/account/delete/challenge rate limiting', () => {
  beforeEach(() => {
    clearAuditLog();
    clearAccountBucketCache();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 429 when challenge issuance exceeds account rate limit', async () => {
    const token = signToken(USER);

    await ChallengeGET(makeRequest(token));
    await ChallengeGET(makeRequest(token));

    const res = await ChallengeGET(makeRequest(token));

    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('Retry-After')).toBeTruthy();

    const json = await res.json();
    expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(json.error.retryAfter).toBeGreaterThan(0);
    expect(json.error.limit).toBe(2);
  });

  it('emits an audit event when the account deletion challenge route is rate limited', async () => {
    const token = signToken(USER);

    await ChallengeGET(makeRequest(token));
    await ChallengeGET(makeRequest(token));
    await ChallengeGET(makeRequest(token));

    const events = getAuditEvents({ userId: USER.id, type: 'auth.challenge.rate_limited' });
    expect(events.length).toBe(1);
    expect(events[0].metadata.challengeType).toBe('account_deletion');
    expect(events[0].metadata.retryAfter).toBeDefined();
  });

  it('allows a legitimate challenge after the window resets', async () => {
    vi.useFakeTimers();

    const token = signToken(USER);
    await ChallengeGET(makeRequest(token));
    await ChallengeGET(makeRequest(token));
    await ChallengeGET(makeRequest(token));

    const blocked = await ChallengeGET(makeRequest(token));
    expect(blocked.status).toBe(429);

    vi.advanceTimersByTime(1000);

    const res = await ChallengeGET(makeRequest(token));
    expect(res.status).toBe(200);
  });
});
