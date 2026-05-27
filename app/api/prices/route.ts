import { NextRequest, NextResponse } from 'next/server';
import { globalCache } from '../../../lib/cache';

// Mock upstream price fetcher with simulated network latency
async function fetchUpstreamPrices(assetsList: string[]): Promise<any> {
  // Simulate 300ms upstream network latency
  await new Promise((resolve) => setTimeout(resolve, 300));

  const basePrices: Record<string, number> = {
    XLM: 0.1245 + (Math.random() - 0.5) * 0.002,
    USDC: 1.00,
    BTC: 67340.50 + (Math.random() - 0.5) * 100,
    ETH: 3480.20 + (Math.random() - 0.5) * 10,
  };

  const filteredPrices: Record<string, number> = {};
  assetsList.forEach((asset) => {
    const upperAsset = asset.toUpperCase().trim();
    if (basePrices[upperAsset] !== undefined) {
      filteredPrices[upperAsset] = basePrices[upperAsset];
    }
  });

  // If no specific valid assets were requested, return all of them
  const prices = Object.keys(filteredPrices).length > 0 ? filteredPrices : basePrices;

  return {
    prices,
    timestamp: new Date().toISOString(),
    source: 'Upstream price feed (Simulated)',
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetsParam = searchParams.get('assets') || '';
    
    // Parse assets list and clean them
    const assetsList = assetsParam
      ? assetsParam.split(',').map((a) => a.trim().toUpperCase()).filter(Boolean)
      : [];

    // Security Check & Cache Bypass check:
    // If the request contains authentication credentials, we must bypass the cache
    const authHeader = request.headers.get('Authorization');
    const hasAuthCookie = request.cookies.has('session') || request.cookies.has('token');
    const hasUserHeader = request.headers.has('x-user-id');
    const bypassCache = !!(authHeader || hasAuthCookie || hasUserHeader);

    if (bypassCache) {
      // Direct upstream fetch with no-store headers
      const freshData = await fetchUpstreamPrices(assetsList);
      return NextResponse.json(freshData, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Cache': 'BYPASS',
        },
      });
    }

    // Public request: Construct a safe, sanitized cache key (No Secrets!)
    // Sort assets list to ensure key order invariance (e.g. ?assets=USDC,XLM matches ?assets=XLM,USDC)
    const sortedAssetsKey = assetsList.sort().join(',');
    const cacheKey = `price:assets:${sortedAssetsKey || 'all'}`;

    // Caching configuration: TTL = 5 seconds, SWR = 10 seconds
    const cacheOptions = {
      ttl: 5 * 1000,
      swr: 10 * 1000,
    };

    const { value, status } = await globalCache.getOrFetch(
      cacheKey,
      () => fetchUpstreamPrices(assetsList),
      cacheOptions
    );

    return NextResponse.json(value, {
      status: 200,
      headers: {
        'Cache-Control': `public, max-age=5, stale-while-revalidate=10`,
        'X-Cache': status,
      },
    });
  } catch (error) {
    console.error('Price proxy route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}
