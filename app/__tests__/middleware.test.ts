import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 })),
}));
vi.mock('@/lib/config', () => ({
  default: {
    rateLimit: { max: 100, window: 60000, account: { limit: 30, windowMs: 60000, burst: 60 } },
  },
}));
vi.mock('@/lib/request-id', () => ({
  getOrCreateRequestId: vi.fn(() => ({ requestId: 'test-request-id' })),
  REQUEST_ID_HEADER: 'x-request-id',
}));

import { rateLimit } from '@/lib/rate-limit';
const mockRateLimit = vi.mocked(rateLimit);

function req(path: string, options: { method?: string; headers?: Record<string, string>; withSession?: boolean } = {}) {
  const { method = 'GET', headers = {}, withSession } = options;
  const allHeaders: Record<string, string> = { ...headers };
  // NextRequest.cookies is backed by the Cookie header — set it directly
  if (withSession) allHeaders['cookie'] = 'session=test-session-token';
  return new NextRequest(`http://localhost${path}`, { method, headers: allHeaders });
}

describe('middleware', () => {
  beforeEach(() => {
    mockRateLimit.mockReturnValue({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 });
  });

  describe('non-API paths', () => {
    it('passes through and sets CSP header', async () => {
      const res = await middleware(req('/dashboard'));
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Security-Policy')).toMatch(/nonce-/);
    });

    it('passes through public routes', async () => {
      const res = await middleware(req('/'));
      expect(res.status).toBe(200);
    });
  });

  describe('idempotency enforcement', () => {
    it('rejects POST without Idempotency-Key with 422', async () => {
      const res = await middleware(req('/api/tx/submit', { method: 'POST' }));
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toBe('Missing Idempotency-Key');
    });

    it('rejects PUT without Idempotency-Key with 422', async () => {
      const res = await middleware(req('/api/positions/1', { method: 'PUT' }));
      expect(res.status).toBe(422);
    });

    it('rejects PATCH without Idempotency-Key with 422', async () => {
      const res = await middleware(req('/api/account/preferences', { method: 'PATCH' }));
      expect(res.status).toBe(422);
    });

    it('rejects DELETE without Idempotency-Key with 422', async () => {
      const res = await middleware(req('/api/data/1', { method: 'DELETE' }));
      expect(res.status).toBe(422);
    });

    it('allows POST with Idempotency-Key header', async () => {
      const res = await middleware(req('/api/tx/submit', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'key-123' },
      }));
      // Should not be 422 — rate limit check proceeds
      expect(res.status).not.toBe(422);
    });

    it('exempts GET from idempotency requirement', async () => {
      const res = await middleware(req('/api/positions'));
      expect(res.status).not.toBe(422);
    });

    it('exempts /api/auth/session DELETE from idempotency requirement', async () => {
      const res = await middleware(req('/api/auth/session', { method: 'DELETE' }));
      expect(res.status).not.toBe(422);
    });

    it('exempts /api/auth/logout POST from idempotency requirement', async () => {
      const res = await middleware(req('/api/auth/logout', { method: 'POST' }));
      expect(res.status).not.toBe(422);
    });

    it('exempts /api/health POST from idempotency requirement', async () => {
      const res = await middleware(req('/api/health', { method: 'POST' }));
      expect(res.status).not.toBe(422);
    });

    it('422 response includes x-request-id', async () => {
      const res = await middleware(req('/api/tx/submit', { method: 'POST' }));
      expect(res.status).toBe(422);
      expect(res.headers.get('x-request-id')).toBe('test-request-id');
    });
  });

  describe('rate limiting', () => {
    it('passes request when within rate limit', async () => {
      mockRateLimit.mockReturnValue({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 });
      const res = await middleware(req('/api/markets'));
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
    });

    it('returns 429 when rate limit exceeded', async () => {
      const reset = Date.now() + 30000;
      mockRateLimit.mockReturnValue({ success: false, limit: 100, remaining: 0, reset });
      const res = await middleware(req('/api/markets'));
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe('Too Many Requests');
    });

    it('Retry-After is never negative', async () => {
      // reset in the past simulates clock drift between rateLimit() and header write
      mockRateLimit.mockReturnValue({ success: false, limit: 100, remaining: 0, reset: Date.now() - 5000 });
      const res = await middleware(req('/api/markets'));
      expect(res.status).toBe(429);
      const retryAfter = parseInt(res.headers.get('Retry-After') || '-1', 10);
      expect(retryAfter).toBeGreaterThanOrEqual(0);
    });

    it('skips rate limiting for /api/health', async () => {
      mockRateLimit.mockReturnValue({ success: false, limit: 100, remaining: 0, reset: Date.now() + 1000 });
      const res = await middleware(req('/api/health'));
      // health check should not be rate limited even when rateLimit() returns failure
      expect(res.status).toBe(200);
      expect(mockRateLimit).not.toHaveBeenCalled();
    });

    it('skips rate limiting for authenticated requests', async () => {
      mockRateLimit.mockReturnValue({ success: false, limit: 100, remaining: 0, reset: Date.now() + 1000 });
      const res = await middleware(req('/api/positions', { withSession: true }));
      expect(res.status).toBe(200);
      expect(mockRateLimit).not.toHaveBeenCalled();
    });
  });

  describe('security headers', () => {
    it('sets Content-Security-Policy on API responses', async () => {
      const res = await middleware(req('/api/markets'));
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toMatch(/default-src 'self'/);
      expect(csp).toMatch(/nonce-/);
    });

    it('sets Referrer-Policy on API responses', async () => {
      const res = await middleware(req('/api/markets'));
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('sets Content-Security-Policy on non-API responses', async () => {
      const res = await middleware(req('/dashboard'));
      expect(res.headers.get('Content-Security-Policy')).toMatch(/nonce-/);
    });

    it('CSP nonce differs per request', async () => {
      const res1 = await middleware(req('/api/markets'));
      const res2 = await middleware(req('/api/markets'));
      const csp1 = res1.headers.get('Content-Security-Policy') ?? '';
      const csp2 = res2.headers.get('Content-Security-Policy') ?? '';
      const nonce1 = csp1.match(/nonce-([^;'"]+)/)?.[1];
      const nonce2 = csp2.match(/nonce-([^;'"]+)/)?.[1];
      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('state transition invariants', () => {
    it('idempotency check runs before rate limiting — no rateLimit call on 422', async () => {
      const res = await middleware(req('/api/tx/submit', { method: 'POST' }));
      expect(res.status).toBe(422);
      expect(mockRateLimit).not.toHaveBeenCalled();
    });

    it('rate limit response includes standard headers', async () => {
      const reset = Date.now() + 60000;
      mockRateLimit.mockReturnValue({ success: false, limit: 100, remaining: 0, reset });
      const res = await middleware(req('/api/markets'));
      expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('x-request-id is forwarded on allowed requests', async () => {
      const res = await middleware(req('/api/markets'));
      expect(res.headers.get('x-request-id')).toBe('test-request-id');
    });

    it('x-request-id is set on rate limit rejection', async () => {
      mockRateLimit.mockReturnValue({ success: false, limit: 100, remaining: 0, reset: Date.now() + 1000 });
      const res = await middleware(req('/api/markets'));
      expect(res.status).toBe(429);
      expect(res.headers.get('x-request-id')).toBe('test-request-id');
    });
  });
});
