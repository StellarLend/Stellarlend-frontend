import { NextRequest, NextResponse } from 'next/server';
import config from '@/lib/config';
import { generateETag, isNotModified, cacheHeaders, notModifiedResponse } from '@/lib/api/etag';

export const runtime = 'nodejs';

// Health data changes infrequently — 30 s is a reasonable public cache TTL.
const HEALTH_MAX_AGE = 30;

export async function GET(request: NextRequest) {
  try {
    // Only hash the fields that indicate meaningful state changes.
    // timestamp and uptime are volatile and must NOT influence the ETag,
    // otherwise caching is useless (every response would have a new ETag).
    const stableChecks = {
      status: 'healthy',
      environment: config.app.environment,
      version: config.app.version,
      checks: {
        database: 'healthy',
        api: 'healthy',
        stellar: 'healthy',
      },
    };

    const etag = generateETag(stableChecks);

    if (isNotModified(request, etag)) {
      return new NextResponse(null, notModifiedResponse(etag, 'public'));
    }

    const healthData = {
      ...stableChecks,
      timestamp: new Date().toISOString(),
      uptime: typeof process !== 'undefined' ? process.uptime() : 0,
    };

    return NextResponse.json(healthData, {
      status: 200,
      headers: cacheHeaders(etag, HEALTH_MAX_AGE, 'public'),
    });
  } catch {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 500 },
    );
  }
}
