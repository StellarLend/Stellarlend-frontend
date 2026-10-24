export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Best-effort in-memory token bucket, keyed per IP.
 *
 * On serverless platforms each instance has its own buckets; this is a cheap
 * first line of defence, not a globally consistent quota.
 */
export class TokenBucketRateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly maxBuckets = 10_000,
  ) {
    if (capacity < 1) throw new Error("capacity must be at least 1");
    if (refillPerSecond < 0) {
      throw new Error("refillPerSecond must be non-negative");
    }
  }

  check(key: string, now: number = Date.now()): RateLimitResult {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
      this.prune();
    }

    const elapsedSeconds = Math.max(0, (now - bucket.lastRefill) / 1000);
    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + elapsedSeconds * this.refillPerSecond,
    );
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfterSec: 0 };
    }

    const deficit = 1 - bucket.tokens;
    const retryAfterSec =
      this.refillPerSecond === 0
        ? 60
        : Math.max(1, Math.ceil(deficit / this.refillPerSecond));
    return { allowed: false, retryAfterSec };
  }

  reset(): void {
    this.buckets.clear();
  }

  private prune(): void {
    while (this.buckets.size > this.maxBuckets) {
      const oldest = this.buckets.keys().next();
      if (oldest.done) return;
      this.buckets.delete(oldest.value);
    }
  }
}

/** 120-request burst, two tokens per second (about 120 requests/minute per IP). */
export const apiRateLimiter = new TokenBucketRateLimiter(120, 2);

/** Test helper: clear all per-IP buckets. */
export function resetApiRateLimiter(): void {
  apiRateLimiter.reset();
}

function isPlausibleIp(value: string): boolean {
  if (!value || value.length > 45) return false;

  if (value.includes(".")) {
    const parts = value.split(".");
    return (
      parts.length === 4 &&
      parts.every(
        (part) =>
          /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255,
      )
    );
  }

  return value.includes(":") && /^[0-9a-fA-F:]+$/.test(value);
}

/** Reads the first validated `x-forwarded-for` hop, falling back to `x-real-ip`. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (isPlausibleIp(first)) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  if (isPlausibleIp(realIp)) return realIp;

  return "unknown";
}
