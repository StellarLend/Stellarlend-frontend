import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/http', () => ({
  httpGet: vi.fn().mockResolvedValue({}),
  UpstreamHttpError: class extends Error {},
  TimeoutError: class extends Error {},
}));

import { GET } from './route';

vi.mock('@/lib/config', () => ({
  default: {
    app: { name: 'Stellarlend', version: '1.0.0', environment: 'test' },
    api: { baseUrl: 'http://localhost:3001', timeout: 10000 },
    stellar: {
      network: 'testnet',
      horizonUrl: 'https://horizon-testnet.stellar.org',
    },
    analytics: {},
  },
}));

vi.mock('@/lib/server-config', () => ({
  default: {
    stellar: { sorobanRpcUrl: 'https://private-rpc.test' },
  },
}));

const httpGetMock = vi.fn();

vi.mock('@/lib/http', () => ({
  httpGet: (...args: unknown[]) => httpGetMock(...args),
  TimeoutError: class TimeoutError extends Error {},
  UpstreamHttpError: class UpstreamHttpError extends Error {},
}));

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/health', { headers });
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    httpGetMock.mockResolvedValue({ ok: true });
  });

  it('returns 200 with a healthy status body', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.environment).toBe('test');
    expect(body.version).toBe('1.0.0');
    expect(body.checks).toEqual({
      api: 'healthy',
      database: 'healthy',
      stellar: 'healthy',
    });
  });

  it('checks the server-only Soroban RPC health endpoint', async () => {
    await GET(makeRequest());

    expect(httpGetMock).toHaveBeenCalledWith(
      'https://private-rpc.test/health',
      expect.objectContaining({ retries: 1, timeoutMs: 5000 }),
    );
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
    const first = await GET(makeRequest());
    const etag = first.headers.get('ETag')!;

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
});
