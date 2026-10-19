import type { PositionSummary, ProtocolMetrics } from "./lending";

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Small in-memory TTL cache with LRU eviction and single-flight loading.
 *
 * Serverless instances each keep their own cache; the edge `Cache-Control`
 * headers provide the shared layer. `getOrLoad` collapses concurrent misses for
 * the same key onto one upstream call.
 */
export class TtlSingleFlightCache<K, V> {
  private entries = new Map<K, CacheEntry<V>>();
  private inflight = new Map<K, Promise<V>>();

  constructor(private readonly maxEntries: number) {
    if (maxEntries < 1) {
      throw new Error("maxEntries must be at least 1");
    }
  }

  async getOrLoad(
    key: K,
    ttlMs: number,
    load: () => Promise<V>,
    now: number = Date.now(),
  ): Promise<V> {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > now) {
      // Refresh insertion order so the least-recently-used entry is evicted.
      this.entries.delete(key);
      this.entries.set(key, entry);
      return entry.value;
    }
    if (entry) {
      this.entries.delete(key);
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const value = await load();
        this.entries.set(key, { value, expiresAt: now + ttlMs });
        this.evict();
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }

  private evict(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) return;
      this.entries.delete(oldest.value);
    }
  }
}

const PROTOCOL_TTL_MS = 15_000;
const POSITION_TTL_MS = 10_000;

export const protocolCache = new TtlSingleFlightCache<string, ProtocolMetrics>(1);
export const positionCache = new TtlSingleFlightCache<string, PositionSummary>(500);

export const PROTOCOL_TTL = PROTOCOL_TTL_MS;
export const POSITION_TTL = POSITION_TTL_MS;

/** Test helper: drop every cached value and in-flight promise. */
export function resetApiCaches(): void {
  protocolCache.clear();
  positionCache.clear();
}
