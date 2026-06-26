import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '../../../lib/auth';
import { globalCache } from '@/lib/cache';
import { withRequestLogging } from '@/lib/api/handler';

async function handlePositions(request: NextRequest) {
  try {
    let userId: string | null = null;
    
    if (request) {
      // 1. Try x-user-id header
      userId = request.headers.get('x-user-id');
      
      // 2. Try userId query parameter
      if (!userId && request.url) {
        try {
          const { searchParams } = new URL(request.url);
          userId = searchParams.get('userId');
        } catch (e) {
          // Ignore URL parsing issues
        }
      }
    }
    
    // 3. Try session
    if (!userId) {
      const user = await getUser();
      if (user) {
        userId = user.id || 'authenticated-user';
      }
    }
    
    const isPublicAllowed = request?.headers?.get('x-public-positions') === 'true';
    if (!userId && !isPublicAllowed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mockPositions = [
      {
        availableBalance: '$3,750.00 XLM',
        copyAddress: 'BaDE1b2U45...670UzZ',
        borrowedAmount: '$1,500.00 XLM',
        nextDue: '$250.00 in 4 days',
        suppliedFunds: '$5,000.00 XLM',
        earnings: '$95.00 XLM',
        healthFactor: 1.5,
      }
    ];

    const payloadData = mockPositions[0];

    if (userId) {
      // Authenticated bypasses cache
      return NextResponse.json({
        positions: mockPositions,
        ...payloadData,
        userId,
        mode: 'authenticated',
      }, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'X-Cache': 'BYPASS',
        },
      });
    }

    // Public cached positions
    const { value: cacheVal, status: cacheStatus } = await globalCache.getOrFetch(
      'public-positions-cache-key',
      async () => ({
        positions: mockPositions,
        ...payloadData,
        userId: 'anonymous',
        mode: 'public',
      }),
      { ttl: 10000, swr: 20000 }
    );

    return NextResponse.json(cacheVal, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
        'X-Cache': cacheStatus,
      },
    });
  } catch (error) {
    console.error('Positions route error:', error);
    return NextResponse.json({
      error: 'Failed to fetch positions',
    }, {
      status: 500,
    });
  }
}

export const GET = withRequestLogging('/api/positions', handlePositions);
