export interface CacheOptions {
  ttl: number;
  swr: number;
}

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  ttl: number;
  swr: number;
}

export const DEFAULT_TTL_MS = 60000;

export class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private revalidatingKeys = new Set<string>();

  constructor() {}

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.createdAt;

    if (age >= entry.ttl + entry.swr) {
      return null;
    }

    return entry.value as T;
  }

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

  public set<T>(key: string, value: T, options: CacheOptions | number = DEFAULT_TTL_MS): void {
    const opts: CacheOptions =
      typeof options === 'number'
        ? { ttl: options, swr: 0 }
        : options;

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      ttl: opts.ttl,
      swr: opts.swr,
    });
  }

  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
    this.revalidatingKeys.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  public isRevalidating(key: string): boolean {
    return this.revalidatingKeys.has(key);
  }

  public async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<{ value: T; status: 'HIT' | 'STALE' | 'MISS' }> {
    const entry = this.cache.get(key);
    const now = Date.now();

    if (!entry) {
      const value = await fetcher();
      this.set(key, value, options);
      return { value, status: 'MISS' };
    }

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

    try {
      const value = await fetcher();
      this.set(key, value, options);
      return { value, status: 'MISS' };
    } catch (err) {
      console.error(`Synchronous fetch failed for key "${key}". Falling back to stale value:`, err);
      return { value: entry.value, status: 'STALE' };
    }
  }
}

export const SimpleCache = InMemoryCache;
export const globalCache = new InMemoryCache();
export default InMemoryCache;