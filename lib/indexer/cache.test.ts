import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IndexerCache, DEFAULT_TTL_MS } from './cache';

describe('IndexerCache', () => {
  let cache: IndexerCache<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new IndexerCache<string>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get / set', () => {
    it('returns the stored value for an existing key', () => {
      cache.set('key-a', 'value-a');
      expect(cache.get('key-a')).toBe('value-a');
    });

    it('returns null for a key that was never set', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('returns null after the default TTL elapses', () => {
      cache.set('key-b', 'value-b');
      vi.advanceTimersByTime(DEFAULT_TTL_MS + 1);
      expect(cache.get('key-b')).toBeNull();
    });

    it('returns the value before the default TTL elapses', () => {
      cache.set('key-c', 'value-c');
      vi.advanceTimersByTime(DEFAULT_TTL_MS - 1);
      expect(cache.get('key-c')).toBe('value-c');
    });

    it('overwrites an existing key with a new value and resets its TTL', () => {
      cache.set('key-d', 'old-value', 10_000);
      vi.advanceTimersByTime(9_000);
      cache.set('key-d', 'new-value', 10_000);
      vi.advanceTimersByTime(9_000);
      expect(cache.get('key-d')).toBe('new-value');
    });

    it('evicts on read only for the exact expired key, not others', () => {
      cache.set('key-e', 'value-e', 10_000);
      cache.set('key-f', 'value-f', 30_000);
      vi.advanceTimersByTime(15_000);
      expect(cache.get('key-e')).toBeNull();
      expect(cache.get('key-f')).toBe('value-f');
    });

    it('handles storing and retrieving complex types', () => {
      const objectCache = new IndexerCache<{ id: number; name: string }>();
      const obj = { id: 42, name: 'test' };
      objectCache.set('obj', obj);
      expect(objectCache.get('obj')).toEqual(obj);
    });
  });

  describe('custom per-key TTL', () => {
    it('respects a shorter per-key TTL than the default', () => {
      cache.set('short', 'short-lived', 5_000);
      vi.advanceTimersByTime(5_001);
      expect(cache.get('short')).toBeNull();
    });

    it('respects a longer per-key TTL than the default', () => {
      cache.set('long', 'long-lived', DEFAULT_TTL_MS * 2);
      vi.advanceTimersByTime(DEFAULT_TTL_MS + 1);
      expect(cache.get('long')).toBe('long-lived');
    });

    it('allows mixing default and custom TTLs in the same cache', () => {
      cache.set('default-ttl', 'default');
      cache.set('custom-ttl', 'custom', DEFAULT_TTL_MS * 2);
      vi.advanceTimersByTime(DEFAULT_TTL_MS + 1);
      expect(cache.get('default-ttl')).toBeNull();
      expect(cache.get('custom-ttl')).toBe('custom');
    });

    it('accepts a zero TTL', () => {
      cache.set('zero', 'zero-ttl', 0);
      vi.advanceTimersByTime(1);
      expect(cache.get('zero')).toBeNull();
    });

    it('accepts a negative TTL', () => {
      cache.set('negative', 'negative-ttl', -1);
      expect(cache.get('negative')).toBeNull();
    });
  });

  describe('invalidate', () => {
    it('removes a single key from the cache', () => {
      cache.set('key-g', 'value-g');
      cache.invalidate('key-g');
      expect(cache.get('key-g')).toBeNull();
    });

    it('does not affect other keys', () => {
      cache.set('key-h', 'value-h');
      cache.set('key-i', 'value-i');
      cache.invalidate('key-h');
      expect(cache.get('key-h')).toBeNull();
      expect(cache.get('key-i')).toBe('value-i');
    });

    it('is idempotent when the key does not exist', () => {
      expect(() => cache.invalidate('nonexistent')).not.toThrow();
    });

    it('reduces the size by one', () => {
      cache.set('key-j', 'value-j');
      cache.set('key-k', 'value-k');
      expect(cache.size).toBe(2);
      cache.invalidate('key-j');
      expect(cache.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all entries from the cache', () => {
      cache.set('key-l', 'value-l');
      cache.set('key-m', 'value-m');
      cache.set('key-n', 'value-n');
      cache.clear();
      expect(cache.get('key-l')).toBeNull();
      expect(cache.get('key-m')).toBeNull();
      expect(cache.get('key-n')).toBeNull();
    });

    it('sets size to zero', () => {
      cache.set('key-o', 'value-o');
      cache.clear();
      expect(cache.size).toBe(0);
    });

    it('allows new entries after clearing', () => {
      cache.set('key-p', 'value-p');
      cache.clear();
      cache.set('key-q', 'value-q');
      expect(cache.get('key-q')).toBe('value-q');
    });
  });

  describe('size', () => {
    it('starts at zero', () => {
      expect(cache.size).toBe(0);
    });

    it('increments on set', () => {
      cache.set('key-r', 'value-r');
      expect(cache.size).toBe(1);
    });

    it('does not increment when overwriting an existing key', () => {
      cache.set('key-s', 'value-s');
      cache.set('key-s', 'value-s-updated');
      expect(cache.size).toBe(1);
    });

    it('does not include expired entries that were never read', () => {
      cache.set('key-t', 'value-t', 5_000);
      cache.set('key-u', 'value-u', 5_000);
      vi.advanceTimersByTime(10_000);
      expect(cache.size).toBe(2);
    });
  });

  describe('DEFAULT_TTL_MS', () => {
    it('is exported as a named constant', () => {
      expect(DEFAULT_TTL_MS).toBe(60_000);
    });
  });
});
