import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { getAnonymousRateLimitIdentifier } from '../middleware';

describe('middleware anonymous rate-limit identity', () => {
  it('uses only the first forwarded address', () => {
    const request = new NextRequest('https://example.test/api/data', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1, 10.0.0.2' },
    });
    expect(getAnonymousRateLimitIdentifier(request)).toBe('api-ratelimit:203.0.113.10');
  });

  it('falls back for malformed forwarded addresses', () => {
    const request = new NextRequest('https://example.test/api/data', {
      headers: { 'x-forwarded-for': 'not-an-ip' },
    });
    expect(getAnonymousRateLimitIdentifier(request)).toBe('api-ratelimit:unknown');
  });

  it('bounds attacker-controlled forwarded input', () => {
    const request = new NextRequest('https://example.test/api/data', {
      headers: { 'x-forwarded-for': '1'.repeat(129) },
    });
    expect(getAnonymousRateLimitIdentifier(request)).toBe('api-ratelimit:unknown');
  });

  it('uses a stable fallback when the header is absent', () => {
    const request = new NextRequest('https://example.test/api/data');
    expect(getAnonymousRateLimitIdentifier(request)).toBe('api-ratelimit:unknown');
  });
});
