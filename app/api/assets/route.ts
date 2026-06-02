/**
 * Asset Registry API Route
 * GET /api/assets - Serves canonical asset metadata
 *
 * Query Parameters:
 *   - symbols: Comma-separated list of asset symbols (XLM, USDC, BTC, ETH)
 *     If omitted, all supported assets are returned
 *
 * Response Format:
 *   - assets: Array of asset metadata with symbol, name, decimals, issuer, and logo URL
 *   - timestamp: ISO 8601 timestamp of response
 *
 * Caching Strategy:
 *   - TTL: 60 seconds (fresh cache)
 *   - SWR: 300 seconds (stale-while-revalidate)
 *   - Static data cached for performance
 *
 * @example
 * GET /api/assets - Get all supported assets
 * GET /api/assets?symbols=XLM,USDC - Get specific assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { globalCache } from '@/lib/cache';
import { getAssets, isValidAsset, type AssetMetadata } from '@/lib/assets';
import { withRequestLogging } from '@/lib/api/handler';

export const runtime = 'nodejs';

// Cache configuration for static asset data
const ASSETS_CACHE_CONFIG = {
  ttl: 60000, // 60 seconds
  swr: 300000, // 5 minutes stale-while-revalidate
} as const;

interface AssetsResponse {
  assets: AssetMetadata[];
  timestamp: string;
}

interface AssetsErrorResponse {
  error: string;
  code: string;
  timestamp: string;
}

/**
 * Validates and normalizes the symbols query parameter
 */
function validateSymbolsQuery(
  symbolsParam: string | null
): { valid: true; symbols?: string[] } | { valid: false; error: string } {
  // If no parameter provided, return all symbols
  if (symbolsParam === null) {
    return { valid: true }; // All symbols
  }

  // If empty string or only whitespace, reject
  if (!symbolsParam.trim()) {
    return { valid: false, error: 'symbols parameter cannot be empty' };
  }

  const symbols = symbolsParam
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return { valid: false, error: 'symbols parameter cannot be empty' };
  }

  if (symbols.length > 20) {
    return { valid: false, error: 'Too many symbols requested (max 20)' };
  }

  // Validate each symbol
  const invalidSymbols = symbols.filter(symbol => !isValidAsset(symbol));
  if (invalidSymbols.length > 0) {
    return {
      valid: false,
      error: `Invalid asset symbols: ${invalidSymbols.join(', ')}`,
    };
  }

  return { valid: true, symbols };
}

/**
 * Generates cache key for assets query
 */
function generateAssetsCacheKey(symbols?: string[]): string {
  if (!symbols || symbols.length === 0) {
    return 'assets:all';
  }
  return `assets:${symbols.sort().join(',')}`;
}

/**
 * Fetches assets from registry
 */
async function fetchAssetsData(symbols?: string[]): Promise<AssetsResponse> {
  const assets = getAssets(symbols);

  return {
    assets,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Handles GET requests to /api/assets
 */
async function handleGetAssets(request: NextRequest): Promise<NextResponse<AssetsResponse | AssetsErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    // Validate query parameters
    const validation = validateSymbolsQuery(symbolsParam);

    if (!validation.valid) {
      const errorResponse: AssetsErrorResponse = {
        error: validation.error,
        code: 'INVALID_QUERY',
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(errorResponse, {
        status: 400,
        headers: {
          'Cache-Control': 'no-cache, no-store',
        },
      });
    }

    const symbols = validation.symbols;
    const cacheKey = generateAssetsCacheKey(symbols);

    // Use cache with TTL and SWR for static data
    const { value: assetsData, status: cacheStatus } = await globalCache.getOrFetch(
      cacheKey,
      () => fetchAssetsData(symbols),
      ASSETS_CACHE_CONFIG
    );

    return NextResponse.json(assetsData, {
      status: 200,
      headers: {
        'Cache-Control': `public, max-age=${ASSETS_CACHE_CONFIG.ttl / 1000}, stale-while-revalidate=${ASSETS_CACHE_CONFIG.swr / 1000}`,
        'X-Cache': cacheStatus,
        'Vary': 'Accept-Encoding',
      },
    });
  } catch (error) {
    console.error('Assets route error:', error);

    const errorResponse: AssetsErrorResponse = {
      error: error instanceof Error ? error.message : 'Failed to fetch assets',
      code: 'INTERNAL_ERROR',
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

export const GET = withRequestLogging('/api/assets', handleGetAssets);
