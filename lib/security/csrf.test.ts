import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { verifyCsrfToken } from '@/lib/security/csrf';

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
});
