// lib/metrics.ts
/**
 * Simple in‑process metric collector for retention deletions.
 * In a real deployment you would replace this with Prometheus `prom-client`
 * counters and expose them via an HTTP `/metrics` endpoint.
 */

type DeletionCounts = Record<string, number>;

const deletionCounts: DeletionCounts = {};

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
