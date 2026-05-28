/**
 * Price Oracle Proxy API Route
 * GET /api/prices - Fetch cached asset prices with optional asset filtering
 * 
 * Query Parameters:
 *   - assets: Comma-separated list of assets (XLM, USDC, BTC, ETH)
 *     If omitted, all supported assets are returned
 * 
 * Security Features:
 *   - API keys kept server-side only
 *   - Request-level cache bypass for authenticated requests
 *   - Input validation against supported asset list
 *   - Proper HTTP cache headers for CDN/browser caching
 * 
 * Caching Strategy:
 *   - TTL: 5 seconds (fresh cache)
 *   - SWR: 10 seconds (stale-while-revalidate)
 *   - Background revalidation for stale entries
 * 
 * @example
 * GET /api/prices - Get all supported assets
 * GET /api/prices?assets=XLM,USDC - Get specific assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { globalCache } from '@/lib/cache';
import {
  validateAssetsQuery,
  generateCacheKey,
  hasNoApiKeys,
} from '@/lib/prices/validation';
import { fetchUpstreamPrices, isValidUpstreamResponse } from '@/lib/prices/fetcher';
import { PRICE_CACHE_CONFIG } from '@/lib/prices/constants';
import type { PriceResponse, PriceErrorResponse, SupportedAsset } from '@/lib/prices/types';

export const runtime = 'nodejs';

/**
 * Determines if request should bypass cache
 * Authenticated requests always bypass to get fresh data for user-specific operations
 */
function shouldBypassCache(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const hasAuthCookie = request.cookies.has('session') || request.cookies.has('token');
  const hasUserHeader = request.headers.has('x-user-id');
  return !!(authHeader || hasAuthCookie || hasUserHeader);
}

/**
 * Fetches and formats prices from upstream source
 */
async function getPriceData(assets: SupportedAsset[]): Promise<PriceResponse> {
  const upstreamData = await fetchUpstreamPrices(assets);

  if (!isValidUpstreamResponse(upstreamData)) {
    throw new Error('Invalid upstream price response structure');
  }

  // Ensure no API keys are accidentally included
  if (!hasNoApiKeys(upstreamData)) {
    console.error('SECURITY ALERT: API keys detected in upstream response!');
    throw new Error('Security validation failed');
  }

  return {
    prices: upstreamData.prices,
    timestamp: upstreamData.timestamp,
    source: 'Stellar Price Oracle Proxy',
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<PriceResponse | PriceErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const assetsParam = searchParams.get('assets');

    // Validate and normalize assets query parameter
    const validation = validateAssetsQuery(assetsParam);

    if (!validation.valid) {
      const errorResponse: PriceErrorResponse = {
        error: `Invalid assets query: ${validation.errors.join('; ')}`,
        code: 'INVALID_ASSETS_QUERY',
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(errorResponse, {
        status: 400,
        headers: {
          'Cache-Control': 'no-cache, no-store',
        },
      });
    }

    const assets = validation.assets;

    // Check if this is an authenticated request that should bypass cache
    const bypassCache = shouldBypassCache(request);

    if (bypassCache) {
      // Authenticated requests always fetch fresh data
      const priceData = await getPriceData(assets);

      return NextResponse.json(priceData, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Cache': 'BYPASS',
        },
      });
    }

    // Public request: Use cache with TTL and SWR
    const cacheKey = generateCacheKey(assets);

    const { value: priceData, status: cacheStatus } = await globalCache.getOrFetch(
      cacheKey,
      () => getPriceData(assets),
      PRICE_CACHE_CONFIG
    );

    // Add cache metadata to response
    const response: PriceResponse & { cached: boolean; cacheAge?: number } = {
      ...priceData,
      cached: cacheStatus !== 'MISS',
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': `public, max-age=${PRICE_CACHE_CONFIG.ttl / 1000}, stale-while-revalidate=${PRICE_CACHE_CONFIG.swr / 1000}`,
        'X-Cache': cacheStatus,
        'Vary': 'Accept-Encoding',
      },
    });
  } catch (error) {
    console.error('Price proxy route error:', error);

    const errorResponse: PriceErrorResponse = {
      error: error instanceof Error ? error.message : 'Failed to fetch prices',
      code: 'PRICE_FETCH_ERROR',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store',
      },
    });
  }
}
