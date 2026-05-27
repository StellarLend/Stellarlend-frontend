import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryCache } from './index';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });

  it('should initialize empty', () => {
    expect(cache.size()).toBe(0);
  });

  it('should set and get values correctly', () => {
    cache.set('key1', 'value1', { ttl: 1000, swr: 2000 });
    expect(cache.get('key1')).toBe('value1');
    expect(cache.size()).toBe(1);
  });

  it('should return null for non-existent keys', () => {
    expect(cache.get('non-existent')).toBeNull();
    expect(cache.getEntry('non-existent')).toBeNull();
  });

  it('should return null for completely expired keys on get', () => {
    cache.set('key1', 'value1', { ttl: 1000, swr: 2000 });
    
    // Manually age the entry to be completely expired (e.g. 3500ms old)
    const entry = cache.getEntry('key1')!;
    entry.createdAt = Date.now() - 3500;
    
    expect(cache.get('key1')).toBeNull();
  });

  it('should return null for completely expired keys on getEntry', () => {
    cache.set('key1', 'value1', { ttl: 1000, swr: 2000 });
    
    // Manually age the entry to be completely expired (e.g. 3500ms old)
    const entry = cache.getEntry('key1')!;
    entry.createdAt = Date.now() - 3500;
    
    expect(cache.getEntry('key1')).toBeNull();
  });

  it('should support manual deletion and clearing', () => {
    cache.set('key1', 'value1', { ttl: 1000, swr: 2000 });
    cache.set('key2', 'value2', { ttl: 1000, swr: 2000 });
    
    expect(cache.size()).toBe(2);
    
    expect(cache.delete('key1')).toBe(true);
    expect(cache.get('key1')).toBeNull();
    expect(cache.size()).toBe(1);
    
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('key2')).toBeNull();
  });

  describe('getOrFetch', () => {
    it('should fetch and cache on miss', async () => {
      const fetcher = vi.fn().mockResolvedValue('fresh_data');
      
      const result = await cache.getOrFetch('key1', fetcher, { ttl: 1000, swr: 2000 });
      
      expect(result).toEqual({ value: 'fresh_data', status: 'MISS' });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('fresh_data');
    });

    it('should return cached value synchronously on fresh hit without calling fetcher', async () => {
      cache.set('key1', 'cached_data', { ttl: 1000, swr: 2000 });
      const fetcher = vi.fn().mockResolvedValue('fresh_data');
      
      const result = await cache.getOrFetch('key1', fetcher, { ttl: 1000, swr: 2000 });
      
      expect(result).toEqual({ value: 'cached_data', status: 'HIT' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should return stale value and trigger background revalidation during SWR window', async () => {
      cache.set('key1', 'stale_data', { ttl: 1000, swr: 2000 });
      
      // Manually age the entry to be inside the SWR window (e.g. 1500ms old)
      const entry = cache.getEntry('key1')!;
      entry.createdAt = Date.now() - 1500;
      
      let resolveFetcher: (val: string) => void = () => {};
      const fetcherPromise = new Promise<string>((resolve) => {
        resolveFetcher = resolve;
      });
      const fetcher = vi.fn().mockReturnValue(fetcherPromise);
      
      const result = await cache.getOrFetch('key1', fetcher, { ttl: 1000, swr: 2000 });
      
      // Should immediately return stale value
      expect(result).toEqual({ value: 'stale_data', status: 'STALE' });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cache.isRevalidating('key1')).toBe(true);

      // Now resolve the background fetcher
      resolveFetcher('new_data');
      
      // Wait for background fetcher promise chain to finish
      await fetcherPromise;
      // Flush the microtask queue multiple times to let all chained promise callbacks complete
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
      
      // Revalidation lock should be released and cache updated
      expect(cache.isRevalidating('key1')).toBe(false);
      expect(cache.get('key1')).toBe('new_data');
    });

    it('should prevent concurrent background revalidations (revalidation lock)', async () => {
      cache.set('key1', 'stale_data', { ttl: 1000, swr: 2000 });
      
      const entry = cache.getEntry('key1')!;
      entry.createdAt = Date.now() - 1500;

      const fetcher = vi.fn().mockReturnValue(new Promise(() => {})); // Never resolves
      
      // Call first time
      const res1 = await cache.getOrFetch('key1', fetcher, { ttl: 1000, swr: 2000 });
      // Call second time immediately
      const res2 = await cache.getOrFetch('key1', fetcher, { ttl: 1000, swr: 2000 });

      expect(res1.status).toBe('STALE');
      expect(res2.status).toBe('STALE');
      // Fetcher should have been called only once due to the lock
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should be resilient and keep stale value if background revalidation fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cache.set('key1', 'stale_data', { ttl: 1000, swr: 2000 });
      
      const entry = cache.getEntry('key1')!;
      entry.createdAt = Date.now() - 1500;

      const rejectError = new Error('Network failure');
      const fetcherPromise = Promise.reject(rejectError);
      const fetcher = vi.fn().mockReturnValue(fetcherPromise);
      
      const result = await cache.getOrFetch('key1', fetcher, { ttl: 1000, swr: 2000 });
      expect(result).toEqual({ value: 'stale_data', status: 'STALE' });
      
      // Wait for rejection logic to execute
      try {
        await fetcherPromise;
      } catch (err) {
        // Ignored in wait
      }
      await Promise.resolve(); // Flush microtask queue
      
      // Old stale data must still be kept, and lock released
      expect(cache.get('key1')).toBe('stale_data');
      expect(cache.isRevalidating('key1')).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should perform synchronous fetch and update cache when completely expired', async () => {
      cache.set('key1', 'stale_data', { ttl: 1000, swr: 2000 });
      
      const entry = cache.getEntry('key1')!;
      entry.createdAt = Date.now() - 3500; // Aged past TTL + SWR (3000ms)
      
      const fetcher = vi.fn().mockResolvedValue('super_fresh_data');
      
      const result = await cache.getOrFetch('key1', fetcher, { ttl: 1000, swr: 2000 });
      
      // Must be MISS because we fetched synchronously
      expect(result).toEqual({ value: 'super_fresh_data', status: 'MISS' });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('super_fresh_data');
    });

    it('should fallback to stale data if synchronous revalidation of fully expired key fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cache.set('key1', 'stale_data', { ttl: 1000, swr: 2000 });
      
      const entry = cache.getEntry('key1')!;
      entry.createdAt = Date.now() - 3500; // Aged past TTL + SWR (3000ms)

      const fetcher = vi.fn().mockRejectedValue(new Error('Failed to reach server'));

      const result = await cache.getOrFetch('key1', fetcher, { ttl: 1000, swr: 2000 });

      // Should fall back to return stale value with status STALE
      expect(result).toEqual({ value: 'stale_data', status: 'STALE' });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
