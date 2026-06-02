// lib/metrics.ts
/**
 * Simple in‑process metric collector for retention deletions and HTTP retries.
 * In a real deployment you would replace this with Prometheus `prom-client`
 * counters and expose them via an HTTP `/metrics` endpoint.
 */

type DeletionCounts = Record<string, number>;
type HttpRetryCounts = Record<string, number>;

const deletionCounts: DeletionCounts = {};
const httpRetryCounts: HttpRetryCounts = {};

/**
 * Record the number of rows deleted for a given table.
 * @param table - Table name (e.g. "audit_events")
 * @param count - Number of rows that were removed
 */
export function recordDeletion(table: string, count: number): void {
  if (count <= 0) return;
  deletionCounts[table] = (deletionCounts[table] ?? 0) + count;
  // For now we just log – a proper metrics library can read `deletionCounts`.
  console.log(`[Metrics] ${count} rows deleted from ${table}`);
}

/**
 * Export the raw counts for external consumers (e.g. tests or a metrics endpoint).
 */
export function getDeletionCounts(): DeletionCounts {
  return { ...deletionCounts };
}

/**
 * Export HTTP retry counts for testing or metrics exposure (colon-separated).
 */
export function getHttpRetryCounts(): HttpRetryCounts {
  return { ...httpRetryCounts };
}

// ---------- HTTP Retry Metrics ----------
/**
 * Simple in‑process collector for HTTP retry counts.
 * In production replace with a proper Prometheus `Counter`.
 */
type HttpRetryKey = `${string}|${string}`; // method|reason

const httpRetryCounters: Record<HttpRetryKey, number> = {};

/**
 * Record an HTTP retry occurrence.
 * @param method - HTTP method (e.g. "GET")
 * @param reason - Reason for retry (e.g. "429" or "5xx")
 */
export function recordHttpRetry(method: string, reason: string): void {
  // Colon-separated format used by some tests
  const keyColon = `${method}:${reason}`;
  httpRetryCounts[keyColon] = (httpRetryCounts[keyColon] ?? 0) + 1;

  // Pipe-separated format for http_retry_total metric label compliance
  const keyPipe = `${method}|${reason}` as HttpRetryKey;
  httpRetryCounters[keyPipe] = (httpRetryCounters[keyPipe] ?? 0) + 1;

  console.log(`[Metrics] http_retry_total method=${method} reason=${reason}`);
}

/** Retrieve the current HTTP retry counters (pipe-separated). */
export function getHttpRetryMetrics(): Record<HttpRetryKey, number> {
  return { ...httpRetryCounters };
}

