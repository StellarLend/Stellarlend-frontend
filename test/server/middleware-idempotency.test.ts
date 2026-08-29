import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { clearRateLimitCache } from '@/lib/rate-limit';
import { IDEMPOTENCY_HEADER } from '@/lib/api/idempotency';

vi.mock('@/lib/config', () => ({
  default: {
    rateLimit: {
      max: 100,
      window: 60_000,
    },
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 })),
  clearRateLimitCache: vi.fn(),
}));

function request(method: string, path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { method, headers });
}

beforeEach(() => clearRateLimitCache());
afterEach(() => vi.restoreAllMocks());

describe('middleware idempotency enforcement', () => {
  it('rejects a POST to a mutating API route without an Idempotency-Key', () => {
    const res = middleware(request('POST', '/api/transactions'));
    expect(res.status).toBe(422);
  });

  it('passes a POST that carries a valid Idempotency-Key', () => {
    const res = middleware(request('POST', '/api/transactions', { [IDEMPOTENCY_HEADER]: 'key-abc' }));
    expect(res.status).not.toBe(422);
  });

  it('rejects PUT and PATCH to mutating routes without a key', () => {
    expect(middleware(request('PUT', '/api/positions/1')).status).toBe(422);
    expect(middleware(request('PATCH', '/api/positions/1')).status).toBe(422);
  });

  it('rejects DELETE to a mutating route without a key', () => {
    const res = middleware(request('DELETE', '/api/positions/1'));
    expect(res.status).toBe(422);
  });

  it('allows GET and HEAD requests without an Idempotency-Key', () => {
    expect(middleware(request('GET', '/api/transactions')).status).not.toBe(422);
    expect(middleware(request('HEAD', '/api/transactions')).status).not.toBe(422);
  });

  it('exempts POST to /api/auth/session from the key requirement', () => {
    const res = middleware(request('POST', '/api/auth/session'));
    expect(res.status).not.toBe(422);
  });

  it('exempts POST to /api/auth/logout from the key requirement', () => {
    const res = middleware(request('POST', '/api/auth/logout'));
    expect(res.status).not.toBe(422);
  });

  it('exempts /api/health from both rate-limiting and key enforcement', () => {
    const res = middleware(request('GET', '/api/health'));
    expect(res.status).not.toBe(422);
    expect(res.status).not.toBe(429);
  });

  it('includes request-id on the 422 rejection', () => {
    const res = middleware(request('POST', '/api/transactions'));
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('sets security headers on the 422 rejection', () => {
    const res = middleware(request('POST', '/api/transactions'));
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('Retry-After header is never negative when the window resets mid-response', () => {
    vi.mock('@/lib/rate-limit', () => ({
      rateLimit: vi.fn(() => ({
        success: false,
        limit: 1,
        remaining: 0,
        // reset in the past — simulates window rolling over between call and header write
        reset: Date.now() - 500,
      })),
      clearRateLimitCache: vi.fn(),
    }));

    const res = middleware(request('GET', '/api/transactions'));
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '-1', 10);
    // Must be 0 or absent (not negative)
    if (retryAfter !== null) {
      expect(retryAfter).toBeGreaterThanOrEqual(0);
    }
  });
});
