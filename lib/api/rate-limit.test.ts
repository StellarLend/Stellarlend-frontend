import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkApiRateLimit,
  getClientIp,
  getTrustedProxyHops,
  resetApiRateLimiter,
  TokenBucketRateLimiter,
} from "./rate-limit";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/v1/protocol", { headers });
}

describe("TokenBucketRateLimiter", () => {
  it("allows a burst up to capacity, then blocks with Retry-After", () => {
    const limiter = new TokenBucketRateLimiter(2, 1);

    expect(limiter.check("203.0.113.1", 0).allowed).toBe(true);
    expect(limiter.check("203.0.113.1", 0).allowed).toBe(true);

    const blocked = limiter.check("203.0.113.1", 0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
  });

  it("refills tokens over time", () => {
    const limiter = new TokenBucketRateLimiter(1, 1);

    expect(limiter.check("203.0.113.2", 0).allowed).toBe(true);
    expect(limiter.check("203.0.113.2", 500).allowed).toBe(false);
    expect(limiter.check("203.0.113.2", 1000).allowed).toBe(true);
  });

  it("keeps buckets independent per key", () => {
    const limiter = new TokenBucketRateLimiter(1, 0);

    expect(limiter.check("203.0.113.3", 0).allowed).toBe(true);
    expect(limiter.check("203.0.113.3", 0).allowed).toBe(false);
    expect(limiter.check("203.0.113.4", 0).allowed).toBe(true);
  });

  it("resets all buckets", () => {
    const limiter = new TokenBucketRateLimiter(1, 0);

    expect(limiter.check("203.0.113.5", 0).allowed).toBe(true);
    expect(limiter.check("203.0.113.5", 0).allowed).toBe(false);

    limiter.reset();
    expect(limiter.check("203.0.113.5", 0).allowed).toBe(true);
  });
});

describe("getTrustedProxyHops", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 1 when unset or invalid", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "");
    expect(getTrustedProxyHops()).toBe(1);
    expect(getTrustedProxyHops(undefined)).toBe(1);
    expect(getTrustedProxyHops("-1")).toBe(1);
    expect(getTrustedProxyHops("1.5")).toBe(1);
    expect(getTrustedProxyHops("abc")).toBe(1);
  });

  it("parses valid non-negative integer values", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "0");
    expect(getTrustedProxyHops()).toBe(0);

    vi.stubEnv("TRUSTED_PROXY_HOPS", " 2 ");
    expect(getTrustedProxyHops()).toBe(2);
  });
});

describe("getClientIp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses right-most trusted hop", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    expect(
      getClientIp(requestWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    ).toBe("5.6.7.8");

    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(
      getClientIp(
        requestWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" }),
      ),
    ).toBe("5.6.7.8");
  });

  it("ignores xff when hops is 0", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "0");
    expect(
      getClientIp(
        requestWith({
          "x-forwarded-for": "1.2.3.4, 5.6.7.8",
          "x-real-ip": "198.51.100.9",
        }),
      ),
    ).toBe("198.51.100.9");

    expect(
      getClientIp(requestWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    ).toBe("unknown");
  });

  it("falls back to x-real-ip", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    expect(
      getClientIp(
        requestWith({
          "x-forwarded-for": "1.2.3.4, not-an-ip",
          "x-real-ip": "198.51.100.9",
        }),
      ),
    ).toBe("198.51.100.9");

    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(
      getClientIp(
        requestWith({
          "x-forwarded-for": "5.6.7.8",
          "x-real-ip": "198.51.100.9",
        }),
      ),
    ).toBe("198.51.100.9");
  });

  it("handles IPv6 and malformed values", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    expect(
      getClientIp(
        requestWith({ "x-forwarded-for": "2001:db8::1, 2001:db8::2" }),
      ),
    ).toBe("2001:db8::2");
    expect(getClientIp(requestWith({}))).toBe("unknown");
    expect(
      getClientIp(requestWith({ "x-forwarded-for": "999.1.1.1" })),
    ).toBe("unknown");
  });
});

describe("checkApiRateLimit", () => {
  beforeEach(() => {
    resetApiRateLimiter();
  });

  it("buckets unknown clients separately with a lower limit without affecting known clients", () => {
    for (let i = 0; i < 30; i += 1) {
      expect(checkApiRateLimit(requestWith({}), 0).allowed).toBe(true);
    }

    const blockedUnknown = checkApiRateLimit(requestWith({}), 0);
    expect(blockedUnknown.allowed).toBe(false);
    expect(blockedUnknown.retryAfterSec).toBeGreaterThanOrEqual(1);

    const knownRequest = requestWith({ "x-forwarded-for": "203.0.113.50" });
    expect(checkApiRateLimit(knownRequest, 0).allowed).toBe(true);
  });
});
