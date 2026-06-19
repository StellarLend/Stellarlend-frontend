import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/markets/route';
import { globalCache } from '@/lib/cache';
import { ASSET_SYMBOLS } from '@/types/enums';

function makeGetRequest(asset?: string, headers: HeadersInit = {}) {
  const url = new URL('http://localhost/api/markets');
  if (asset !== undefined) {
    url.searchParams.set('asset', asset);
  }
  return new NextRequest(url, { headers });
}

function expectMarketShape(market: Record<string, unknown>) {
  expect(ASSET_SYMBOLS).toContain(market.asset);
  expect(typeof market.supplyApr).toBe('number');
  expect(typeof market.borrowApr).toBe('number');
  expect(typeof market.utilization).toBe('number');
  expect(typeof market.totalSupply).toBe('number');
  expect(typeof market.totalBorrow).toBe('number');
}

describe('GET /api/markets', () => {
  beforeEach(() => {
    globalCache.clear();
  });

  afterEach(() => {
    globalCache.clear();
    vi.restoreAllMocks();
  });

  it('returns every supported market with the public response shape', async () => {
    const response = await GET(makeGetRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=30, stale-while-revalidate=60');
    expect(response.headers.get('X-Cache')).toBe('MISS');

    const body = await response.json();
    expect(body.markets).toHaveLength(ASSET_SYMBOLS.length);
    expect(typeof body.timestamp).toBe('string');
    expect(body.source).toBe('Soroban RPC stub (server relay)');
    body.markets.forEach(expectMarketShape);
  });

  it('filters a single asset case-insensitively', async () => {
    const response = await GET(makeGetRequest('xlm'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.markets).toHaveLength(1);
    expect(body.markets[0].asset).toBe('XLM');
    expectMarketShape(body.markets[0]);
  });

  it('filters multiple comma-separated assets while sharing an order-invariant cache key', async () => {
    const first = await GET(makeGetRequest('XLM,USDC'));
    expect(first.status).toBe(200);
    expect(first.headers.get('X-Cache')).toBe('MISS');

    const firstBody = await first.json();
    expect(firstBody.markets.map((market: { asset: string }) => market.asset)).toEqual(['XLM', 'USDC']);

    const second = await GET(makeGetRequest('USDC,XLM'));
    expect(second.status).toBe(200);
    expect(second.headers.get('X-Cache')).toBe('HIT');
  });

  it('rejects unknown assets with the supported symbol list', async () => {
    const response = await GET(makeGetRequest('XLM,UNKNOWN'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('UNKNOWN');
    expect(body.error).toContain(`Supported: ${ASSET_SYMBOLS.join(', ')}`);
  });

  it('rejects malformed comma-separated asset queries', async () => {
    const response = await GET(makeGetRequest('XLM,,USDC'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Unknown asset(s):');
    expect(body.error).toContain(`Supported: ${ASSET_SYMBOLS.join(', ')}`);
  });

  it('bypasses the public cache for authenticated requests', async () => {
    await GET(makeGetRequest());

    const response = await GET(makeGetRequest('XLM', { Authorization: 'Bearer test-token' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('BYPASS');
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
  });

  it('returns the route-level error response when request parsing fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const badRequest = {
      get url(): never {
        throw new Error('Unable to read URL');
      },
    } as unknown as NextRequest;

    const response = await GET(badRequest);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to fetch market data');
    expect(console.error).toHaveBeenCalled();
  });
});
