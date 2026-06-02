/**
 * GET /api/positions/history
 *
 * Returns historical position snapshots (supplied/borrowed balances and effective APY)
 * for the authenticated wallet, bucketed by the specified time interval.
 *
 * Authentication: Required
 * Cache: 5 minutes per wallet
 *
 * Query Parameters:
 * - from: number (optional) - Start timestamp in ms (default: 90 days ago)
 * - to: number (optional) - End timestamp in ms (default: now)
 * - interval: '1h' | '1d' | '7d' | '30d' (default: '1d')
 *
 * Example:
 * GET /api/positions/history?from=1700000000000&to=1702592000000&interval=1d
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { withRequestLogging } from '@/lib/api/handler';
import { globalCache } from '@/lib/cache';
import { logger } from '@/lib/logger';
import {
  validateAndNormalizeParams,
  bucketSnapshots,
  SnapshotHistoryResponse,
} from '@/lib/positions/snapshot';
import { getWalletSnapshots } from '@/src/jobs/snapshot.worker';

export const runtime = 'nodejs';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_SWR_MS = 10 * 60 * 1000; // 10 minutes (stale-while-revalidate)

/**
 * Generate cache key for position history
 */
function getCacheKey(walletAddress: string, params: Record<string, unknown>): string {
  const interval = params.interval || '1d';
  return `positions:history:${walletAddress}:${interval}`;
}

/**
 * Main handler for position history endpoint
 */
async function handlePositionHistory(request: NextRequest): Promise<NextResponse> {
  // 1. Authenticate user
  const user = await getUser();
  if (!user || !user.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Extract and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = validateAndNormalizeParams(searchParams);

    // 3. Check cache
    const cacheKey = getCacheKey(user.walletAddress, params);
    const cachedResponse = globalCache.get<SnapshotHistoryResponse>(cacheKey);

    if (cachedResponse) {
      logger.info('positions history cache hit', '/api/positions/history', {
        walletAddress: user.walletAddress,
        interval: params.interval,
        cacheKey,
      });

      return NextResponse.json(cachedResponse, {
        headers: { 'X-Cache': 'HIT' },
      });
    }

    // 4. Fetch snapshots from worker/database
    const allSnapshots = await getWalletSnapshots(user.walletAddress);

    if (allSnapshots.length === 0) {
      logger.warn('no snapshots found for wallet', '/api/positions/history', {
        walletAddress: user.walletAddress,
      });

      // Return empty response
      const emptyResponse: SnapshotHistoryResponse = {
        walletAddress: user.walletAddress,
        snapshots: [],
        interval: params.interval,
        bucketCount: 0,
      };

      // Cache empty responses too
      globalCache.set(cacheKey, emptyResponse, {
        ttl: CACHE_TTL_MS,
        swr: CACHE_SWR_MS,
      });

      return NextResponse.json(emptyResponse, {
        headers: { 'X-Cache': 'MISS' },
      });
    }

    // 5. Bucket snapshots by interval
    const bucketedSnapshots = bucketSnapshots(
      allSnapshots,
      params.from,
      params.to,
      params.interval
    );

    // 6. Format response
    const response: SnapshotHistoryResponse = {
      walletAddress: user.walletAddress,
      snapshots: bucketedSnapshots.map((s) => ({
        timestamp: s.timestamp,
        supplied: s.supplied,
        borrowed: s.borrowed,
        effectiveSupplyApy: s.effectiveSupplyApy,
        effectiveBorrowApy: s.effectiveBorrowApy,
      })),
      interval: params.interval,
      bucketCount: bucketedSnapshots.length,
    };

    // 7. Cache response
    globalCache.set(cacheKey, response, {
      ttl: CACHE_TTL_MS,
      swr: CACHE_SWR_MS,
    });

    logger.info('positions history retrieved', '/api/positions/history', {
      walletAddress: user.walletAddress,
      interval: params.interval,
      snapshotCount: response.bucketCount,
      rangeMs: params.to - params.from,
    });

    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('position history error', '/api/positions/history', {
      walletAddress: user?.walletAddress,
      error: errorMessage,
    });

    return NextResponse.json(
      {
        error: 'Bad Request',
        message: errorMessage,
      },
      { status: 400 }
    );
  }
}

export const GET = withRequestLogging('/api/positions/history', handlePositionHistory);
