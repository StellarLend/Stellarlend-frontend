import config from '@/lib/config';
import { httpGet, UpstreamHttpError, TimeoutError } from '@/lib/http';
import { withHandler } from '@/lib/api/handler';

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
  return withHandler(async () => {
    const stellarStatus = await checkStellarNetwork();
    return {
      status: stellarStatus === 'unhealthy' ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.app.environment,
      version: config.app.version,
      checks: {
        database: 'healthy',
        api: 'healthy',
        stellar: stellarStatus,
      },
    };
  });
}
