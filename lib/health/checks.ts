import config from '@/lib/config';
import { httpGet, TimeoutError, UpstreamHttpError } from '@/lib/http';
import { pool } from '@/lib/db/pool';
import { updateDbPoolMetrics } from '@/lib/metrics/registry';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRIES = 1;

async function checkUrl(url: string): Promise<HealthStatus> {
  try {
    await httpGet(url, { timeoutMs: DEFAULT_TIMEOUT_MS, retries: DEFAULT_RETRIES });
    return 'healthy';
  } catch (err) {
    if (err instanceof TimeoutError || err instanceof UpstreamHttpError) {
      return 'degraded';
    }
    return 'unhealthy';
  }
}

export async function checkHorizon(): Promise<HealthStatus> {
  return checkUrl(`${config.stellar.horizonUrl}/`);
}

export async function checkSorobanRpc(): Promise<HealthStatus> {
  return checkUrl(`${config.stellar.sorobanRpcUrl}/health`);
}

export async function checkApi(): Promise<HealthStatus> {
  return checkUrl(`${config.api.baseUrl}/health`);
}

export async function checkDatabase(): Promise<HealthStatus> {
  try {
    await pool.query('SELECT 1');
    updateDbPoolMetrics(pool);
    return 'healthy';
  } catch (err) {
    updateDbPoolMetrics(pool);

    if (
      err instanceof Error &&
      /(timeout|timed out|connection.*refused|too many clients|could not connect)/i.test(err.message)
    ) {
      return 'degraded';
    }

    return 'unhealthy';
  }
}
