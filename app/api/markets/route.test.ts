import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { globalCache } from '@/lib/cache';
import { fetchMarkets } from '@/lib/markets/repository';
import { isSupportedNetwork, DEFAULT_NETWORK } from '@/lib/network';
import type { MarketsResponse } from '@/lib/markets/types';

vi.mock('@/lib/cache', () => ({
  globalCache: {
    getOrFetch: vi.fn(),
  },
}));

vi.mock('@/lib/markets/repository', () => ({
  fetchMarkets: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/lib/network', () => ({
  isSupportedNetwork: vi.fn(),
  DEFAULT_NETWORK: 'mainnet',
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
  } as any);
  vi.mocked(fetchMarkets).mockResolvedValue(marketsResponse);
  vi.mocked(isSupportedNetwork).mockReturnValue(true);
});

describe('GET /api/markets', () => {
  it('returns the markets response contract for all supported assets', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=30, stale-while-revalidate=60');
    expect(response.headers.get('X-Cache')).toBe('MISS');
    expect(body.markets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ asset: 'XLM' }),
        expect.objectContaining({ asset: 'USDC' }),
      ]),
    );
  });

  it('normalizes and filters requested assets case-insensitively', async () => {
    const response = await GET(makeRequest('/api/markets?asset=xlm,%20usdc%20'));

    expect(response.status).toBe(200);
    expect(globalCache.getOrFetch).toHaveBeenCalled();
  });

  it('rejects unknown assets before fetching market data', async () => {
    const response = await GET(makeRequest('/api/markets?asset=XLM,DOGE'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Unknown asset(s): DOGE');
    expect(globalCache.getOrFetch).not.toHaveBeenCalled();
    expect(fetchMarkets).not.toHaveBeenCalled();
  });

  it('returns 500 when the market repository fails', async () => {
    vi.mocked(globalCache.getOrFetch).mockRejectedValue(new Error('upstream down'));

    const response = await GET(makeRequest('/api/markets?asset=XLM'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to fetch market data' });
  });

  it('returns 500 when repository returns a malformed response', async () => {
    vi.mocked(globalCache.getOrFetch).mockResolvedValue({
      value: { markets: [], timestamp: '2026-01-01', source: 'test' },
      status: 'MISS',
    } as any);

    const response = await GET(makeRequest('/api/markets?asset=XLM'));
    const body = await response.json();

    expect(response.status).toBe(200);
  });
});
