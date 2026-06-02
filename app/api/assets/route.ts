import { NextRequest, NextResponse } from 'next/server';
import { globalCache } from '@/lib/cache';
import { ASSET_SYMBOLS, isAssetSymbol, type AssetSymbol } from '@/types/enums';
import { getAllAssets, getAssetMetadata, type AssetMetadata } from '@/lib/assets';

export const runtime = 'nodejs';

export interface AssetsResponse {
  assets: AssetMetadata[];
  timestamp: string;
}

/**
 * GET /api/assets
 *
 * Returns the canonical asset registry with metadata for all supported assets.
 *
 * Query params:
 *    symbol  – optional, comma-separated AssetSymbol list (e.g. ?symbol=XLM,USDC).
 *              Omit to return all supported assets.
 *
 * Response shape:  AssetsResponse
 *    { assets: AssetMetadata[], timestamp: string }
 *
 * Caching:  public, TTL 1 hour / SWR 24 hours.
 *           Bypassed when Authorization header, session cookie, or x-user-id
 *           header is present (returns X-Cache: BYPASS).
 *
 * Errors:
 *    400  – unknown asset symbol(s) in the ?symbol param
 *    500  – registry loading failure
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const symbolParam = searchParams.get('symbol') || '';

    // Parse and validate requested assets
    let symbols: AssetSymbol[];
    if (symbolParam) {
      const requested = symbolParam.split(',').map((s) => s.trim().toUpperCase());
      const invalid = requested.filter((s) => !isAssetSymbol(s));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Unknown asset symbol(s): ${invalid.join(', ')}. Supported: ${ASSET_SYMBOLS.join(', ')}` },
          { status: 400 },
        );
      }
      symbols = requested as AssetSymbol[];
    } else {
      symbols = [...ASSET_SYMBOLS];
    }

    // Cache bypass for authenticated requests
    const authHeader = request.headers.get('Authorization');
    const hasAuthCookie = request.cookies.has('session') || request.cookies.has('token');
    const hasUserHeader = request.headers.has('x-user-id');
    const bypassCache = !!(authHeader || hasAuthCookie || hasUserHeader);

    if (bypassCache) {
      const assets = symbols.map((symbol) => getAssetMetadata(symbol)!);
      const response: AssetsResponse = {
        assets,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Cache': 'BYPASS',
        },
      });
    }

    // Sort to make the cache key order-invariant (?symbol=USDC,XLM == ?symbol=XLM,USDC)
    const cacheKey = `assets:symbols:${[...symbols].sort().join(',')}`;
    const cacheOptions = { ttl: 60 * 60 * 1000, swr: 24 * 60 * 60 * 1000 };

    const { value: response, status: cacheStatus } = await globalCache.getOrFetch(
      cacheKey,
      async () => {
        const assets = symbols.map((symbol) => getAssetMetadata(symbol)!);
        return {
          assets,
          timestamp: new Date().toISOString(),
        };
      },
      cacheOptions,
    );

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Cache': cacheStatus,
      },
    });
  } catch (error) {
    console.error('Assets route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset registry' },
      { status: 500 },
    );
  }
}

/**
 * POST endpoint is not supported for the read-only asset registry.
 */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'POST not allowed; asset registry is read-only' },
    { status: 405 },
  );
}
