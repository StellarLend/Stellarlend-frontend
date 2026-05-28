/**
 * Price Oracle Constants
 * Canonical list of supported assets and cache configuration
 */

export const SUPPORTED_ASSETS = ['XLM', 'USDC', 'BTC', 'ETH'] as const;

/**
 * Cache configuration for price responses
 * TTL (Time-To-Live): 5 seconds - How long the cache is considered fresh
 * SWR (Stale-While-Revalidate): 10 seconds - How long stale data is acceptable
 */
export const PRICE_CACHE_CONFIG = {
  ttl: 5 * 1000, // 5 seconds in milliseconds
  swr: 10 * 1000, // 10 seconds in milliseconds
} as const;

/**
 * Price cache key prefix for namespace isolation
 */
export const PRICE_CACHE_KEY_PREFIX = 'prices:' as const;

/**
 * Maximum request size for assets query parameter
 */
export const MAX_ASSETS_IN_QUERY = 10 as const;
