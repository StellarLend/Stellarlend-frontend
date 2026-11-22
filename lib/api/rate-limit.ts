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

export const UNKNOWN_CLIENT_IP = "unknown";

/** 120-request burst, two tokens per second (about 120 requests/minute per IP). */
export const apiRateLimiter = new TokenBucketRateLimiter(120, 2);

/** Lower-limit shared bucket for requests without a verifiable client IP. */
export const unknownApiRateLimiter = new TokenBucketRateLimiter(30, 0.5);

/** Test helper: clear all per-IP and unknown-client buckets. */
export function resetApiRateLimiter(): void {
  apiRateLimiter.reset();
  unknownApiRateLimiter.reset();
}

const DEFAULT_TRUSTED_PROXY_HOPS = 1;

/**
 * Parses `TRUSTED_PROXY_HOPS` as a non-negative integer.
 * Defaults to 1 (single trusted reverse proxy, e.g. Vercel). Set to 0 to ignore `x-forwarded-for`.
 */
export function getTrustedProxyHops(
  raw: string | undefined = process.env.TRUSTED_PROXY_HOPS,
): number {
  if (raw === undefined) return DEFAULT_TRUSTED_PROXY_HOPS;
  const trimmed = raw.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return DEFAULT_TRUSTED_PROXY_HOPS;

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_TRUSTED_PROXY_HOPS;
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

/**
 * Reads the client IP appended by the trusted proxy hop (counted from the right
 * of `x-forwarded-for`), falling back to `x-real-ip` and then `"unknown"`.
 * When `TRUSTED_PROXY_HOPS` is `0`, `x-forwarded-for` is ignored.
 */
export function getClientIp(
  request: Request,
  trustedProxyHops: number = getTrustedProxyHops(),
): string {
  if (trustedProxyHops > 0) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const hops = forwarded
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      const index = hops.length - trustedProxyHops;
      if (index >= 0) {
        const candidate = hops[index] ?? "";
        if (isPlausibleIp(candidate)) return candidate;
      }
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  if (isPlausibleIp(realIp)) return realIp;

  return UNKNOWN_CLIENT_IP;
}

/**
 * Applies the API rate limit for a request, routing `"unknown"` clients to a
 * separate lower-limit bucket so they cannot evade or impact known-IP limits.
 */
export function checkApiRateLimit(
  request: Request,
  now?: number,
): RateLimitResult {
  const ip = getClientIp(request);
  if (ip === UNKNOWN_CLIENT_IP) {
    return unknownApiRateLimiter.check(UNKNOWN_CLIENT_IP, now);
  }
  return apiRateLimiter.check(ip, now);
}
