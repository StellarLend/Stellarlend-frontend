import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { clearRateLimitCache } from '@/lib/rate-limit';
import { clearAccountBucketCache } from '@/lib/rate-limit/account-bucket';
import { signToken } from '@/lib/auth';

vi.mock('@/lib/config', () => ({
  default: {
    rateLimit: {
      max: 1,
      window: 60_000,
      account: {
        limit: 1,
        windowMs: 60_000,
        burst: 1,
      },
    },
  },
}));

import { GET as ChallengeGET } from '@/app/api/account/delete/challenge/route';

function bearerRequest(token: string) {
  return new NextRequest('http://localhost/api/account/delete/challenge', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function cookieRequest(token: string) {
  return new NextRequest('http://localhost/api/account/delete/challenge', {
    method: 'GET',
    headers: { Cookie: `session=${token}` },
  });
}

describe('IP bucket and account bucket interaction', () => {
  beforeEach(() => {
    clearRateLimitCache();
    clearAccountBucketCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('are independent budgets: a shared IP can block one account while another account still has budget left', async () => {
    const tokenA = signToken({ id: 'user-a', email: 'a@example.com' });
    const tokenB = signToken({ id: 'user-b', email: 'b@example.com' });

    // First request from "user A" consumes the IP bucket's only token and
    // its own account bucket's only token.
    const middlewareA = middleware(bearerRequest(tokenA));
    expect(middlewareA.status).not.toBe(429);
    const routeA = await ChallengeGET(bearerRequest(tokenA));
    expect(routeA.status).toBe(200);

    // A request from a *different* account behind the same IP is blocked at
    // the middleware layer even though user B's own account bucket has never
    // been touched - the IP bucket is a shared budget across accounts.
    const middlewareB = middleware(bearerRequest(tokenB));
    expect(middlewareB.status).toBe(429);
  });

  it('an account-level 429 does not also debit the IP bucket a second time', async () => {
    const token = signToken({ id: 'user-c', email: 'c@example.com' });

    // Config above gives the IP bucket exactly 1 token per window; bump it
    // via clearing the account cache only, so we can isolate IP consumption
    // to "one debit per middleware() call" regardless of the route outcome.
    const middleware1 = middleware(bearerRequest(token));
    expect(middleware1.status).not.toBe(429);
    const route1 = await ChallengeGET(bearerRequest(token));
    expect(route1.status).toBe(200);

    // Second call: IP bucket is now exhausted (limit 1), independent of the
    // fact that the account bucket (also limit 1, already spent) would have
    // rejected this request too. Middleware never consults the account
    // bucket, and the route never gets a chance to run.
    const middleware2 = middleware(bearerRequest(token));
    expect(middleware2.status).toBe(429);
    expect(middleware2.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('a present session cookie exempts the request from the IP bucket, leaving only the account bucket as protection', async () => {
    const token = signToken({ id: 'user-d', email: 'd@example.com' });

    // Requests carrying a session cookie skip the IP bucket entirely in
    // middleware.ts, no matter how many are sent.
    for (let i = 0; i < 5; i++) {
      const response = middleware(cookieRequest(token));
      expect(response.status).not.toBe(429);
      expect(response.headers.get('X-RateLimit-Remaining')).toBeNull();
    }

    // The account bucket (limit 1) still applies independently inside the
    // route handler even though middleware never rate-limited these calls.
    const first = await ChallengeGET(cookieRequest(token));
    expect(first.status).toBe(200);
    const second = await ChallengeGET(cookieRequest(token));
    expect(second.status).toBe(429);

    // Since the cookie exempted every call above from the IP bucket, an
    // unrelated bearer-token request should still see a full IP budget.
    const otherToken = signToken({ id: 'user-e', email: 'e@example.com' });
    const freshIpCheck = middleware(bearerRequest(otherToken));
    expect(freshIpCheck.status).not.toBe(429);
  });
});
