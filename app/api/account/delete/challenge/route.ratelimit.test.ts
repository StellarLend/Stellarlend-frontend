import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
vi.mock('server-only', () => ({}));
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

   it('allows a legitimate challenge after the challenge expires', async () => {
     vi.useFakeTimers();

     const token = signToken(USER);
     const CHALLENGE_TTL_MS = 5 * 60 * 1000;

     const res1 = await ChallengeGET(makeRequest(token));
     expect(res1.status).toBe(200);

     vi.advanceTimersByTime(CHALLENGE_TTL_MS + 1000);

     const res2 = await ChallengeGET(makeRequest(token));
     expect(res2.status).toBe(200);
   });

   it('counts each challenge request toward the rate limit even after prior challenges expire unused', async () => {
     vi.useFakeTimers();

     const token = signToken(USER);
     const CHALLENGE_TTL_MS = 5 * 60 * 1000;

     // Exhaust the burst limit with two challenge requests
     const res1 = await ChallengeGET(makeRequest(token));
     expect(res1.status).toBe(200);

     const res2 = await ChallengeGET(makeRequest(token));
     expect(res2.status).toBe(200);

     // A third request right away is correctly blocked
     const res3 = await ChallengeGET(makeRequest(token));
     expect(res3.status).toBe(429);

     // Let the issued challenges expire unused — they are never redeemed
     vi.advanceTimersByTime(CHALLENGE_TTL_MS + 1000);

     // Advance past the rate-limit window so the token bucket refills;
     // this refill is time-driven, not driven by challenge expiry state.
     vi.advanceTimersByTime(1000);

     // After expiry the rate limit still enforces the same budget.
     // Expired challenges did not release their consumed tokens, so
     // the same burst capacity applies to post-expiry requests.
     const res4 = await ChallengeGET(makeRequest(token));
     expect(res4.status).toBe(200);

     const res5 = await ChallengeGET(makeRequest(token));
     expect(res5.status).toBe(200);

     const res6 = await ChallengeGET(makeRequest(token));
     expect(res6.status).toBe(429);
   });
 });
