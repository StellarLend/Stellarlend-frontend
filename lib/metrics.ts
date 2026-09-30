// lib/metrics.ts
/**
 * Thin wrappers that record retention-deletion and HTTP-retry events into the
 * shared Prometheus-style Registry so they are exposed via /api/metrics.
 */
import { metrics } from '@/lib/metrics/registry';

type DeletionCounts = Record<string, number>;
type HttpRetryCounts = Record<string, number>;

/**
 * Record the number of rows deleted for a given table.
 * @param table - Table name (e.g. "audit_events")
 * @param count - Number of rows that were removed
 */
export function recordDeletion(table: string, count: number): void {
  if (count <= 0) return;
  metrics.deletionsTotal.inc({ table }, count);
  console.log(`[Metrics] ${count} rows deleted from ${table}`);
}

/**
 * Export the raw counts for external consumers (e.g. tests).
 * Reads back from the registry so the values are always consistent
 * with what /api/metrics exposes.
 */
export function getDeletionCounts(): DeletionCounts {
  const output = metrics.deletionsTotal.collect();
  const result: DeletionCounts = {};
  // Parse lines like: retention_deletions_total{table="audit_events"} 42
  for (const line of output.split('\n')) {
    const m = line.match(/^retention_deletions_total\{table="([^"]+)"\}\s+(\d+)/);
    if (m) result[m[1]] = Number(m[2]);
  }
  return result;
}

/**
 * Export HTTP retry counts for testing or metrics exposure (colon-separated).
 */
export function getHttpRetryCounts(): HttpRetryCounts {
  const output = metrics.httpRetryTotal.collect();
  const result: HttpRetryCounts = {};
  // Parse lines like: http_retry_total{method="GET",reason="429"} 3
  for (const line of output.split('\n')) {
    const m = line.match(/^http_retry_total\{method="([^"]+)",reason="([^"]+)"\}\s+(\d+)/);
    if (m) result[`${m[1]}:${m[2]}`] = Number(m[3]);
  }
  return result;
}

// ---------- HTTP Retry Metrics ----------

type HttpRetryKey = `${string}|${string}`; // method|reason

/**
 * Record an HTTP retry occurrence.
 * @param method - HTTP method (e.g. "GET")
 * @param reason - Reason for retry (e.g. "429" or "5xx")
 */
export function recordHttpRetry(method: string, reason: string): void {
  metrics.httpRetryTotal.inc({ method, reason });
  console.log(`[Metrics] http_retry_total method=${method} reason=${reason}`);
}

/** Retrieve the current HTTP retry counters (pipe-separated). */
export function getHttpRetryMetrics(): Record<HttpRetryKey, number> {
  const output = metrics.httpRetryTotal.collect();
  const result: Record<string, number> = {};
  for (const line of output.split('\n')) {
    const m = line.match(/^http_retry_total\{method="([^"]+)",reason="([^"]+)"\}\s+(\d+)/);
    if (m) result[`${m[1]}|${m[2]}` as HttpRetryKey] = Number(m[3]);
  }
  return result;
}

export function resetHttpRetryMetrics(): void {
  // No-op: the registry does not expose a reset on individual counters.
  // Tests that need isolation should reset the whole registry or mock it.
}
