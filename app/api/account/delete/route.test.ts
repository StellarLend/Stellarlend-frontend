import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';
import * as challengeStore from '@/lib/account/challenge-store';
import * as deleteAccountModule from '@/lib/account/delete';

vi.mock('@/lib/account/delete', () => ({
  deleteAccount: vi.fn(),
}));

import { DELETE } from './route';

const USER = { id: 'delete-user', email: 'delete@example.com' };

function makeRequest(token?: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new NextRequest('http://localhost/api/account/delete', {
    method: 'DELETE',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('DELETE /api/account/delete', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 without auth', async () => {
    const res = await DELETE(makeRequest(undefined, { challenge: 'abc' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when challenge is missing', async () => {
    const token = signToken(USER);
    const res = await DELETE(makeRequest(token, {}));
    expect(res.status).toBe(400);
  });

  it('deletes account when challenge verifies', async () => {
    vi.spyOn(challengeStore, 'verifyDeletionChallenge').mockReturnValue(true);
    vi.mocked(deleteAccountModule.deleteAccount).mockResolvedValue({
      anonymizedAt: '2026-01-01T00:00:00.000Z',
      notificationsRemoved: 2,
      cleanupJobsEnqueued: ['purge-sessions'],
    });

    const token = signToken(USER);
    const res = await DELETE(makeRequest(token, { challenge: 'signed-challenge' }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toContain('deletion initiated');
    expect(json.cleanupJobsEnqueued).toBe(1);
  });
});
