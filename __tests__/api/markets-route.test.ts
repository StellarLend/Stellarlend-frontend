import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/markets/route';
import { globalCache } from '@/lib/cache';
import { fetchMarkets } from '@/lib/markets/repository';
import type { MarketsResponse } from '@/lib/markets/types';

vi.mock('@/lib/cache', () => ({
  globalCache: {
    getOrFetch: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('@/lib/markets/repository', async () => {
  const actual = await vi.importActual<typeof import('@/lib/markets/repository')>(
    '@/lib/markets/repository',
  );

  return {
    ...actual,
    fetchMarkets: vi.fn(),
  };
});

const mockMarkets: MarketsResponse = {
  markets: [
    { asset: 'XLM', supplyApr: 8.5, borrowApr: 12, utilization: 0.71, totalSupply: 2500000, totalBorrow: 1775000 },
    { asset: 'USDC', supplyApr: 5.2, borrowApr: 7.8, utilization: 0.65, totalSupply: 10000000, totalBorrow: 6500000 },
  ],
  timestamp: '2026-06-21T00:00:00.000Z',
  source: 'test market source',
};

function request(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(globalCache.getOrFetch).mockResolvedValue({
    value: mockMarkets,
    status: 'MISS',
  });
  vi.mocked(fetchMarkets).mockResolvedValue(mockMarkets);
});

describe('GET /api/markets', () => {
  it('returns the default market response shape with cache headers', async () => {
    const response = await GET(request('http://localhost:3000/api/markets'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      markets: expect.any(Array),
      timestamp: mockMarkets.timestamp,
      source: mockMarkets.source,
    });
    expect(body.markets[0]).toMatchObject({
      asset: 'XLM',
      supplyApr: expect.any(Number),
      borrowApr: expect.any(Number),
      utilization: expect.any(Number),
      totalSupply: expect.any(Number),
      totalBorrow: expect.any(Number),
    });
    expect(response.headers.get('Cache-Control')).toContain('max-age=30');
    expect(response.headers.get('X-Cache')).toBe('MISS');
    expect(vi.mocked(globalCache.getOrFetch)).toHaveBeenCalledWith(
      'markets:assets:BTC,ETH,USDC,XLM',
      expect.any(Function),
      { ttl: 30000, swr: 60000 },
    );
  });

  it('normalizes and filters a single lowercase asset', async () => {
    await GET(request('http://localhost:3000/api/markets?asset=xlm'));

    const fetcher = vi.mocked(globalCache.getOrFetch).mock.calls[0][1];
    await fetcher();

    expect(vi.mocked(globalCache.getOrFetch).mock.calls[0][0]).toBe('markets:assets:XLM');
    expect(fetchMarkets).toHaveBeenCalledWith(['XLM']);
  });

  it('uses an order-invariant cache key for multiple assets', async () => {
    await GET(request('http://localhost:3000/api/markets?asset=usdc, XLM'));

    expect(vi.mocked(globalCache.getOrFetch).mock.calls[0][0]).toBe(
      'markets:assets:USDC,XLM',
    );
  });

  it('rejects unknown assets with a 400 response before fetching', async () => {
    const response = await GET(request('http://localhost:3000/api/markets?asset=XLM,DOGE'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Unknown asset(s): DOGE');
    expect(globalCache.getOrFetch).not.toHaveBeenCalled();
    expect(fetchMarkets).not.toHaveBeenCalled();
  });

  it('bypasses cache for authenticated requests', async () => {
    const response = await GET(
      request('http://localhost:3000/api/markets?asset=XLM', {
        headers: { Authorization: 'Bearer token' },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('BYPASS');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(body.markets).toHaveLength(2);
    expect(globalCache.getOrFetch).not.toHaveBeenCalled();
    expect(fetchMarkets).toHaveBeenCalledWith(['XLM']);
  });

  it('returns a 500 response when market data fetching fails', async () => {
    vi.mocked(globalCache.getOrFetch).mockRejectedValue(new Error('rpc down'));

    const response = await GET(request('http://localhost:3000/api/markets'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch market data');
  });
});
