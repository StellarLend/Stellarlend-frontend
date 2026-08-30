import { describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";
import ProtectedRouteLayout from "./ProtectedRouteLayout";

const { getSessionMock, redirectMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

const VALID_WALLET = "GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5";

describe("ProtectedRouteLayout", () => {
  it("renders protected children only after a valid server session is confirmed", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: "user-1", walletAddress: VALID_WALLET },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await ProtectedRouteLayout({
      children: "settings",
      returnTo: "/dashboard/settings",
    });

    expect(isValidElement(result)).toBe(true);
    expect(result.props.children).toBe("settings");
    expect(redirectMock).not.toHaveBeenCalled();
  });

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
    getSessionMock.mockResolvedValueOnce({
      user: { id: "user-1", walletAddress: VALID_WALLET },
      issuedAt: new Date(Date.now() - 120_000),
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      ProtectedRouteLayout({ children: "settings", returnTo: "/dashboard/settings" }),
    ).rejects.toThrow("redirect:/?returnUrl=%2Fdashboard%2Fsettings");
  });
});
