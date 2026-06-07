import { Pool } from 'pg';
import serverConfig from '@/lib/server-config';
import { updateDbPoolMetrics } from '@/lib/metrics/registry';

const connectionString = serverConfig.db.connectionString;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for PostgreSQL connection pooling.');
}

export const pool = new Pool({
  connectionString,
  max: serverConfig.db.max,
  idleTimeoutMillis: serverConfig.db.idleTimeoutMs,
  connectionTimeoutMillis: serverConfig.db.connectionTimeoutMs,
});

updateDbPoolMetrics(pool);

const POOL_METRICS_INTERVAL_MS = 5000;

declare global {
  // eslint-disable-next-line no-var
  var __stellarlend_db_pool_metrics_interval?: ReturnType<typeof setInterval>;
}

function ensurePoolMetricsPolling() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (!globalThis.__stellarlend_db_pool_metrics_interval) {
    globalThis.__stellarlend_db_pool_metrics_interval = setInterval(() => {
      updateDbPoolMetrics(pool);
    }, POOL_METRICS_INTERVAL_MS);
    globalThis.__stellarlend_db_pool_metrics_interval.unref?.();
  }
}

ensurePoolMetricsPolling();

export const getPool = () => pool;
