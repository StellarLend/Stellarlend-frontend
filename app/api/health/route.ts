import { NextResponse } from 'next/server';
import config from '@/lib/config';
import { httpFetch, isUpstreamError } from '@/lib/http';

export const runtime = 'nodejs';

async function checkStellarNetwork(): Promise<'healthy' | 'degraded'> {
  try {
    await httpFetch(`${config.stellar.horizonUrl}`, { maxRetries: 1, timeoutMs: 5000 });
    return 'healthy';
  } catch {
    return 'degraded';
  }
}

export async function GET() {
  try {
    const stellarStatus = await checkStellarNetwork();

    const healthData = {
      status: stellarStatus === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: config.app.environment,
      version: config.app.version,
      uptime: typeof process !== 'undefined' ? process.uptime() : 0,
      checks: {
        api: 'healthy',
        stellar: stellarStatus,
      },
    };

    return NextResponse.json(healthData, { status: 200 });
  } catch (error) {
    const detail = isUpstreamError(error) ? error.message : 'Health check failed';
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: detail,
      },
      { status: 500 }
    );
  }
}
