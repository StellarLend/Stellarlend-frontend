import { NextRequest, NextResponse } from 'next/server';
import config from '@/lib/config';
import serverConfig from '@/lib/server-config';
import { cacheHeaders, generateETag, isNotModified, notModifiedResponse } from '@/lib/api/etag';
import { withRequestLogging } from '@/lib/api/handler';
import { httpGet, TimeoutError, UpstreamHttpError } from '@/lib/http';

export const runtime = 'nodejs';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

async function checkUpstream(url: string): Promise<HealthStatus> {
  try {
    await httpGet(url, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof UpstreamHttpError) {
      return 'degraded';
    }

    return 'unhealthy';
  }
}

async function checkHorizon(): Promise<HealthStatus> {
  return checkUpstream(`${config.stellar.horizonUrl}/`);
}

async function checkSorobanRpc(): Promise<HealthStatus> {
  return checkUpstream(`${serverConfig.stellar.sorobanRpcUrl}/health`);
}

async function checkApi(): Promise<HealthStatus> {
  return checkUpstream(`${config.api.baseUrl}/health`);
}

async function checkDatabase(): Promise<HealthStatus> {
  return checkUpstream(`${config.api.baseUrl}/health/db`);
}

function combineStatus(...statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('unhealthy')) {
    return 'unhealthy';
  }

  if (statuses.includes('degraded')) {
    return 'degraded';
  }

  return 'healthy';
}

async function handleHealth(request: NextRequest) {
  const [horizonStatus, sorobanStatus, apiStatus, dbStatus] = await Promise.all([
    checkHorizon(),
    checkSorobanRpc(),
    checkApi(),
    checkDatabase(),
  ]);

  const stellarStatus = combineStatus(horizonStatus, sorobanStatus);
  const overallStatus = combineStatus(stellarStatus, apiStatus, dbStatus);
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
  const etag = generateETag(healthData);

  if (isNotModified(request, etag)) {
    return new NextResponse(null, notModifiedResponse(etag));
  }

  return NextResponse.json(healthData, {
    status: overallStatus === 'healthy' ? 200 : 503,
    headers: cacheHeaders(etag, 30, 'public'),
  });
}

export const GET = withRequestLogging('/api/health', handleHealth);
