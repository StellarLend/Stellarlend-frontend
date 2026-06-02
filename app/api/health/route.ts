import { NextResponse } from 'next/server';
import config from '@/lib/config';
import serverConfig from '@/lib/server-config';
import { httpGet, UpstreamHttpError, TimeoutError } from '@/lib/http';

export const runtime = 'nodejs';

async function checkHorizon(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  const results = await Promise.all(
    serverConfig.horizon.urls.map(async (url) => {
      try {
        await httpGet(`${url}/`, { timeoutMs: 5000, retries: 1 });
        return 'healthy' as const;
      } catch (err) {
        if (err instanceof TimeoutError) return 'degraded' as const;
        if (err instanceof UpstreamHttpError) return 'degraded' as const;
        return 'unhealthy' as const;
      }
    }),
  );

  if (results.includes('healthy')) return 'healthy';
  if (results.includes('degraded')) return 'degraded';
  return 'unhealthy';
}

async function checkSorobanRpc(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    await httpGet(`${config.stellar.sorobanRpcUrl}/health`, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError) return 'degraded';
    if (err instanceof UpstreamHttpError) return 'degraded';
    return 'unhealthy';
  }
}

async function checkApi(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    await httpGet(`${config.api.baseUrl}/health`, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError) return 'degraded';
    if (err instanceof UpstreamHttpError) return 'degraded';
    return 'unhealthy';
  }
}

async function checkDatabase(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    await httpGet(`${config.api.baseUrl}/health/db`, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError) return 'degraded';
    if (err instanceof UpstreamHttpError) return 'degraded';
    return 'unhealthy';
  }
}

export async function GET() {
  try {
    const [horizonStatus, sorobanStatus, apiStatus, dbStatus] = await Promise.all([
      checkHorizon(),
      checkSorobanRpc(),
      checkApi(),
      checkDatabase(),
    ]);

    const stellarStatus = horizonStatus === 'unhealthy' || sorobanStatus === 'unhealthy'
      ? 'unhealthy'
      : horizonStatus === 'degraded' || sorobanStatus === 'degraded'
      ? 'degraded'
      : 'healthy';

    const overallStatus =
      stellarStatus === 'unhealthy' || apiStatus === 'unhealthy' || dbStatus === 'unhealthy'
        ? 'unhealthy'
        : stellarStatus === 'degraded' || apiStatus === 'degraded' || dbStatus === 'degraded'
        ? 'degraded'
        : 'healthy';

    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: config.app.environment,
      version: config.app.version,
      checks: {
        database: dbStatus,
        api: apiStatus,
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
