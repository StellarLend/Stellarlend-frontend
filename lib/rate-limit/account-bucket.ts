import { RateLimitResult } from '@/lib/rate-limit';

export interface AccountBucketOptions {
  limit: number;
  windowMs: number;
  burst: number;
}

export interface AccountBucketResult extends RateLimitResult {
  retryAfter: number;
}

const accountBuckets = new Map<string, { tokens: number; lastRefill: number }>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.trim().toLowerCase();
}

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  }

  for (const [key, bucket] of accountBuckets.entries()) {
    if (now - bucket.lastRefill > CLEANUP_INTERVAL * 2) {
      accountBuckets.delete(key);
    }
  }

  lastCleanup = now;
}

export function clearAccountBucketCache() {
  accountBuckets.clear();
}

export function accountBucketRateLimit(
  walletAddress: string,
  { limit, windowMs, burst }: AccountBucketOptions,
): AccountBucketResult {
  if (!walletAddress?.trim()) {
    throw new TypeError('walletAddress is required');
  }

  cleanupExpiredEntries();

  const now = Date.now();
  const key = normalizeWalletAddress(walletAddress);
  const refillRate = limit / windowMs;

  const bucket = accountBuckets.get(key) ?? { tokens: burst, lastRefill: now };
  const elapsedMs = Math.max(0, now - bucket.lastRefill);
  const tokens = Math.min(burst, bucket.tokens + elapsedMs * refillRate);

  const success = tokens >= 1;
  const tokensAfter = success ? tokens - 1 : tokens;
  const remaining = Math.max(0, Math.floor(tokensAfter));
  const waitMs = success ? 0 : Math.ceil((1 - tokensAfter) / refillRate);
  const reset = Math.floor((now + waitMs) / 1000);

  accountBuckets.set(key, {
    tokens: success ? tokensAfter : tokens,
    lastRefill: now,
  });

  return {
    success,
    limit,
    remaining,
    reset,
    retryAfter: Math.ceil(waitMs / 1000),
  };
}
