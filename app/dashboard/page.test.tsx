/**
 * Regression tests for app/dashboard/page.tsx and DashboardClient.tsx
 *
 * Covers:
 *  a) Component renders without throwing a ReferenceError (hooks wired correctly)
 *  b) Successful /api/positions fetch → expected alert banner content is shown
 *  c) Failed fetch (network error or 500) → error state set, fallback UI visible
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";
import DashboardClient from "./DashboardClient";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// ── helpers ──────────────────────────────────────────────────────────────────

const jsonResponse = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);

const errorResponse = (status = 500) =>
  Promise.resolve({
    ok: false,
    status,
    statusText: "Internal Server Error",
  } as Response);

const makeDefaultMock =
  (positionOverride?: () => Promise<Response>) => (url: string) => {
    if (url.includes("/api/positions")) {
      return positionOverride
        ? positionOverride()
        : jsonResponse({ nextDue: "5 days", healthFactor: 1.5 });
    }
    if (url.includes("/api/metrics")) {
      return jsonResponse({ totalSupplied: 1000, totalBorrowed: 500, netApy: 5.5 });
    }
    if (url.includes("/api/transactions")) {
      return jsonResponse({ transactions: [], total: 0 });
    }
    if (url.includes("/api/notifications")) {
      return jsonResponse([]);
    }
    if (url.includes("/api/liquidations")) {
      return jsonResponse({ positions: [] });
    }
    return jsonResponse({});
  };

// ── suite ─────────────────────────────────────────────────────────────────────

describe("Dashboard regression", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation(makeDefaultMock());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  // ── (a) No ReferenceError ──────────────────────────────────────────────────

  describe("(a) renders without throwing a ReferenceError", () => {
    it("mounts DashboardClient without crashing", () => {
      // If React hooks (useState / useEffect) were missing or the 'use client'
      // directive were absent this render would throw a ReferenceError.
      expect(() => render(<DashboardClient />)).not.toThrow();
    });

    it("renders the Dashboard page heading", async () => {
      render(<DashboardClient />);
      const heading = await screen.findByRole("heading", { name: /dashboard/i });
      expect(heading).toBeInTheDocument();
    });
  });

  // ── (b) Successful fetch → alert banner content ───────────────────────────

  describe("(b) successful /api/positions fetch", () => {
    it("renders no alert banner when health is safe and payment is not due soon", async () => {
      // healthFactor 1.5, nextDue 5 days → falls outside all alert thresholds
      render(<DashboardClient />);
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith("/api/positions"),
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("renders an info alert when payment is due within 7 days", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() =>
          jsonResponse({ nextDue: "6 days", healthFactor: 1.5 }),
        ),
      );

      render(<DashboardClient />);

      const banner = await screen.findByText(/Upcoming payment/i);
      expect(banner).toBeInTheDocument();
    });

    it("renders a warning alert when payment is due within 3 days", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() =>
          jsonResponse({ nextDue: "2 days", healthFactor: 1.5 }),
        ),
      );

      render(<DashboardClient />);

      const banner = await screen.findByText(/Payment due soon/i);
      expect(banner).toBeInTheDocument();
    });

    it("renders a critical alert when payment is due within 1 day", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() =>
          jsonResponse({ nextDue: "1 day", healthFactor: 1.5 }),
        ),
      );

      render(<DashboardClient />);

      const banner = await screen.findByText(/Immediate action required/i);
      expect(banner).toBeInTheDocument();
    });

    it("renders a critical alert when health factor is critically low", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() =>
          jsonResponse({ nextDue: "10 days", healthFactor: 1.1 }),
        ),
      );

      render(<DashboardClient />);

      const banner = await screen.findByText(
        /Immediate action required|Collateral is critically weak/i,
      );
      expect(banner).toBeInTheDocument();
    });

    it("clears the loading indicator once the fetch resolves", async () => {
      render(<DashboardClient />);

      await waitFor(() =>
        expect(screen.queryByText(/loading data/i)).not.toBeInTheDocument(),
      );
    });
  });

  // ── (c) Failed fetch → error state & fallback UI ──────────────────────────

  describe("(c) failed /api/positions fetch", () => {
    it("shows a fallback error message on network failure", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() => Promise.reject(new Error("Network error"))),
      );

      render(<DashboardClient />);

      const msg = await screen.findByText(
        /Failed to load positions data\. Please try again later\./i,
      );
      expect(msg).toBeInTheDocument();
    });

    it("shows a fallback error message on HTTP 500", async () => {
      fetchMock.mockImplementation(makeDefaultMock(() => errorResponse(500)));

      render(<DashboardClient />);

      const msg = await screen.findByText(
        /Failed to load positions data\. Please try again later\./i,
      );
      expect(msg).toBeInTheDocument();
    });

    it("shows a fallback error message on HTTP 401", async () => {
      fetchMock.mockImplementation(makeDefaultMock(() => errorResponse(401)));

      render(<DashboardClient />);

      const msg = await screen.findByText(/Failed to load positions data/i);
      expect(msg).toBeInTheDocument();
    });

    it("renders the error inside an accessible [role=alert] element", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() => Promise.reject(new Error("Network error"))),
      );

      render(<DashboardClient />);

      const msg = await screen.findByText(/Failed to load positions data/i);
      const alertEl = msg.closest('[role="alert"]');
      expect(alertEl).not.toBeNull();
    });

    it("does NOT render the normal alert banner when fetch fails", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() => Promise.reject(new Error("Network error"))),
      );

      render(<DashboardClient />);

      // Wait for error state to settle
      await screen.findByText(/Failed to load positions data/i);

      expect(
        screen.queryByText(
          /Immediate action required|Payment due soon|Upcoming payment/i,
        ),
      ).not.toBeInTheDocument();
    });

    it("renders a retry button when in error state", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() => Promise.reject(new Error("Network error"))),
      );

      render(<DashboardClient />);

      await screen.findByText(/Failed to load positions data/i);

      const retryBtn = screen.getByRole("button", { name: /retry/i });
      expect(retryBtn).toBeInTheDocument();
    });

    it("clears error state and shows data after clicking Retry", async () => {
      let callCount = 0;
      fetchMock.mockImplementation((url: string) => {
        if (url.includes("/api/positions")) {
          callCount += 1;
          return callCount === 1
            ? Promise.reject(new Error("Network error"))
            : jsonResponse({ nextDue: "5 days", healthFactor: 1.5 });
        }
        return makeDefaultMock()(url);
      });

      render(<DashboardClient />);

      await screen.findByText(/Failed to load positions data/i);

      screen.getByRole("button", { name: /retry/i }).click();

      await waitFor(() =>
        expect(
          screen.queryByText(/Failed to load positions data/i),
        ).not.toBeInTheDocument(),
      );
    });

    it("does not expose raw server error details in the UI", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() =>
          Promise.reject(
            new Error(
              "500 Internal Server Error — https://internal.api/trace/99",
            ),
          ),
        ),
      );

      render(<DashboardClient />);

      const msg = await screen.findByText(/Failed to load positions data/i);
      const bannerText = msg.closest('[role="alert"]')?.textContent ?? "";

      expect(bannerText).not.toContain("500");
      expect(bannerText).not.toContain("Internal Server Error");
      expect(bannerText).not.toContain("https://internal.api");
    });

    it("treats a malformed JSON response as a failure", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => {
              throw new SyntaxError("Unexpected token");
            },
          } as unknown as Response),
        ),
      );

      render(<DashboardClient />);

      const msg = await screen.findByText(/Failed to load positions data/i);
      expect(msg).toBeInTheDocument();
    });

    it("treats a response with a missing healthFactor as a failure", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() => jsonResponse({ nextDue: "5 days" })),
      );

      render(<DashboardClient />);

      const msg = await screen.findByText(/Failed to load positions data/i);
      expect(msg).toBeInTheDocument();
    });

    it("treats a null response body as a failure", async () => {
      fetchMock.mockImplementation(
        makeDefaultMock(() => jsonResponse(null)),
      );

      render(<DashboardClient />);

      const msg = await screen.findByText(/Failed to load positions data/i);
      expect(msg).toBeInTheDocument();
    });
  });
});
