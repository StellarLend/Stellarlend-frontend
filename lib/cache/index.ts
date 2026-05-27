export interface CacheOptions {
  ttl: number; // Time-to-Live in milliseconds
  swr: number; // Stale-While-Revalidate window in milliseconds
}

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  ttl: number;
  swr: number;
}

export class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private revalidatingKeys = new Set<string>();

  constructor() {}

  /**
   * Retrieves the raw value from the cache if it exists and is not fully expired.
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.createdAt;

    // If completely expired past the SWR window
    if (age >= entry.ttl + entry.swr) {
      return null;
    }

    return entry.value as T;
  }

  /**
   * Retrieves the full cache entry including metadata if not fully expired.
   */
  public getEntry<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.createdAt;

    if (age >= entry.ttl + entry.swr) {
      return null;
    }

    return entry as CacheEntry<T>;
  }

  /**
   * Stores a value in the cache with the given TTL and SWR parameters.
   */
  public set<T>(key: string, value: T, options: CacheOptions): void {
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      ttl: options.ttl,
      swr: options.swr,
    });
  }

  /**
   * Deletes an entry from the cache.
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears the cache completely.
   */
  public clear(): void {
    this.cache.clear();
    this.revalidatingKeys.clear();
  }

  /**
   * Returns the number of items in the cache.
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Checks if a key is currently undergoing background revalidation.
   */
  public isRevalidating(key: string): boolean {
    return this.revalidatingKeys.has(key);
  }

  /**
   * High-level utility to retrieve a cached item or fetch it from source,
   * managing TTL, SWR, concurrent background revalidation locks, and error recovery.
   */
  public async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<{ value: T; status: 'HIT' | 'STALE' | 'MISS' }> {
    const entry = this.cache.get(key);
    const now = Date.now();

    if (!entry) {
      // Miss: fetch synchronously
      const value = await fetcher();
      this.set(key, value, options);
      return { value, status: 'MISS' };
    }

    const age = now - entry.createdAt;

    if (age < entry.ttl) {
      // Fresh: absolute hit
      return { value: entry.value, status: 'HIT' };
    }

    // Stale but within SWR window
    if (age < entry.ttl + entry.swr) {
      // Trigger background revalidation if not already in progress
      if (!this.revalidatingKeys.has(key)) {
        this.revalidatingKeys.add(key);

        // Execute background fetch asynchronously
        fetcher()
          .then((freshValue) => {
            this.set(key, freshValue, options);
          })
          .catch((err) => {
            // Error resiliency: log error, but do not delete stale cache entry
            console.error(`Background revalidation failed for key "${key}":`, err);
          })
          .finally(() => {
            this.revalidatingKeys.delete(key);
          });
      }

      // Return the stale value immediately
      return { value: entry.value, status: 'STALE' };
    }

    // Completely expired: fetch synchronously (acts like a miss)
    try {
      const value = await fetcher();
      this.set(key, value, options);
      return { value, status: 'MISS' };
    } catch (err) {
      // Fallback to stale value as a safety measure instead of hard crash
      console.error(`Synchronous fetch failed for key "${key}". Falling back to stale value:`, err);
      return { value: entry.value, status: 'STALE' };
    }
  }
}

// Global shared cache instance
export const globalCache = new InMemoryCache();
