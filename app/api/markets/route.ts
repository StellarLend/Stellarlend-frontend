import { NextRequest, NextResponse } from 'next/server';
import { globalCache } from '@/lib/cache';
import { ASSET_SYMBOLS, isAssetSymbol, type AssetSymbol } from '@/types/enums';
import { fetchMarkets } from '@/lib/markets/repository';
import type { MarketsResponse } from '@/lib/markets/types';

export const runtime = 'nodejs';

const MAX_ASSETS = 20;

function isMarketsResponse(value: unknown): value is MarketsResponse {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.markets) && typeof obj.timestamp === 'string' && typeof obj.source === 'string';
}

export async function GET(request: NextRequest) {
  try {
    const assetParam = new URL(request.url).searchParams.get('asset');
    let assets: AssetSymbol[];
    if (assetParam !== null) {
      const requested = assetParam.split(',').map((a) => a.trim().toUpperCase());
      if (requested.some((a) => a === '')) {
        return NextResponse.json({ error: 'Asset symbols must not be empty' }, { status: 400 });
      }
      const invalid = requested.filter((a) => !isAssetSymbol(a));
      if (invalid.length > 0) {
        return NextResponse.json({ error: `Unknown asset(s): ${invalid.join(', ')}. Supported: ${ASSET_SYMBOLS.join(', ')}` }, { status: 400 });
      }
      if (new Set(requested).size !== requested.length) {
        return NextResponse.json({ error: 'Duplicate asset symbols are not allowed' }, { status: 400 });
      }
      if (requested.length > MAX_ASSETS) {
        return NextResponse.json({ error: `Too many asset symbols. Maximum is ${MAX_ASSETS}` }, { status: 400 });
      }
      assets = requested as AssetSymbol[];
    } else {
      assets = [...ASSET_SYMBOLS];
    }

    const cacheKey = `markets:assets:${[...assets].sort().join(',')}`;
    const cacheOptions = { ttl: 30 * 1000, swr: 60 * 1000 };
    const fetcher = async () => {
      const data = await fetchMarkets(assets);
      if (!isMarketsResponse(data)) throw new Error('Invalid markets response shape');
      return data;
    };
    const { value, status } = await globalCache.getOrFetch(cacheKey, fetcher, cacheOptions);
    return NextResponse.json(value, {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60', 'X-Cache': status },
    });
  } catch (error) {
    console.error('Markets route error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}