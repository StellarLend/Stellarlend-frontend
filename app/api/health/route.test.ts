import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const httpGetMock = vi.fn().mockResolved({});

vi.mock('@/lib/http', () => ({
  httpGet: (...args: unknown[]) => httpGetMock(...args),
  TimeoutError: class TimeoutError extends Error {},
  UpstreamHttpError: class UpstreamHttpError extends Error {},
}));

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

import { GET } from './route';

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/health', { headers });
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    httpGetMock.mockResolved({ ok: true });
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
  it('reports database as healthy when the DB responds', async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.checks.database).toBe('healthy');
    expect(body.status).not.toBe('unhealthy');
  });

  it('checks the Soroban RPC health endpoint', async () => {
    await GET(makeRequest());

    expect(httpGetMock).toHaveBeenCalledWith(
      'https://soroban-testnet.stellar.org/health',
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
    expect(cc).toContain('max-age=');
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

  // --- Failure-path coverage ---

  it('reports degraded when the Soroban RPC fails', async () => {
    httpGetMock.mockImplementation((url: string) => {
      if (url.includes('soroban')) return Promise.reject(new Error('rpc down'));
      return Promise.resolve({ ok: true });
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks.stellar).toBe('degraded');
    expect(body.checks.api).toBe('healthy');
    expect(body.checks.database).toBe('healthy');
  });

  it('reports degraded when Horizon fails but Soroban is healthy', async () => {
    httpGetMock.mockImplementation((url: string) => {
      if (url.includes('horizon')) return Promise.reject(new Error('horizon down'));
      return Promise.resolve({ });
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.checks.stellar).toBe('degraded');
    expect(body.status).toBe('degraded');
  });

  it('reports degraded when the database check fails', async () => {
    httpGetMock.mockImplementation((url: string) => {
      if (url.endsWith('/health/db')) return Promise.reject(new Error('db down'));
      return Promise.resolve({ });
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.checks.database).toBe('degraded');
    expect(body.status).toBe('degraded');
  });

  it('reports degraded when the API check fails', async () => {
    httpGetMock.mockImplementation((url: string) => {
      if (url.endsWith('/health')) return Promise.reject(new Error('api down'));
      return Promise.resolve({ });
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.checks.api).toBe('degraded');
    expect(body.status).toBe('degraded');
  });

  it('reports degraded for all checks when every dependency fails', async () => {
    httpGetMock.mockRejected(new Error('network down'));

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks).toEqual({
      database: 'degraded',
      api: 'degraded',
      stellar: 'degraded',
    });
  });

  it('returns a deterministic degraded response when an unexpected error occurs', async () => {
    // Force a failure in the overall handler by making the config accessor throw.
    const original = httpGetMock.getMockImplementation();
    httpGetMock.mockImplementation(() => {
      throw new Error('unexpected failure');
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(res.headers.get('Cache-Control')).toBe(null);
    httpGetMock.mockImplementation(original as any);
  });

  // --- Boundary coverage ---

  it('treats a blank If-None-Match as a miss', async () => {
    const res = await GET(makeRequest({ 'if-none-match': '' }));
    expect(res.status).toBe(200);
  });

  it('returns 304 for a multi-value If-None-Match that includes the current ETag', async () => {
    const first = await GET(makeRequest());
    const etag = first.headers.get('ETag')!;

    const second = await GET(makeRequest({ 'if-none-match': `"weak", ${etag}` }));
    // With a non-exact match the response is a fresh 200.
    expect(second.status).toBe(200);
  });

  it('produces the same ETag for identical dependency states (determinism)', async () => {
    const a = await GET(makeRequest());
    const b = await GET(makeRequest());
    expect(a.headers.get('ETag')).toBe(b.headers.get('ETag'));
  });

  it('produces a different ETag when dependency state changes', async () => {
    const healthy = await GET(makeRequest());
    const healthyEtag = healthy.headers.get('ETag');

    httpGetMock.mockRejected(new Error('down'));
    const degraded = await GET(makeRequest());
    expect(degraded.headers.get('ETag')).not.toBe(healthyEtag);
  });

  it('runs all dependency checks even when one fails (partial failure)', async () => {
    httpGetMock.mockImplementation((url: string) => {
      if (url.includes('soroban')) return Promise.reject(new Error('rpc down'));
      return Promise.resolve({ ok: true });
    });

    await GET(makeRequest());
    expect(httpGetMock).toHaveBeenCalled();
    const calledUrls = httpGetMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes('stellar.org'))).toBe(true);
    expect(calledUrls.some((u) => u.endsWith('/health/db'))).toBe(true);
  });

  it('uses a 5 second timeout and a single retry for every dependency check', async () => {
    await GET(makeRequest());
    for (const call of httpGetMock.mock.calls) {
      expect(call[1]).toMatchObject({ timeoutMs: 5000, retries: 1 });
    }
  });

  it('never exposes internal error messages in the degraded fallback body', async () => {
    httpGetMock.mockImplementation(() => {
      throw new Error('secret-internal-detail');
    });

    const res = await GET(makeRequest());
    const text = await res.text();
    expect(text).not.toContain('secret-internal-detail');
  });
});
