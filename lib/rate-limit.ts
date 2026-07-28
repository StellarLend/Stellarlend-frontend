export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const cache = new Map<string, { count: number; reset: number }>();
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

// Setup periodic cleanup with setInterval if available (not in edge/serverless)
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.reset) {
      cache.delete(key);
    }
  }
}

// Initialize cleanup timer if setInterval is available
if (typeof setInterval !== 'undefined') {
  cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);
  // Unref in Node.js to allow process to exit
  if (cleanupTimer && typeof (cleanupTimer as any).unref === 'function') {
    (cleanupTimer as any).unref();
  }
}

/**
 * Basic in-memory rate limiter for tracking request windows.
 */
export function rateLimit(identifier: string, limit: number, windowMs: number): RateLimitResult {

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

/**
 * Cleanup function to clear the interval timer (useful for testing or shutdown)
 */
export function stopCleanupTimer() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Manually trigger cleanup (useful for testing)
 */
export function triggerCleanup() {
  cleanupExpiredEntries();
}