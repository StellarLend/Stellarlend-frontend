import { describe, expect, it, vi, beforeEach } from "vitest";
import { isValidElement } from "react";
import ProtectedRouteLayout from "./ProtectedRouteLayout";
import {
  clearAuthorizationTelemetry,
  getRecentAuthorizationEvents,
  PROTECTED_ROUTE_BOUNDS,
} from "@/lib/auth/protected-route-telemetry";

const { getSessionMock, redirectMock, recordEventMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  recordEventMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth/protected-route-telemetry", async (importOriginal) => {
  const actual: object = await importOriginal();
  return {
    ...actual,
    recordAuthorizationEvent: recordEventMock,
  };
});

const VALID_WALLET = "GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5";

function validSession(overrides?: Partial<{ issuedAt: Date; expiresAt: Date }>) {
  return {
    user: { id: "user-1", walletAddress: VALID_WALLET },
    issuedAt: overrides?.issuedAt ?? new Date(),
    expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 60_000),
  };
}

describe("ProtectedRouteLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthorizationTelemetry();
  });

  // ─── Success paths ──────────────────────────────────────────────

  it("renders protected children only after a valid server session is confirmed", async () => {
    getSessionMock.mockResolvedValueOnce(validSession());

    const result = await ProtectedRouteLayout({
      children: "settings",
      returnTo: "/dashboard/settings",
    });

    expect(isValidElement(result)).toBe(true);
    expect(result.props.children).toBe("settings");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("records a granted telemetry event with latency on success", async () => {
    getSessionMock.mockResolvedValueOnce(validSession());

    await ProtectedRouteLayout({
      children: "settings",
      returnTo: "/dashboard/settings",
    });

    expect(recordEventMock).toHaveBeenCalledTimes(1);
    const call = recordEventMock.mock.calls[0][0];
    expect(call.outcome).toBe("granted");
    expect(call.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof call.latencyMs).toBe("number");
  });

  // ─── Failure / redirect paths ───────────────────────────────────

  it("redirects before rendering when the session is missing", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "/dashboard/settings" }),
    ).rejects.toThrow("redirect:/?returnUrl=%2Fdashboard%2Fsettings");
    expect(redirectMock).toHaveBeenCalledWith("/?returnUrl=%2Fdashboard%2Fsettings");
  });

  it("redirects before rendering when the session wallet is malformed", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: "user-1", walletAddress: "not-a-wallet" },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "/dashboard/settings" }),
    ).rejects.toThrow("redirect:/?returnUrl=%2Fdashboard%2Fsettings");
  });

  it("redirects before rendering when an expired session is replayed", async () => {
    getSessionMock.mockResolvedValueOnce(
      validSession({
        issuedAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 60_000),
      }),
    );

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "/dashboard/settings" }),
    ).rejects.toThrow("redirect:/?returnUrl=%2Fdashboard%2Fsettings");
  });

  it("records a denied telemetry event with denialReason on missing session", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "/dashboard/settings" }),
    ).rejects.toThrow();

    expect(recordEventMock).toHaveBeenCalledTimes(1);
    const call = recordEventMock.mock.calls[0][0];
    expect(call.outcome).toBe("denied");
    expect(call.denialReason).toBe("missing-session");
    expect(call.sessionExpired).toBe(false);
  });

  it("records a denied telemetry event for expired sessions", async () => {
    getSessionMock.mockResolvedValueOnce(
      validSession({ expiresAt: new Date(Date.now() - 10_000) }),
    );

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "/dashboard/settings" }),
    ).rejects.toThrow();

    const call = recordEventMock.mock.calls[0][0];
    expect(call.outcome).toBe("denied");
    expect(call.denialReason).toBe("expired-session");
    expect(call.sessionExpired).toBe(true);
  });

  it("records a denied telemetry event for invalid wallet", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: "u", walletAddress: "bad" },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "/dashboard/settings" }),
    ).rejects.toThrow();

    const call = recordEventMock.mock.calls[0][0];
    expect(call.outcome).toBe("denied");
    expect(call.denialReason).toBe("invalid-wallet");
  });

  it("records a denied telemetry event when getSession throws", async () => {
    getSessionMock.mockRejectedValueOnce(new Error("cookie parse failure"));

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "/dashboard/settings" }),
    ).rejects.toThrow();

    const call = recordEventMock.mock.calls[0][0];
    expect(call.outcome).toBe("denied");
    expect(call.denialReason).toBe("session-error");
  });

  // ─── returnTo sanitization ──────────────────────────────────────

  it("sanitizes returnTo that exceeds MAX_RETURN_TO_LENGTH", async () => {
    const longPath = "/" + "a".repeat(PROTECTED_ROUTE_BOUNDS.MAX_RETURN_TO_LENGTH);
    getSessionMock.mockResolvedValueOnce(null);

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: longPath }),
    ).rejects.toThrow();

    const call = recordEventMock.mock.calls[0][0];
    expect(call.returnToSanitized).toBe(true);
    // Should fall back to /dashboard/settings
    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("/dashboard/settings")),
    );
  });

  it("sanitizes protocol-relative returnTo URLs", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "//evil.com/phish" }),
    ).rejects.toThrow();

    const call = recordEventMock.mock.calls[0][0];
    expect(call.returnToSanitized).toBe(true);
  });

  it("sanitizes absolute https returnTo URLs", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "https://evil.com/phish" }),
    ).rejects.toThrow();

    const call = recordEventMock.mock.calls[0][0];
    expect(call.returnToSanitized).toBe(true);
  });

  it("sanitizes returnTo with unknown prefix", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "/admin/panel" }),
    ).rejects.toThrow();

    const call = recordEventMock.mock.calls[0][0];
    expect(call.returnToSanitized).toBe(true);
  });

  it("passes through valid returnTo paths without sanitization", async () => {
    getSessionMock.mockResolvedValueOnce(validSession());

    await ProtectedRouteLayout({ children: "settings", returnTo: "/settings/profile" });

    const call = recordEventMock.mock.calls[0][0];
    expect(call.returnToSanitized).toBe(false);
  });

  // ─── Default returnTo ───────────────────────────────────────────

  it("defaults returnTo to /dashboard/settings when not provided", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(
      ProtectedRouteLayout({ children: "settings" }),
    ).rejects.toThrow();

    expect(redirectMock).toHaveBeenCalledWith("/?returnUrl=%2Fdashboard%2Fsettings");
  });

  // ─── Children are never rendered on denial ──────────────────────

  it("never renders children when session is null (denied path)", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(
      ProtectedRouteLayout({ children: <div data-testid="secret">private</div>, returnTo: "/" }),
    ).rejects.toThrow();
  });

  it("never renders children when getSession throws", async () => {
    getSessionMock.mockRejectedValueOnce(new Error("unexpected"));

    await expect(
      ProtectedRouteLayout({ children: <div data-testid="secret">private</div>, returnTo: "/" }),
    ).rejects.toThrow();
  });

  // ─── Boundary: future issuedAt ──────────────────────────────────

  it("redirects when issuedAt is far in the future (clock skew boundary)", async () => {
    getSessionMock.mockResolvedValueOnce(
      validSession({
        issuedAt: new Date(Date.now() + 300_000),
        expiresAt: new Date(Date.now() + 360_000),
      }),
    );

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "/dashboard/settings" }),
    ).rejects.toThrow("redirect:/?returnUrl=%2Fdashboard%2Fsettings");
  });

  // ─── Latency measurement ────────────────────────────────────────

  it("includes latencyMs in telemetry event", async () => {
    getSessionMock.mockResolvedValueOnce(validSession());

    await ProtectedRouteLayout({ children: "settings", returnTo: "/dashboard/settings" });

    const call = recordEventMock.mock.calls[0][0];
    expect(typeof call.latencyMs).toBe("number");
    expect(call.latencyMs).toBeGreaterThanOrEqual(0);
  });

  // ─── Multiple calls do not interfere ────────────────────────────

  it("handles multiple sequential calls independently", async () => {
    // First call: granted
    getSessionMock.mockResolvedValueOnce(validSession());
    const result1 = await ProtectedRouteLayout({ children: "a", returnTo: "/" });
    expect(result1.props.children).toBe("a");

    // Second call: denied
    getSessionMock.mockResolvedValueOnce(null);
    await expect(
      ProtectedRouteLayout({ children: "b", returnTo: "/dashboard" }),
    ).rejects.toThrow();

    expect(recordEventMock).toHaveBeenCalledTimes(2);
    expect(recordEventMock.mock.calls[0][0].outcome).toBe("granted");
    expect(recordEventMock.mock.calls[1][0].outcome).toBe("denied");
  });
});
