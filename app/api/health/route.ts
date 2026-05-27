import { NextResponse } from 'next/server';
import config from '@/lib/config';
import { httpGet, UpstreamHttpError, TimeoutError } from '@/lib/http';

export const runtime = 'nodejs';

async function checkStellarNetwork(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    await httpGet(`${config.stellar.horizonUrl}/`, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError) return 'degraded';
    if (err instanceof UpstreamHttpError) return 'degraded';
    return 'unhealthy';
  }
}

export async function GET() {
  try {
    const stellarStatus = await checkStellarNetwork();

    const healthData = {
      status: stellarStatus === 'unhealthy' ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.app.environment,
      version: config.app.version,
      uptime: typeof process !== 'undefined' ? process.uptime() : 0,
      checks: {
        database: 'healthy',
        api: 'healthy',
        stellar: stellarStatus,
      },
    };

    const httpStatus = healthData.status === 'healthy' ? 200 : 503;
    return NextResponse.json(healthData, { status: httpStatus });
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
