/**
 * GET /api/assets
 *
 * Returns canonical asset metadata from the registry.
 *
 * Query Parameters:
 *   - symbols (optional): Comma-separated list of asset symbols to retrieve
 *                         (e.g., ?symbols=XLM,USDC). Omit to retrieve all assets.
 *
 * Response:
 *   - 200: { assets: AssetMetadata[] }
 *   - 400: { error: string } – Invalid request parameters
 *   - 500: { error: string } – Registry load failure or internal server error
 *
 * Caching:
 *   - Public HTTP cache: TTL 24 hours / SWR 48 hours
 *   - Uses global in-memory cache with staleness tolerance
 *   - Bypassed for authenticated requests (Authorization header, session cookie, x-user-id header)
 *
 * @module app/api/assets/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { globalCache } from '@/lib/cache';
import { getAllAssets, getAssetMetadata } from '@/lib/assets/registry';
import { isAssetSymbol, type AssetSymbol } from '@/types/enums';
import { assetsQuerySchema, assetsResponseSchema } from '@/lib/validation/schemas/assets';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';
import { withRequestLogging } from '@/lib/api/handler';

export const runtime = 'nodejs';

/**
 * Handles GET requests to /api/assets
 */
async function handleGetAssets(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols') || '';

    // Parse and validate query parameters
    let requestedSymbols: string[] | undefined;
    try {
      const queryData = assetsQuerySchema.parse({ symbols: symbolsParam || undefined });
      requestedSymbols = queryData.symbols;
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Determine which assets to return
    let assets: ReturnType<typeof getAllAssets>;
    if (requestedSymbols && requestedSymbols.length > 0) {
      // Validate requested symbols
      const invalidSymbols = requestedSymbols.filter((s) => !isAssetSymbol(s));
      if (invalidSymbols.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid asset symbols: ${invalidSymbols.join(', ')}. Valid symbols: XLM, USDC, BTC, ETH`,
          },
          { status: 400 }
        );
      }

      // Fetch specific assets (safe to cast as all are validated)
      assets = (requestedSymbols as AssetSymbol[]).map((symbol) => getAssetMetadata(symbol));
    } else {
      // Fetch all assets
      assets = getAllAssets();
    }

    // Check cache bypass conditions
    const authHeader = request.headers.get('Authorization');
    const hasAuthCookie = request.cookies.has('session') || request.cookies.has('token');
    const hasUserHeader = request.headers.has('x-user-id');
    const bypassCache = !!(authHeader || hasAuthCookie || hasUserHeader);

    if (bypassCache) {
      // Validate response shape
      const response = assetsResponseSchema.parse({ assets });

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

    // Use cache for non-authenticated requests
    // Sort symbols to make cache key order-invariant
    const cacheKeySymbols =
      requestedSymbols && requestedSymbols.length > 0
        ? [...requestedSymbols].sort().join(',')
        : 'all';
    const cacheKey = `assets:${cacheKeySymbols}`;

    // TTL: 24 hours, SWR: 48 hours for long-lived static asset data
    const cacheOptions = { ttl: 24 * 60 * 60 * 1000, swr: 48 * 60 * 60 * 1000 };

    const { value, status } = await globalCache.getOrFetch(
      cacheKey,
      async () => {
        // Validate response before caching
        return assetsResponseSchema.parse({ assets });
      },
      cacheOptions
    );

    return NextResponse.json(value, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=172800',
        'X-Cache': status,
      },
    });
  } catch (error) {
    // Log detailed error for debugging
    logger.error('GET /api/assets failed', '/api/assets', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return generic error to client
    return NextResponse.json(
      { error: 'Failed to retrieve asset registry' },
      { status: 500 }
    );
  }
}

/**
 * Router for HTTP methods
 */
export const GET = withRequestLogging('/api/assets', handleGetAssets);

/**
 * Method not allowed for other HTTP methods
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}
