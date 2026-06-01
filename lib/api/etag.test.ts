import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  generateETag,
  isNotModified,
  cacheHeaders,
  notModifiedResponse,
} from './etag';

// ─── generateETag ────────────────────────────────────────────────────────────

describe('generateETag', () => {
  it('returns a quoted hex string', () => {
    const etag = generateETag({ status: 'ok' });
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/);
  });

  it('returns the same ETag for identical data', () => {
    const a = generateETag({ status: 'ok', count: 5 });
    const b = generateETag({ status: 'ok', count: 5 });
    expect(a).toBe(b);
  });

  it('returns different ETags for different data', () => {
    expect(generateETag({ count: 1 })).not.toBe(generateETag({ count: 2 }));
  });

  it('accepts a plain string as input', () => {
    const etag = generateETag('hello');
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/);
  });

  it('produces different ETags for string vs object with same content', () => {
    // JSON.stringify({ a: 1 }) !== 'a: 1'
    expect(generateETag({ a: 1 })).not.toBe(generateETag('{ a: 1 }'));
  });

  it('handles empty array', () => {
    expect(generateETag([])).toMatch(/^"[0-9a-f]{32}"$/);
  });

  it('handles empty object', () => {
    expect(generateETag({})).toMatch(/^"[0-9a-f]{32}"$/);
  });
});

// ─── isNotModified ───────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/test', { headers });
}

describe('isNotModified', () => {
  const etag = generateETag({ data: 'value' });

  it('returns true when If-None-Match matches the ETag exactly', () => {
    expect(isNotModified(makeRequest({ 'if-none-match': etag }), etag)).toBe(true);
  });

  it('returns true when If-None-Match is the wildcard *', () => {
    expect(isNotModified(makeRequest({ 'if-none-match': '*' }), etag)).toBe(true);
  });

  it('returns false when If-None-Match does not match', () => {
    expect(isNotModified(makeRequest({ 'if-none-match': '"stale-etag"' }), etag)).toBe(false);
  });

  it('returns false when If-None-Match header is absent', () => {
    expect(isNotModified(makeRequest(), etag)).toBe(false);
  });

  it('returns false when If-None-Match is an empty string', () => {
    expect(isNotModified(makeRequest({ 'if-none-match': '' }), etag)).toBe(false);
  });
});

// ─── cacheHeaders ────────────────────────────────────────────────────────────

describe('cacheHeaders', () => {
  const etag = '"abc123"';

  it('includes the ETag header', () => {
    const headers = cacheHeaders(etag, 60, 'public');
    expect(headers['ETag']).toBe(etag);
  });

  it('sets public Cache-Control with max-age for public visibility', () => {
    const headers = cacheHeaders(etag, 60, 'public');
    expect(headers['Cache-Control']).toContain('public');
    expect(headers['Cache-Control']).toContain('max-age=60');
  });

  it('sets private Cache-Control with no-cache for private visibility', () => {
    const headers = cacheHeaders(etag, 0, 'private');
    expect(headers['Cache-Control']).toContain('private');
    expect(headers['Cache-Control']).toContain('no-cache');
  });

  it('includes Authorization in Vary for private routes', () => {
    const headers = cacheHeaders(etag, 0, 'private');
    expect(headers['Vary']).toContain('Authorization');
  });

  it('does not include Authorization in Vary for public routes', () => {
    const headers = cacheHeaders(etag, 60, 'public');
    expect(headers['Vary']).not.toContain('Authorization');
  });

  it('defaults to public visibility', () => {
    const headers = cacheHeaders(etag, 30);
    expect(headers['Cache-Control']).toContain('public');
  });
});

// ─── notModifiedResponse ─────────────────────────────────────────────────────

describe('notModifiedResponse', () => {
  const etag = '"abc123"';

  it('returns status 304', () => {
    expect(notModifiedResponse(etag).status).toBe(304);
  });

  it('includes the ETag in headers', () => {
    const { headers } = notModifiedResponse(etag) as { headers: Record<string, string> };
    expect(headers['ETag']).toBe(etag);
  });

  it('sets public Cache-Control for public visibility', () => {
    const { headers } = notModifiedResponse(etag, 'public') as { headers: Record<string, string> };
    expect(headers['Cache-Control']).toContain('public');
  });

  it('sets private Cache-Control for private visibility', () => {
    const { headers } = notModifiedResponse(etag, 'private') as { headers: Record<string, string> };
    expect(headers['Cache-Control']).toContain('private');
  });
});
