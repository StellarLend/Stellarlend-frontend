// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "./middleware";

describe("middleware", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("nonce differs per request", () => {
    const req1 = new NextRequest("http://localhost/markets");
    const req2 = new NextRequest("http://localhost/markets");

    const res1 = middleware(req1);
    const res2 = middleware(req2);

    const nonce1 = res1.headers.get("x-nonce");
    const nonce2 = res2.headers.get("x-nonce");

    expect(nonce1).toBeTruthy();
    expect(nonce2).toBeTruthy();
    expect(nonce1).not.toBe(nonce2);

    const csp1 = res1.headers.get("Content-Security-Policy");
    expect(csp1).toContain(`'nonce-${nonce1}'`);

    const csp2 = res2.headers.get("Content-Security-Policy");
    expect(csp2).toContain(`'nonce-${nonce2}'`);
  });

  it("falls back on bad URL in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_HORIZON_URL", "not-a-valid-url");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new NextRequest("http://localhost/markets");
    const res = middleware(req);

    expect(consoleSpy).toHaveBeenCalled();
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toContain("https://horizon-testnet.stellar.org");

    consoleSpy.mockRestore();
  });

  it("throws on bad URL in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_HORIZON_URL", "not-a-valid-url");

    const req = new NextRequest("http://localhost/markets");
    expect(() => middleware(req)).toThrow();
  });

  it("matcher skips api and assets", () => {
    const pattern = new RegExp(config.matcher[0]);

    expect(pattern.test("/api/v1/protocol")).toBe(false);
    expect(pattern.test("/_next/static/x.js")).toBe(false);
    expect(pattern.test("/favicon.ico")).toBe(false);
    expect(pattern.test("/markets")).toBe(true);
    expect(pattern.test("/es/markets")).toBe(true);
  });

  it("sets all five static security headers", () => {
    const req = new NextRequest("http://localhost/markets");
    const res = middleware(req);

    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toBeTruthy();
  });

  it("includes report-uri when NEXT_PUBLIC_CSP_REPORT_URI is set", () => {
    vi.stubEnv("NEXT_PUBLIC_CSP_REPORT_URI", "https://telemetry.example.com/csp");

    const req = new NextRequest("http://localhost/markets");
    const res = middleware(req);

    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toContain("report-uri https://telemetry.example.com/csp");
  });
});
