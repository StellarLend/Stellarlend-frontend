import { NextRequest, NextResponse } from 'next/server';
import { globalCache } from '@/lib/cache';
import { ASSET_SYMBOLS, isAssetSymbol, type AssetSymbol } from '@/types/enums';
import { fetchMarkets } from '@/lib/markets/repository';

export const runtime = 'nodejs';

/** GET /api/markets
 *
 *  Query params:
 *    asset  – optional, comma-separated AssetSymbol list (e.g. ?asset=XLM,USDC).
 *             Omit to return all supported assets.
 *
 *  Response shape:  MarketsResponse  (see lib/markets/types.ts)
 *    { markets: AssetMarket[], timestamp: string, source: string }
 *
 *  Caching:  public, TTL 30 s / SWR 60 s.
 *            Bypassed when Authorization header, session cookie, or x-user-id
 *            header is present (returns X-Cache: BYPASS).
 *
 *  Errors:
 *    400  – unknown asset symbol(s) in the ?asset param
 *    500  – upstream fetch failure
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetParam = searchParams.get('asset') || '';

    // Parse and validate requested assets
    let assets: AssetSymbol[];
    if (assetParam) {
      const requested = assetParam.split(',').map((a) => a.trim().toUpperCase());
      const invalid = requested.filter((a) => !isAssetSymbol(a));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Unknown asset(s): ${invalid.join(', ')}. Supported: ${ASSET_SYMBOLS.join(', ')}` },
          { status: 400 },
        );
      }
      assets = requested as AssetSymbol[];
    } else {
      assets = [...ASSET_SYMBOLS];
    }

    // Cache bypass for authenticated requests
    const authHeader = request.headers.get('Authorization');
    const hasAuthCookie = request.cookies.has('session') || request.cookies.has('token');
    const hasUserHeader = request.headers.has('x-user-id');
    const bypassCache = !!(authHeader || hasAuthCookie || hasUserHeader);

    if (bypassCache) {
      const data = await fetchMarkets(assets);
      return NextResponse.json(data, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Cache': 'BYPASS',
        },
      });
    }

    // Sort to make the cache key order-invariant (?asset=USDC,XLM == ?asset=XLM,USDC)
    const cacheKey = `markets:assets:${[...assets].sort().join(',')}`;
    const cacheOptions = { ttl: 30 * 1000, swr: 60 * 1000 };

    const { value, status } = await globalCache.getOrFetch(
      cacheKey,
      () => fetchMarkets(assets),
      cacheOptions,
    );

    return NextResponse.json(value, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        'X-Cache': status,
      },
    });
  } catch (error) {
    console.error('Markets route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 },
    );
  }
}
