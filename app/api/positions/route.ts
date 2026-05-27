import { NextRequest, NextResponse } from 'next/server';
import { globalCache } from '../../../lib/cache';

// Mock upstream fetcher for positions with simulated network delay
async function fetchUpstreamPositions(userId: string | null): Promise<any> {
  // Simulate 500ms upstream database/blockchain fetch delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const isUserSpecific = !!userId;

  return {
    positions: {
      supplied: isUserSpecific ? 12500.00 : 5000.00,
      borrowed: isUserSpecific ? 4200.00 : 1500.00,
      availableBalance: isUserSpecific ? 8300.00 : 3750.00,
      collateralRatio: isUserSpecific ? 297.62 : 333.33,
      healthFactor: isUserSpecific ? 1.48 : 1.67,
    },
    userId: userId || 'anonymous',
    timestamp: new Date().toISOString(),
    mode: isUserSpecific ? 'authenticated' : 'public',
    source: 'Upstream ledger (Simulated)',
  };
}

export async function GET(request: NextRequest) {
  try {
    // Security & Session Check:
    // We check for any session/authorization token to determine if the request is authenticated.
    const authHeader = request.headers.get('Authorization');
    const hasAuthCookie = request.cookies.has('session') || request.cookies.has('token');
    const hasUserHeader = request.headers.has('x-user-id');
    
    // We also check if there is an explicit request query parameter bypass, or if a user ID is supplied.
    const { searchParams } = new URL(request.url);
    const userIdQuery = searchParams.get('userId') || '';
    
    const isAuthenticated = !!(authHeader || hasAuthCookie || hasUserHeader || userIdQuery);

    if (isAuthenticated) {
      // Authenticated User-Specific Data: Bypass the server-side cache entirely.
      // This ensures the logged-in user always gets their exact real-time balances.
      const userId = userIdQuery || request.headers.get('x-user-id') || 'auth-user';
      const freshData = await fetchUpstreamPositions(userId);
      
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
    const cacheKey = 'positions:public:all';

    // Caching configuration: TTL = 10 seconds, SWR = 20 seconds
    const cacheOptions = {
      ttl: 10 * 1000,
      swr: 20 * 1000,
    };

    const { value, status } = await globalCache.getOrFetch(
      cacheKey,
      () => fetchUpstreamPositions(null),
      cacheOptions
    );

    return NextResponse.json(value, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
        'X-Cache': status,
      },
    });
  } catch (error) {
    console.error('Positions API route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}
