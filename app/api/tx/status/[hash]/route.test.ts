import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  default: {
    stellar: { sorobanRpcUrl: 'https://soroban-testnet.stellar.org' },
  },
}));

import { GET } from './route';
import { SimpleCache } from '@/lib/cache';

describe('GET /api/tx/status/[hash]', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // clear internal cache between tests
    const cacheModule = require('@/lib/cache');
    if (cacheModule && cacheModule.default) cacheModule.default.prototype.clear?.call(cacheModule.default.prototype);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-hex hash', async () => {
    const response = await GET(new Request('http://localhost/api/tx/status/zz'), { params: { hash: 'zz' } } as any);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe('INVALID_INPUT');
  });

  it('returns NOT_FOUND when RPC returns null result', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: null }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await GET(new Request('http://localhost/api/tx/status/abc'), { params: { hash: 'abc' } } as any);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe('NOT_FOUND');
  });

  it('returns SUCCESS and caches final results', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: { status: 'success', hash: 'tx123' } }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const first = await GET(new Request('http://localhost/api/tx/status/aa11'), { params: { hash: 'aa11' } } as any);
    expect(first.status).toBe(200);
    const j1 = await first.json();
    expect(j1.status).toBe('SUCCESS');
    expect(j1.cached).toBe(false);

    const second = await GET(new Request('http://localhost/api/tx/status/aa11'), { params: { hash: 'aa11' } } as any);
    expect(second.status).toBe(200);
    const j2 = await second.json();
    expect(j2.status).toBe('SUCCESS');
    expect(j2.cached).toBe(true);
    // fetch called only once because second response should be served from cache
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns FAILED and caches final results', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: { status: 'failed', error: 'revert' } }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const res = await GET(new Request('http://localhost/api/tx/status/bb22'), { params: { hash: 'bb22' } } as any);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.status).toBe('FAILED');
    expect(j.cached).toBe(false);
  });

  it('maps upstream RPC errors to 502', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 500, message: 'upstream failure' } }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const res = await GET(new Request('http://localhost/api/tx/status/cc33'), { params: { hash: 'cc33' } } as any);
    expect(res.status).toBe(502);
    const j = await res.json();
    expect(j.error.code).toBe(500);
  });
});
