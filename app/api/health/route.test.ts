import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

vi.mock('@/lib/config', () => ({
  default: {
    app: { name: 'Stellarlend', version: '1.0.0', environment: 'test' },
    api: { baseUrl: 'http://localhost:3001', timeout: 10000 },
    stellar: {
      network: 'testnet',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    },
    analytics: {},
  },
}));

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/health', { headers });
}

describe('GET /api/health', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with a healthy status body', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.environment).toBe('test');
    expect(body.version).toBe('1.0.0');
  });

  it('includes ETag header on 200 response', async () => {
    const res = await GET(makeRequest());
    expect(res.headers.get('ETag')).toMatch(/^"[0-9a-f]{32}"$/);
  });

  it('includes public Cache-Control header', async () => {
    const res = await GET(makeRequest());
    const cc = res.headers.get('Cache-Control');
    expect(cc).toContain('public');
    expect(cc).toContain('max-age=30');
  });

  it('includes Vary header', async () => {
    const res = await GET(makeRequest());
    expect(res.headers.get('Vary')).toBeTruthy();
  });

  it('returns 304 when If-None-Match matches current ETag', async () => {
    // First request — capture the ETag
    const first = await GET(makeRequest());
    const etag = first.headers.get('ETag')!;
    expect(etag).toBeTruthy();

    // Second request — supply the ETag
    const second = await GET(makeRequest({ 'if-none-match': etag }));
    expect(second.status).toBe(304);
  });

  it('304 response body is empty', async () => {
    const first = await GET(makeRequest());
    const etag = first.headers.get('ETag')!;

    const second = await GET(makeRequest({ 'if-none-match': etag }));
    expect(await second.text()).toBe('');
  });

  it('304 response still includes ETag header', async () => {
    const first = await GET(makeRequest());
    const etag = first.headers.get('ETag')!;

    const second = await GET(makeRequest({ 'if-none-match': etag }));
    expect(second.headers.get('ETag')).toBe(etag);
  });

  it('returns 200 when If-None-Match does not match', async () => {
    const res = await GET(makeRequest({ 'if-none-match': '"stale-etag"' }));
    expect(res.status).toBe(200);
  });

  it('returns 200 when no If-None-Match header is sent', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it('returns same ETag on subsequent identical requests', async () => {
    const first = await GET(makeRequest());
    const second = await GET(makeRequest());
    expect(first.headers.get('ETag')).toBe(second.headers.get('ETag'));
  });
});
