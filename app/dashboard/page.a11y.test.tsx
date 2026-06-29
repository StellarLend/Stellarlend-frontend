import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { render, screen, waitFor } from "@/test/test-utils";
import DashboardPage from "./page";

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
          json: async () => ([]),
        });
      }
      if (url.includes("/api/notifications")) {
        return Promise.resolve({
          ok: true,
          json: async () => ([]),
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
      return Promise.resolve({
        ok: true,
        json: async () => ([]),
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
});
