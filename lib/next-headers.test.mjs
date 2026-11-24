/**
 * Tests for the static security headers defined in next.config.mjs
 *
 * Run with: node --test lib/next-headers.test.mjs
 * (Node.js built-in test runner — no external test dependencies)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextConfig } from "../next.config.mjs";

const REQUIRED_HEADERS = [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-DNS-Prefetch-Control",
];

async function headersForCatchAllRoute() {
  const groups = await nextConfig.headers();
  const route = groups.find((group) => group.source === "/(.*)");
  assert.ok(route, 'expected a headers() entry for source "/(.*)"');
  return new Map(route.headers.map(({ key, value }) => [key, value]));
}

describe("next.config.mjs static security headers", () => {
  it("defines all six required headers for /(.*)", async () => {
    const headers = await headersForCatchAllRoute();
    for (const name of REQUIRED_HEADERS) {
      assert.ok(headers.has(name), `missing security header: ${name}`);
    }
  });

  it("disables DNS prefetching", async () => {
    const headers = await headersForCatchAllRoute();
    assert.equal(headers.get("X-DNS-Prefetch-Control"), "off");
  });

  it("HSTS includes subdomains", async () => {
    const headers = await headersForCatchAllRoute();
    assert.match(
      headers.get("Strict-Transport-Security") ?? "",
      /includeSubDomains/,
    );
  });
});
