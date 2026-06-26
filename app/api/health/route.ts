import { NextResponse, NextRequest } from 'next/server';
import config from '@/lib/config';
import { httpGet, UpstreamHttpError, TimeoutError } from '@/lib/http';
import { withRequestLogging } from '@/lib/api/handler';
import { cacheHeaders, generateETag, isNotModified, notModifiedResponse } from '@/lib/api/etag';

export const runtime = 'nodejs';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

async function checkSorobanRpc(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    await httpGet(${config.stellar.sorobanRpcUrl}/health, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError) return 'degraded';
    if (err instanceof UpstreamHttpError) return 'degraded';
    return 'unhealthy';
  }
}

async function checkApi(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    await httpGet(${config.api.baseUrl}/health, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError) return 'degraded';
    if (err instanceof UpstreamHttpError) return 'degraded';
    return 'unhealthy';
  }
}

async function checkDatabase(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    await httpGet(${config.api.baseUrl}/health, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError) return 'degraded';
    if (err instanceof UpstreamHttpError) return 'degraded';
    return 'unhealthy';
  }
}

import { generateETag, isNotModified, cacheHeaders, notModifiedResponse } from '@/lib/api';

async function handleHealth(req: NextRequest) {
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

    // Stable fields for ETag calculation (excl. volatile timestamp)
    const stableFields = {
      status: overallStatus,
      environment: config.app.environment,
      version: config.app.version,
      checks: {
        database: dbStatus,
        api: apiStatus,
        stellar: stellarStatus,
      },
    };

    const etag = generateETag(stableFields);

    if (isNotModified(req, etag)) {
      return new NextResponse(null, notModifiedResponse(etag, 'public'));
    }

    const healthData = {
      ...stableFields,
      timestamp: new Date().toISOString(),
    };

    const httpStatus = healthData.status === 'healthy' ? 200 : 503;
    const headers = cacheHeaders(etag, 30, 'public');

    return NextResponse.json(healthData, {
      status: httpStatus,
      headers,
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
