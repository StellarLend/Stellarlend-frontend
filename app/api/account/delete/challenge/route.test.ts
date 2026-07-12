import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { clearAuditLog, getAuditEvents } from '@/lib/audit/events';
import { signToken } from '@/lib/auth';

import { GET } from './route';

const USER = { id: 'delete-challenge-user', email: 'delete@example.com' };

function makeRequest(token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new NextRequest('http://localhost/api/account/delete/challenge', {
    method: 'GET',
    headers,
  });
}

describe('GET /api/account/delete/challenge', () => {
  beforeEach(() => {
    clearAuditLog();
    vi.restoreAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns a signed challenge envelope for an authenticated user', async () => {
    const token = signToken(USER);
    const res = await GET(makeRequest(token));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.challenge).toBe('string');
    expect(json.challenge.length).toBeGreaterThan(10);
    expect(json.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(json.message).toContain('Sign this challenge');
  });

  it('emits auth.challenge.issued audit event on success', async () => {
    const token = signToken(USER);
    await GET(makeRequest(token));

    const events = getAuditEvents({ userId: USER.id, type: 'auth.challenge.issued' });
    expect(events).toHaveLength(1);
    expect(events[0].metadata.challengeType).toBe('account_deletion');
  });
});
