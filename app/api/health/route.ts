import { NextRequest, NextResponse } from 'next/server';
import config from '@/lib/config';
import { httpGet, UpstreamHttpError, TimeoutError } from '@/lib/http';
import { withRequestLogging } from '@/lib/api/handler';
import { cacheHeaders, generateETag, isNotModified, notModifiedResponse } from '@/lib/api/etag';

export const runtime = 'nodejs';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

async function checkUrl(url: string): Promise<HealthStatus> {
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

function combineStatuses(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('unhealthy')) return 'unhealthy';
  if (statuses.includes('degraded')) return 'degraded';
  return 'healthy';
}

async function handleHealth(request: NextRequest) {
  try {
    const [horizonStatus, sorobanStatus, apiStatus, dbStatus] = await Promise.all([
      checkUrl(`${config.stellar.horizonUrl}/`),
      checkUrl(`${(config.stellar as { sorobanRpcUrl?: string }).sorobanRpcUrl ?? config.stellar.horizonUrl}/health`),
      checkUrl(`${config.api.baseUrl}/health`),
      checkUrl(`${config.api.baseUrl}/health`),
    ]);

    const stellarStatus = combineStatuses([horizonStatus, sorobanStatus]);
    const overallStatus = combineStatuses([stellarStatus, apiStatus, dbStatus]);

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

    const httpStatus = healthData.status === 'healthy' ? 200 : 503;
    return NextResponse.json(healthData, {
      status: httpStatus,
      headers: cacheHeaders(etag, 30),
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

export const GET = withRequestLogging('/api/health', handleHealth);
