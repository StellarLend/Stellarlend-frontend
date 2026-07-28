import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { generateCsrfToken, setCsrfCookie, verifyCsrfToken } from '@/lib/security/csrf';

const originalNodeEnv = process.env.NODE_ENV;

function makeRequest(opts: {
  cookie?: string;
  header?: string;
  authorization?: string;
}): NextRequest {
  const headers: Record<string, string> = {};
  const cookieParts: string[] = [];
  if (opts.cookie !== undefined) cookieParts.push(`csrf-token=${opts.cookie}`);
  if (cookieParts.length > 0) headers['Cookie'] = cookieParts.join('; ');
  if (opts.header !== undefined) headers['x-csrf-token'] = opts.header;
  if (opts.authorization !== undefined) headers['authorization'] = opts.authorization;

  return new NextRequest('http://localhost/api/whatever', { headers });
}

beforeEach(() => {
  delete process.env.NODE_ENV;
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('generateCsrfToken', () => {
  it('returns a 32-character hex string', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates different tokens on successive calls', () => {
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    expect(token1).not.toBe(token2);
  });

  it('uses crypto.getRandomValues for randomness', () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });
});

describe('setCsrfCookie', () => {
  it('sets the csrf-token cookie with correct options in development', () => {
    process.env.NODE_ENV = 'development';
    const response = new NextResponse();
    const token = 'test-token-123';
    setCsrfCookie(response, token);

    const cookie = response.cookies.get('csrf-token');
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe(token);
    expect(cookie?.httpOnly).toBe(false);
    expect(cookie?.secure).toBe(false);
    expect(cookie?.sameSite).toBe('lax');
    expect(cookie?.path).toBe('/');
    expect(cookie?.maxAge).toBe(60 * 60 * 24);
  });

  it('sets the secure flag in production', () => {
    process.env.NODE_ENV = 'production';
    const response = new NextResponse();
    const token = 'test-token-123';
    setCsrfCookie(response, token);

    const cookie = response.cookies.get('csrf-token');
    expect(cookie).toBeDefined();
    expect(cookie?.secure).toBe(true);
  });

  it('sets one-day maxAge', () => {
    const response = new NextResponse();
    const token = 'test-token-123';
    setCsrfCookie(response, token);

    const cookie = response.cookies.get('csrf-token');
    expect(cookie?.maxAge).toBe(86400);
  });
});

describe('verifyCsrfToken', () => {
  it('returns true when cookie and header tokens match', () => {
    const req = makeRequest({ cookie: 'abc123', header: 'abc123' });
    expect(verifyCsrfToken(req)).toBe(true);
  });

  it('returns false when cookie and header tokens differ (same length)', () => {
    const req = makeRequest({ cookie: 'abc123', header: 'xyz789' });
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it('returns false when cookie and header tokens differ in length', () => {
    const req = makeRequest({ cookie: 'abc123', header: 'abc123extra' });
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it('returns false when the cookie is missing', () => {
    const req = makeRequest({ header: 'abc123' });
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it('returns false when the header is missing', () => {
    const req = makeRequest({ cookie: 'abc123' });
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it('returns false when both cookie and header are missing', () => {
    const req = makeRequest({});
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it('returns true for a Bearer authorization header even without csrf cookie/header', () => {
    const req = makeRequest({ authorization: 'Bearer some-token' });
    expect(verifyCsrfToken(req)).toBe(true);
  });

  it('does not bypass via Bearer prefix when authorization header is malformed', () => {
    const req = makeRequest({ authorization: 'bearer-not-real', cookie: 'abc', header: 'xyz' });
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it('returns false when cookie value is empty string', () => {
    const req = makeRequest({ cookie: '', header: 'abc123' });
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it('returns false when header is present but cookie is absent', () => {
    const req = makeRequest({ header: 'abc123' });
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it('bypasses CSRF check when authorization header has Bearer token', () => {
    const req = makeRequest({ authorization: 'Bearer jwt-token-here' });
    expect(verifyCsrfToken(req)).toBe(true);
  });

  it('bypasses CSRF check when authorization header has Bearer with extra spaces', () => {
    const req = makeRequest({ authorization: 'Bearer  token-with-spaces' });
    expect(verifyCsrfToken(req)).toBe(true);
  });

  it('does not bypass when authorization header is just "Bearer" without token', () => {
    const req = makeRequest({ authorization: 'Bearer', cookie: 'abc', header: 'xyz' });
    expect(verifyCsrfToken(req)).toBe(false);
  });
});
