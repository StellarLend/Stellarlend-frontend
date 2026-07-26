import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { render, screen, waitFor } from "@/test/test-utils";
import DashboardPage from "./page";

// Mock DashboardLayout to avoid loading TopNav, SideNav, and their providers
vi.mock("@/components", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-dashboard-layout">
      {children}
    </div>
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("DashboardPage A11y", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            nextDue: "5 days",
            healthFactor: 1.5,
          }),
        });
      }
      if (url.includes("/api/metrics")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            totalSupplied: 1000,
            totalBorrowed: 500,
            netApy: 5.5,
          }),
        });
      }
      if (url.includes("/api/transactions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactions: [], total: 0 }),
        });
      }
      if (url.includes("/api/notifications")) {
        return Promise.resolve({
          ok: true,
          json: async () => ([]),
        });
      }
      if (url.includes("/api/liquidations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ positions: [] }),
        });
      }
      // default mock
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("passes axe checks on the dashboard route shell (loaded state)", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/positions"));

    const heading = screen.getByRole("heading", { name: "Dashboard" });
    expect(heading).toBeInTheDocument();

    const results = await axe.run(document.body);
    
    // Assert against serious/critical impact only to avoid noisy failures
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toEqual([]);
  });
  
  it("passes axe checks on the dashboard route shell (empty state/critical alert)", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            nextDue: "0 days",
            healthFactor: 0.9,
          }),
        });
      }
      if (url.includes("/api/liquidations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ positions: [] }),
        });
      }
      if (url.includes("/api/transactions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactions: [], total: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    render(<DashboardPage />);
    
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/positions"));
    
    const alert = await screen.findByText(/Immediate action required|Collateral is critically weak/i);
    expect(alert).toBeInTheDocument();

    const results = await axe.run(document.body);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toEqual([]);
  });

  it("handles fetch failure gracefully and renders a user-visible error banner", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return Promise.reject(new Error("Network error"));
      }
      if (url.includes("/api/liquidations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ positions: [] }),
        });
      }
      if (url.includes("/api/transactions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactions: [], total: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    render(<DashboardPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/positions"));

    const errorAlert = await screen.findByText(/Failed to load positions data/i);
    expect(errorAlert).toBeInTheDocument();
    expect(screen.getAllByText("Error").length).toBeGreaterThan(0);

    const results = await axe.run(document.body);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toEqual([]);
  });

  it("handles fetch response not ok gracefully and renders a user-visible error banner", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });
      }
      if (url.includes("/api/liquidations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ positions: [] }),
        });
      }
      if (url.includes("/api/transactions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactions: [], total: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    render(<DashboardPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/positions"));

    const errorAlert = await screen.findByText(/Failed to load positions data/i);
    expect(errorAlert).toBeInTheDocument();
    expect(screen.getAllByText("Error").length).toBeGreaterThan(0);

    const results = await axe.run(document.body);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toEqual([]);
  });
});
