export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const cache = new Map<string, { count: number; reset: number }>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * Basic in-memory rate limiter for tracking request windows.
 */
export function rateLimit(identifier: string, limit: number, windowMs: number): RateLimitResult {
  // Periodic cleanup of expired entries to prevent memory leaks
  if (Date.now() - lastCleanup > CLEANUP_INTERVAL) {
    for (const [key, value] of cache.entries()) {
      if (Date.now() > value.reset) {
        cache.delete(key);
      }
    }
    lastCleanup = Date.now();
  }

  const now = Date.now();
  const item = cache.get(identifier);

  // If new or expired, reset the window
  if (!item || now > item.reset) {
    const reset = now + windowMs;
    cache.set(identifier, { count: 1, reset });
    return { 
      success: true, 
      limit, 
      remaining: limit - 1, 
      reset 
    };
  }

  item.count++;
  const remaining = Math.max(0, limit - item.count);
  const success = item.count <= limit;

  return { 
    success, 
    limit, 
    remaining, 
    reset: item.reset 
  };
}

export const clearRateLimitCache = () => cache.clear();