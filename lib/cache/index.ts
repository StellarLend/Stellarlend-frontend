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
  private pendingFetches = new Map<
    string,
    Promise<{ value: any; status: 'HIT' | 'STALE' | 'MISS' }>
  >();

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
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Invalidates all keys that belong to the provided namespaces.
   * A namespace matches a key when the key is exactly the namespace
   * or when it starts with `${namespace}:` (covers nested keys like `markets:assets:XLM`).
   * Returns the number of deleted keys.
   */
  public invalidateNamespaces(namespaces: string[]): number {
    if (!namespaces || namespaces.length === 0) return 0;

    const toDelete: string[] = [];

    for (const key of this.cache.keys()) {
      for (const ns of namespaces) {
        if (!ns || typeof ns !== 'string') continue;
        if (key === ns || key.startsWith(`${ns}:`)) {
          toDelete.push(key);
          break;
        }
      }
    }

    for (const k of toDelete) {
      this.cache.delete(k);
      this.revalidatingKeys.delete(k);
    }

    return toDelete.length;
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
      this.cache.delete(key);
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
    this.pendingFetches.clear();
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
    const existingFetch = this.pendingFetches.get(key) as
      | Promise<{ value: T; status: 'HIT' | 'STALE' | 'MISS' }>
      | undefined;

    if (existingFetch) {
      return existingFetch;
    }

    const entry = this.cache.get(key);
    const now = Date.now();

    if (entry) {
      const age = now - entry.createdAt;

      if (age < entry.ttl) {
        return { value: entry.value, status: 'HIT' };
      }

      if (age < entry.ttl + entry.swr) {
        if (!this.revalidatingKeys.has(key)) {
          this.revalidatingKeys.add(key);

          fetcher()
            .then((freshValue) => {
              this.set(key, freshValue, options);
            })
            .catch((err) => {
              console.error(`Background revalidation failed for key "${key}":`, err);
            })
            .finally(() => {
              this.revalidatingKeys.delete(key);
            });
        }

        return { value: entry.value, status: 'STALE' };
      }
    }

    const fetchPromise = (async () => {
      try {
        const value = await fetcher();
        this.set(key, value, options);
        return { value, status: 'MISS' } as const;
      } catch (err) {
        if (entry) {
          console.error(
            `Synchronous fetch failed for key "${key}". Falling back to stale value:`,
            err,
          );
          return { value: entry.value, status: 'STALE' } as const;
        }
        throw err;
      }
    })();

    this.pendingFetches.set(key, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.pendingFetches.delete(key);
    }
  }
}

// Global shared cache instance
export const globalCache = new InMemoryCache();
