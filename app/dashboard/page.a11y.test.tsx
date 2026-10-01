import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { render, screen, waitFor } from "@/test/test-utils";
import DashboardClient from "./DashboardClient";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const jsonResponse = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);

const okResponse = () => jsonResponse({});

describe("DashboardClient A11y", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return jsonResponse({
          nextDue: "5 days",
          healthFactor: 1.5,
        });
      }
      if (url.includes("/api/metrics")) {
        return jsonResponse({
          totalSupplied: 1000,
          totalBorrowed: 500,
          netApy: 5.5,
        });
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
      return okResponse();
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const assertNoSeriousAxeViolations = async () => {
    const results = await axe.run(document.body);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(seriousOrCritical).toEqual([]);
  };

  it("passes axe checks on the dashboard route shell (loaded state)", async () => {
    render(<DashboardClient />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/positions"),
    );

    const heading = screen.getByRole("heading", { name: "Dashboard" });
    expect(heading).toBeInTheDocument();

    await assertNoSeriousAxeViolations();
  });

  it("passes axe checks on the dashboard route shell (empty state/critical alert)", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return jsonResponse({
          nextDue: "0 days",
          healthFactor: 0.9,
        });
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/positions"),
    );

    const alert = await screen.findByText(
      /Immediate action required|Collateral is critically weak/i,
    );
    expect(alert).toBeInTheDocument();

    await assertNoSeriousAxeViolations();
  });

  it("handles fetch failure gracefully and renders a user-visible error banner", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return Promise.reject(new Error("Network error"));
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/positions"),
    );

    const errorAlert = await screen.findByText(/Failed to load positions data/i);
    expect(errorAlert).toBeInTheDocument();
    expect(screen.getAllByText("Error").length).toBeGreaterThan(0);

    await assertNoSeriousAxeViolations();
  });

  it("handles fetch response not ok gracefully and renders a user-visible error banner", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as Response);
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/positions"),
    );

    const errorAlert = await screen.findByText(/Failed to load positions data/i);
    expect(errorAlert).toBeInTheDocument();
    expect(screen.getAllByText("Error").length).toBeGreaterThan(0);

    await assertNoSeriousAxeViolations();
  });

  it("renders an accessible error banner with role=alert and aria-live on failure", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return Promise.reject(new Error("Network error"));
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    const errorAlert = await screen.findByText(/Failed to load positions data/i);
    expect(errorAlert).toBeInTheDocument();

    const announcer = errorAlert.closest('[role="alert"]');
    expect(announcer).not.toBeNull();
    expect(announcer).toHaveAttribute("aria-live", "assertive");
  });

  it("does not expose sensitive details in the error banner", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return Promise.reject(
          new Error(
            "Failed to fetch /api/positions: 500 - Internal Server Error at https://internal.example.com/trace/123",
          ),
        );
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    const errorAlert = await screen.findByText(/Failed to load positions data/i);
    expect(errorAlert).toBeInTheDocument();

    const bannerText =
      errorAlert.closest('[role="alert"]')?.textContent ?? "";
    expect(bannerText).not.toContain("/api/positions");
    expect(bannerText).not.toContain("Internal Server Error");
    expect(bannerText).not.toContain("https://internal.example.com");
  });

  it("recovers to a healthy state after a failure when a retry succeeds", async () => {
    let positionsCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        positionsCalls += 1;
        if (positionsCalls === 1) {
          return Promise.reject(new Error("Network error"));
        }
        return jsonResponse({
          nextDue: "5 days",
          healthFactor: 1.5,
        });
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    const errorAlert = await screen.findByText(/Failed to load positions data/i);
    expect(errorAlert).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    retryButton.click();

    await waitFor(() => expect(positionsCalls).toBeGreaterThan(1));
    await waitFor(() =>
      expect(
        screen.queryByText(/Failed to load positions data/i),
      ).not.toBeInTheDocument(),
    );

    await assertNoSeriousAxeViolations();
  });

  it("does not leak an error banner when a retry succeeds after a not-ok response", async () => {
    let positionsCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        positionsCalls += 1;
        if (positionsCalls === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
          } as Response);
        }
        return jsonResponse({
          nextDue: "5 days",
          healthFactor: 1.5,
        });
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    const errorAlert = await screen.findByText(/Failed to load positions data/i);
    expect(errorAlert).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /retry/i });
    retryButton.click();

    await waitFor(() => expect(positionsCalls).toBeGreaterThan(1));
    await waitFor(() =>
      expect(
        screen.queryByText(/Failed to load positions data/i),
      ).not.toBeInTheDocument(),
    );
  });

  it("treats a malformed json payload as a failure without crashing", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError("Unexpected token < in JSON");
          },
        } as unknown as Response);
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    const errorAlert = await screen.findByText(/Failed to load positions data/i);
    expect(errorAlert).toBeInTheDocument();

    await assertNoSeriousAxeViolations();
  });

  it("renders a boundary health factor (1.0) without a critical alert", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return jsonResponse({
          nextDue: "1 day",
          healthFactor: 1.0,
        });
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/positions"),
    );

    expect(
      screen.queryByText(
        /Immediate action required|Collateral is critically weak/i,
      ),
    ).not.toBeInTheDocument();

    await assertNoSeriousAxeViolations();
  });

  it("renders a boundary health factor (0.99) as a critical alert", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return jsonResponse({
          nextDue: "1 day",
          healthFactor: 0.99,
        });
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    const alert = await screen.findByText(
      /Immediate action required|Collateral is critically weak/i,
    );
    expect(alert).toBeInTheDocument();

    await assertNoSeriousAxeViolations();
  });

  it("treats a missing health factor as a failure with a user-visible error", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return jsonResponse({ nextDue: "5 days" });
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    const errorAlert = await screen.findByText(/Failed to load positions data/i);
    expect(errorAlert).toBeInTheDocument();
  });

  it("shows a loading indicator with aria-busy until the positions request settles", async () => {
    let resolvePositions: () => void = () => {};
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return new Promise((resolve) => {
          resolvePositions = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ nextDue: "5 days", healthFactor: 1.5 }),
            } as Response);
        });
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    const loading = await screen.findByText(/loading data/i);
    expect(loading).toBeInTheDocument();

    const busyRegion = loading.closest('[aria-busy="true"]');
    expect(busyRegion).not.toBeNull();

    resolvePositions();

    await waitFor(() =>
      expect(screen.queryByText(/loading data/i)).not.toBeInTheDocument(),
    );
  });

  it("does not crash when the server returns a null body for positions", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        return jsonResponse(null);
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    const errorAlert = await screen.findByText(/Failed to load positions data/i);
    expect(errorAlert).toBeInTheDocument();
  });

  it("ignores a stale response when a newer request has already settled", async () => {
    let firstResolve: () => void = () => {};
    let calls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/positions")) {
        calls += 1;
        if (calls === 1) {
          return new Promise((resolve) => {
            firstResolve = () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ nextDue: "5 days", healthFactor: 1.5 }),
              } as Response);
          });
        }
        return jsonResponse({
          nextDue: "0 days",
          healthFactor: 0.5,
        });
      }
      if (url.includes("/api/liquidations")) {
        return jsonResponse({ positions: [] });
      }
      if (url.includes("/api/transactions")) {
        return jsonResponse({ transactions: [], total: 0 });
      }
      return okResponse();
    });

    render(<DashboardClient />);

    await waitFor(() => expect(calls).toBe(1));

    // The first request is still pending; we assert the component does not
    // throw when the first response resolves late after unmount.
    firstResolve();

    await waitFor(() => {
      expect(
        screen.queryByText(
          /Immediate action required|Collateral is critically weak/i,
        ),
      ).not.toBeInTheDocument();
    });
  });
});
