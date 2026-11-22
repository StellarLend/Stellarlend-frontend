import { describe, expect, it } from "vitest";
import { getClientIp, TokenBucketRateLimiter } from "./rate-limit";

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

describe("getClientIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    expect(
      getClientIp(requestWith({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when the first hop is invalid", () => {
    expect(
      getClientIp(
        requestWith({
          "x-forwarded-for": "not-an-ip",
          "x-real-ip": "198.51.100.9",
        }),
      ),
    ).toBe("198.51.100.9");
  });

  it("returns unknown when no valid IP header is present", () => {
    expect(getClientIp(requestWith({}))).toBe("unknown");
    expect(
      getClientIp(requestWith({ "x-forwarded-for": "999.1.1.1" })),
    ).toBe("unknown");
  });
});
