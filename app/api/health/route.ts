import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import config from '@/lib/config';
import { httpGet } from '@/lib/http';
import { withRequestLogging } from '@/lib/api/handler';

export const runtime = 'nodejs';

async function checkSorobanRpc(): Promise<'healthy' | 'degraded'> {
  try {
    const rpcUrl =
      config.stellar?.sorobanRpcUrl ||
      process.env.SOROBAN_RPC_URL ||
      process.env.STELLAR_SOROBAN_RPC_URL ||
      'https://private-rpc.test';
    const cleanUrl = rpcUrl.replace(/\/$/, '');
    await httpGet(`${cleanUrl}/health`, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch {
    return 'degraded';
  }
}

async function checkHorizon(): Promise<'healthy' | 'degraded'> {
  try {
    const horizonUrl =
      config.stellar?.horizonUrl ||
      process.env.STELLAR_HORIZON_URL ||
      process.env.HORIZON_URL ||
      'https://horizon-testnet.stellar.org';
    const cleanUrl = horizonUrl.endsWith('/') ? horizonUrl : `${horizonUrl}/`;
    await httpGet(cleanUrl, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch {
    return 'degraded';
  }
}

async function checkApi(): Promise<'healthy' | 'degraded'> {
  try {
    const baseUrl = config.api?.baseUrl || process.env.API_BASE_URL || 'http://localhost:3001';
    await httpGet(`${baseUrl}/health`, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch {
    return 'degraded';
  }
}

async function checkDatabase(): Promise<'healthy' | 'degraded'> {
  try {
    const baseUrl = config.api?.baseUrl || process.env.API_BASE_URL || 'http://localhost:3001';
    await httpGet(`${baseUrl}/health/db`, { timeoutMs: 5000, retries: 1 });
    return 'healthy';
  } catch {
    return 'degraded';
  }
}

async function handleHealth(request: NextRequest) {
  try {
    const sorobanStatus = await checkSorobanRpc();
    const horizonStatus = await checkHorizon();
    const apiStatus = await checkApi();
    const dbStatus = await checkDatabase();

    const stellarStatus =
      horizonStatus === 'healthy' && sorobanStatus === 'healthy' ? 'healthy' : 'degraded';
    const overallStatus =
      stellarStatus === 'healthy' && apiStatus === 'healthy' && dbStatus === 'healthy'
        ? 'healthy'
        : 'degraded';

    const healthChecks = {
      database: dbStatus,
      api: apiStatus,
      stellar: stellarStatus,
    };

    const etagBase = JSON.stringify({
      status: overallStatus,
      environment: config.app?.environment ?? 'development',
      version: config.app?.version ?? '1.0.0',
      checks: healthChecks,
    });

    const etag = `"${crypto.createHash('md5').update(etagBase).digest('hex')}"`;
    const ifNoneMatch = request?.headers?.get('if-none-match');

    const headers = new Headers({
      'Cache-Control': 'public, max-age=30',
      'ETag': etag,
      'Vary': 'Accept-Encoding',
    });

    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: config.app?.environment ?? 'development',
      version: config.app?.version ?? '1.0.0',
      checks: healthChecks,
    };

    headers.set('Content-Type', 'application/json');

    return new NextResponse(JSON.stringify(healthData), {
      status: 200,
      headers,
    });
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'degraded',
          api: 'degraded',
          stellar: 'degraded',
        },
      },
      { status: 200 }
    );
  }
}

export const GET = withRequestLogging('/api/health', handleHealth);