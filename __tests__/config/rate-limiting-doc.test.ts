import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(__dirname, "../..");

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

describe("rate-limiting documentation", () => {
  it("documents the exported limiter symbols and tuning keys", () => {
    const doc = readProjectFile("docs/rate-limiting.md");
    const globalLimiter = readProjectFile("lib/rate-limit.ts");
    const accountBucket = readProjectFile("lib/rate-limit/account-bucket.ts");
    const config = readProjectFile("lib/config.ts");

    const requiredExports = [
      "RateLimitResult",
      "rateLimit",
      "clearRateLimitCache",
      "AccountBucketOptions",
      "AccountBucketResult",
      "accountBucketRateLimit",
      "clearAccountBucketCache",
    ];

    for (const exportedName of requiredExports) {
      expect(`${globalLimiter}\n${accountBucket}`).toContain(exportedName);
      expect(doc).toContain(exportedName);
    }

    const requiredEnvKeys = [
      "RATE_LIMIT_MAX",
      "RATE_LIMIT_WINDOW",
      "TX_ACCOUNT_RATE_LIMIT_MAX",
      "TX_ACCOUNT_RATE_LIMIT_WINDOW_MS",
      "TX_ACCOUNT_RATE_LIMIT_BURST",
    ];

    for (const envKey of requiredEnvKeys) {
      expect(config).toContain(envKey);
      expect(doc).toContain(envKey);
    }
  });

  it("documents every route that applies account bucket rate limiting", () => {
    const doc = readProjectFile("docs/rate-limiting.md");
    const rateLimitedRoutes = [
      "app/api/tx/build/route.ts",
      "app/api/tx/submit/route.ts",
      "app/api/account/delete/challenge/route.ts",
    ];

    for (const route of rateLimitedRoutes) {
      const source = readProjectFile(route);
      expect(source).toContain("accountBucketRateLimit");
      expect(doc).toContain(route);
    }
  });

  it("keeps documented rate-limit headers and error codes in sync", () => {
    const doc = readProjectFile("docs/rate-limiting.md");
    const middleware = readProjectFile("middleware.ts");
    const txBuildRoute = readProjectFile("app/api/tx/build/route.ts");

    const headers = [
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "Retry-After",
    ];

    for (const header of headers) {
      expect(`${middleware}\n${txBuildRoute}`).toContain(header);
      expect(doc).toContain(header);
    }

    expect(txBuildRoute).toContain("RATE_LIMIT_EXCEEDED");
    expect(doc).toContain("RATE_LIMIT_EXCEEDED");
    expect(middleware).toContain("Too Many Requests");
    expect(doc).toContain("Too Many Requests");
  });
});
