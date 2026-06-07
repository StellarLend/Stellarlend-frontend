import { Gauge, register } from 'prom-client';
import type { Pool } from 'pg';

function getOrCreateGauge(name: string, help: string) {
  const existing = register.getSingleMetric(name);
  if (existing) {
    return existing as Gauge<string>;
  }

  return new Gauge({
    name,
    help,
    registers: [register],
  });
}

export const dbPoolTotalGauge = getOrCreateGauge(
  'db_pool_total',
  'Total number of connections in the PostgreSQL pool',
);

export const dbPoolIdleGauge = getOrCreateGauge(
  'db_pool_idle',
  'Number of idle connections in the PostgreSQL pool',
);

export const dbPoolWaitingGauge = getOrCreateGauge(
  'db_pool_waiting',
  'Number of clients waiting for a PostgreSQL pool connection',
);

export function updateDbPoolMetrics(pool: Pool) {
  dbPoolTotalGauge.set(pool.totalCount);
  dbPoolIdleGauge.set(pool.idleCount);
  dbPoolWaitingGauge.set(pool.waitingCount);
}

export { register as metricsRegistry };
