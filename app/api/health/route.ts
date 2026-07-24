import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import config from '@/lib/config';
import { httpGet, UpstreamHttpError, TimeoutError } from '@/lib/http';
import { withRequestLogging } from '@/lib/api/handler';

export const runtime = 'nodejs';

async function checkHorizon(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    await httpGet(`${config.stellar?.horizonUrl || 'https://horizon-testnet.stellar.org'}/`, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError) return 'degraded';
    if (err instanceof UpstreamHttpError) return 'degraded';
    return 'unhealthy';
  }
}

async function checkSorobanRpc(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    const rpcUrl = config.stellar?.sorobanRpcUrl || 'https://private-rpc.test';
    await httpGet(`${rpcUrl}/health`, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError) return 'degraded';
    if (err instanceof UpstreamHttpError) return 'degraded';
    return 'unhealthy';
  }
}

async function checkApi(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    await httpGet(`${config.api?.baseUrl || 'http://localhost:3001'}/health`, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError) return 'degraded';
    if (err instanceof UpstreamHttpError) return 'degraded';
    return 'unhealthy';
  }
}

async function checkDatabase(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    await httpGet(`${config.api?.baseUrl || 'http://localhost:3001'}/health/db`, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError) return 'degraded';
    if (err instanceof UpstreamHttpError) return 'degraded';
    return 'unhealthy';
  }
}

async function handleHealth(request?: NextRequest) {
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
      environment: config.app?.environment ?? 'development',
      version: config.app?.version ?? '1.0.0',
      checks: {
        database: dbStatus,
        api: apiStatus,
        stellar: stellarStatus,
      },
    };

    const contentStr = JSON.stringify(healthData);
    const etag = `"${crypto.createHash('md5').update(contentStr).digest('hex')}"`;
    const ifNoneMatch = request?.headers?.get('if-none-match');

    const headers = new Headers({
      'Cache-Control': 'public, max-age=30',
      'ETag': etag,
      'Vary': 'Accept-Encoding',
      'Content-Type': 'application/json',
    });

    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    const httpStatus = healthData.status === 'unhealthy' ? 503 : 200;
    return new NextResponse(contentStr, {
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
