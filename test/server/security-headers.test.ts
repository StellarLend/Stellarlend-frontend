import { describe, expect, it, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 })),
}));

vi.mock('@/lib/chaos/inject', () => ({
  chaosInject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/telemetry/sentry', () => ({
  captureServerError: vi.fn(),
}));

function apiRequest(path: string = '/api/test') {
  return new NextRequest(`http://localhost${path}`, {
    method: 'GET',
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Security Headers Middleware', () => {
  it('applies Referrer-Policy strict-origin-when-cross-origin on API routes', async () => {
    const response = middleware(apiRequest('/api/test'));
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('applies Referrer-Policy strict-origin-when-cross-origin on non-API routes', async () => {
    const response = middleware(apiRequest('/some-page'));
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('applies Content-Security-Policy with nonce on page routes', async () => {
    const response = middleware(apiRequest('/about'));
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(response.headers.get('x-csp-nonce')).toBeTruthy();
  });

  it('sanitizes malicious x-forwarded-for and falls back to loopback', () => {
    const response = middleware(
      new NextRequest('http://localhost/api/test', {
        headers: { 'x-forwarded-for': 'not-an-ip, 203.0.113.9' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
  });

  it('ignores malformed session cookie names when evaluating authenticated requests', () => {
    process.env.NEXT_PUBLIC_SESSION_COOKIE = 'session;evil';
    const response = middleware(
      new NextRequest('http://localhost/api/test', {
        headers: { cookie: 'session;evil=abc' },
      }),
    );

    expect(response.status).toBe(200);
    delete process.env.NEXT_PUBLIC_SESSION_COOKIE;
  });
});
