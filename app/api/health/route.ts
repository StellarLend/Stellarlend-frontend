import { NextRequest, NextResponse } from 'next/server';
import config from '@/lib/config';
import { withRequestLogging } from '@/lib/api/handler';
import {
  checkApi,
  checkDatabase,
  checkHorizon,
  checkSorobanRpc,
} from '@/lib/health/checks';

export const runtime = 'nodejs';

async function handleHealth(_request: NextRequest) {
  try {
    const [horizonStatus, sorobanStatus, apiStatus, dbStatus] = await Promise.all([
      checkHorizon(),
      checkSorobanRpc(),
      checkApi(),
      checkDatabase(),
    ]);

    const stellarStatus =
      horizonStatus === 'unhealthy' || sorobanStatus === 'unhealthy'
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

export const GET = withRequestLogging('/api/health', handleHealth);
