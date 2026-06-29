// app/api/auth/refresh/route.test.ts
//
// Covers POST /api/auth/refresh:
//  - 401 when no active session
//  - 200 + Set-Cookie when refresh succeeds (re-issued JWT, fresh expiresAt)
//  - 500 when createSession throws unexpectedly
//
// Note: `withCsrfProtection` is stubbed out (handler.test.ts owns the CSRF
// coverage). The CSRF token header is still set on requests so we know the
// route passes through the request untouched.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getAuthCookieConfig: vi.fn(),
  getSession: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api/handler", () => ({
  withCsrfProtection: (handler: any) => handler,
}));

import {
  getAuthCookieConfig,
  getSession,
  createSession,
} from "@/lib/auth";

const mockGetAuthCookieConfig = vi.mocked(getAuthCookieConfig);
const mockGetSession = vi.mocked(getSession);
const mockCreateSession = vi.mocked(createSession);

function makeRequest(
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(
    new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": "csrf-cookie-value",
        cookie: "csrf-token=csrf-cookie-value",
        ...headers,
      },
    }),
  );
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthCookieConfig.mockReturnValue({
      sessionCookieName: "session",
      sessionExpiryHours: 24,
      sessionExpirySeconds: 24 * 60 * 60,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when no session is active", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("No active session");
  });

  it("returns 200, refreshed expiresAt, user info, and a Set-Cookie header on success", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-123",
        email: "user@example.com",
        name: "Jane Doe",
        walletAddress: "GXXXX",
        createdAt: new Date("2024-01-01"),
      },
      issuedAt: new Date("2024-01-01"),
      expiresAt: new Date("2024-01-02"),
    });
    mockCreateSession.mockResolvedValue("fresh-jwt-token");

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    const setCookie = res.headers.getSetCookie();
    expect(setCookie.length).toBeGreaterThan(0);
    const sessionCookie = setCookie.find((c) => c.startsWith("session="));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain("fresh-jwt-token");
    expect(sessionCookie?.toLowerCase()).toContain("httponly");
    expect(sessionCookie?.toLowerCase()).toContain("samesite=lax");

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.session.active).toBe(true);
    expect(body.session.cookie).toBe("session");
    expect(body.session.user.id).toBe("user-123");
    expect(body.session.user.email).toBe("user@example.com");

    // expiresAt must be ~24h in the future (within a few seconds).
    const expiresAt = Date.parse(body.session.expiresAt);
    const now = Date.now();
    const hourSeconds = 60 * 60 * 1000;
    expect(expiresAt - now).toBeGreaterThan(23 * hourSeconds);
    expect(expiresAt - now).toBeLessThan(25 * hourSeconds);

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    const createCall = mockCreateSession.mock.calls[0][0];
    expect(createCall.id).toBe("user-123");
    expect(createCall.email).toBe("user@example.com");
  });

  it("returns 500 if createSession throws unexpectedly", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-123",
        email: "user@example.com",
        name: "Jane Doe",
        walletAddress: null,
        createdAt: new Date(),
      },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockCreateSession.mockRejectedValueOnce(new Error("signing failed"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to refresh session");
  });
});
