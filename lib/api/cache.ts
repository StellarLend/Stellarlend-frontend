import type { MarketsSnapshot, PositionSummary, ProtocolMetrics } from "./lending";

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
  staleUntil: number;
}

export interface CacheResult<V> {
  value: V;
  isStale: boolean;
}

export interface TtlSingleFlightCacheOptions {
  staleIfErrorMs?: number;
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
  private inflight = new Map<K, Promise<CacheResult<V>>>();
  private readonly staleIfErrorMs: number;

  constructor(
    private readonly maxEntries: number,
    options: TtlSingleFlightCacheOptions = {},
  ) {
    if (maxEntries < 1) {
      throw new Error("maxEntries must be at least 1");
    }
    const staleIfErrorMs = options.staleIfErrorMs ?? 0;
    if (!Number.isFinite(staleIfErrorMs) || staleIfErrorMs < 0) {
      throw new Error("staleIfErrorMs must be a non-negative finite number");
    }
    this.staleIfErrorMs = staleIfErrorMs;
  }

  async getOrLoad(
    key: K,
    ttlMs: number,
    load: () => Promise<V>,
    now: number = Date.now(),
  ): Promise<V> {
    const result = await this.getOrLoadWithMeta(key, ttlMs, load, now);
    return result.value;
  }

  async getOrLoadWithMeta(
    key: K,
    ttlMs: number,
    load: () => Promise<V>,
    now: number = Date.now(),
  ): Promise<CacheResult<V>> {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > now) {
      // Refresh insertion order so the least-recently-used entry is evicted.
      this.entries.delete(key);
      this.entries.set(key, entry);
      return { value: entry.value, isStale: false };
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const value = await load();
        const expiresAt = now + ttlMs;
        this.entries.set(key, {
          value,
          expiresAt,
          staleUntil: expiresAt + this.staleIfErrorMs,
        });
        this.evict();
        return { value, isStale: false };
      } catch (error) {
        const currentEntry = this.entries.get(key);
        if (entry && currentEntry === entry && entry.staleUntil > now) {
          this.entries.delete(key);
          this.entries.set(key, entry);
          return { value: entry.value, isStale: true };
        }
        if (currentEntry === entry) {
          this.entries.delete(key);
        }
        throw error;
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
const MARKETS_TTL_MS = 15_000;
export const PROTOCOL_STALE_IF_ERROR_MS = 60_000;
export const POSITION_STALE_IF_ERROR_MS = 30_000;
export const MARKETS_STALE_IF_ERROR_MS = 60_000;

export const protocolCache = new TtlSingleFlightCache<string, ProtocolMetrics>(1, {
  staleIfErrorMs: PROTOCOL_STALE_IF_ERROR_MS,
});
export const positionCache = new TtlSingleFlightCache<string, PositionSummary>(500, {
  staleIfErrorMs: POSITION_STALE_IF_ERROR_MS,
});
export const marketsCache = new TtlSingleFlightCache<string, MarketsSnapshot>(1, {
  staleIfErrorMs: MARKETS_STALE_IF_ERROR_MS,
});

export const PROTOCOL_TTL = PROTOCOL_TTL_MS;
export const POSITION_TTL = POSITION_TTL_MS;
export const MARKETS_TTL = MARKETS_TTL_MS;

/** Test helper: drop every cached value and in-flight promise. */
export function resetApiCaches(): void {
  protocolCache.clear();
  positionCache.clear();
  marketsCache.clear();
}
