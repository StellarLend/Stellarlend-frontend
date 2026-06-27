import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { globalCache } from '@/lib/cache';
import { fetchMarkets } from '@/lib/markets/repository';
import type { MarketsResponse } from '@/lib/markets/types';

vi.mock('@/lib/cache', () => ({
  globalCache: {
    getOrFetch: vi.fn(),
  },
}));

vi.mock('@/lib/markets/repository', () => ({
  fetchMarkets: vi.fn(),
}));

const marketsResponse: MarketsResponse = {
  markets: [
    {
      asset: 'XLM',
      supplyApr: 8.5,
      borrowApr: 12,
      utilization: 0.71,
      totalSupply: 2_500_000,
      totalBorrow: 1_775_000,
    },
    {
      asset: 'USDC',
      supplyApr: 5.2,
      borrowApr: 7.8,
      utilization: 0.65,
      totalSupply: 10_000_000,
      totalBorrow: 6_500_000,
    },
  ],
  timestamp: '2026-06-21T12:00:00.000Z',
  source: 'Soroban RPC stub (server relay)',
};

function makeRequest(path = '/api/markets', headers?: HeadersInit) {
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(globalCache.getOrFetch).mockResolvedValue({
    value: marketsResponse,
    status: 'MISS',
  });
  vi.mocked(fetchMarkets).mockResolvedValue(marketsResponse);
});

describe('GET /api/markets', () => {
  it('returns the markets response contract for all supported assets', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=30, stale-while-revalidate=60');
    expect(response.headers.get('X-Cache')).toBe('MISS');
    expect(body).toEqual(marketsResponse);
    expect(body.markets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          asset: 'XLM',
          supplyApr: expect.any(Number),
          borrowApr: expect.any(Number),
        }),
        expect.objectContaining({
          asset: 'USDC',
          supplyApr: expect.any(Number),
          borrowApr: expect.any(Number),
        }),
      ]),
    );
    expect(globalCache.getOrFetch).toHaveBeenCalledWith(
      'markets:assets:BTC,ETH,USDC,XLM',
      expect.any(Function),
      { ttl: 30_000, swr: 60_000 },
    );
  });

  it('normalizes and filters requested assets case-insensitively', async () => {
    const response = await GET(makeRequest('/api/markets?asset=xlm,%20usdc%20'));

    expect(response.status).toBe(200);
    expect(globalCache.getOrFetch).toHaveBeenCalledWith(
      'markets:assets:USDC,XLM',
      expect.any(Function),
      { ttl: 30_000, swr: 60_000 },
    );
  });

  it('uses an order-invariant cache key for multi-asset filters', async () => {
    await GET(makeRequest('/api/markets?asset=USDC,XLM'));
    await GET(makeRequest('/api/markets?asset=XLM,USDC'));

    expect(vi.mocked(globalCache.getOrFetch).mock.calls.map(([cacheKey]) => cacheKey)).toEqual([
      'markets:assets:USDC,XLM',
      'markets:assets:USDC,XLM',
    ]);
  });

  it('rejects unknown assets before fetching market data', async () => {
    const response = await GET(makeRequest('/api/markets?asset=XLM,DOGE'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Unknown asset(s): DOGE');
    expect(body.error).toContain('Supported: XLM, USDC, BTC, ETH');
    expect(globalCache.getOrFetch).not.toHaveBeenCalled();
    expect(fetchMarkets).not.toHaveBeenCalled();
  });

  it('bypasses public cache for authenticated requests', async () => {
    const response = await GET(makeRequest('/api/markets?asset=XLM', { Authorization: 'Bearer test-token' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('BYPASS');
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    expect(body).toEqual(marketsResponse);
    expect(fetchMarkets).toHaveBeenCalledWith(['XLM']);
    expect(globalCache.getOrFetch).not.toHaveBeenCalled();
  });

  it('returns 500 when the market repository fails', async () => {
    vi.mocked(globalCache.getOrFetch).mockRejectedValueOnce(new Error('upstream down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await GET(makeRequest('/api/markets?asset=XLM'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to fetch market data' });

    consoleSpy.mockRestore();
  });
});
