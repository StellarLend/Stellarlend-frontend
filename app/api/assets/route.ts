import { NextRequest, NextResponse } from 'next/server';
import { globalCache } from '@/lib/cache';
import { getAssets, isValidAsset, type AssetMetadata } from '@/lib/assets/registry';

export const runtime = 'nodejs';

const ASSETS_CACHE_CONFIG = {
  ttl: 60000,
  swr: 300000,
} as const;

function validateSymbolsQuery(
  symbolsParam: string | null
): { valid: true; symbols?: string[] } | { valid: false; error: string } {
  if (symbolsParam === null) {
    return { valid: true };
  }

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

  const invalidSymbols = symbols.filter(symbol => !isValidAsset(symbol));
  if (invalidSymbols.length > 0) {
    return {
      valid: false,
      error: `Invalid asset symbols: ${invalidSymbols.join(', ')}`,
    };
  }

  return { valid: true, symbols };
}

function generateAssetsCacheKey(symbols?: string[]): string {
  if (!symbols || symbols.length === 0) {
    return 'assets:all';
  }
  return `assets:${[...symbols].sort().join(',')}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    const validation = validateSymbolsQuery(symbolsParam);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, code: 'INVALID_QUERY', timestamp: new Date().toISOString() },
        { status: 400, headers: { 'Cache-Control': 'no-cache, no-store' } }
      );
    }

    const symbols = validation.symbols;
    const cacheKey = generateAssetsCacheKey(symbols);

    const cacheResult = await globalCache.getOrFetch(
      cacheKey,
      async () => ({
        assets: getAssets(symbols),
        timestamp: new Date().toISOString(),
      }),
      ASSETS_CACHE_CONFIG
    );

    const assetsData = cacheResult?.value ?? cacheResult;
    const cacheStatus = cacheResult?.status ?? 'MISS';

    return NextResponse.json(assetsData, {
      status: 200,
      headers: {
        'Cache-Control': `public, max-age=${ASSETS_CACHE_CONFIG.ttl / 1000}, stale-while-revalidate=${ASSETS_CACHE_CONFIG.swr / 1000}`,
        'X-Cache': cacheStatus,
        'Vary': 'Accept-Encoding',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch assets',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: { 'Cache-Control': 'no-cache, no-store' } }
    );
  }
}