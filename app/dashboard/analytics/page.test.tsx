import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AnalyticsPage from "./page";

// ── Next.js stubs ─────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard/analytics",
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

// ── Layout / shared stubs ─────────────────────────────────────────────────────
vi.mock("@/components", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

vi.mock("@/components/shared/common", () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <div data-testid="page-header-actions">{actions}</div>
    </div>
  ),
}));

vi.mock("@/components/shared/common/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

// ── Feature-component stubs ───────────────────────────────────────────────────
vi.mock("@/components/features/dashboard/components/MetricsCards", () => ({
  default: () => <div data-testid="metrics-cards" />,
}));

vi.mock("@/components/features/dashboard/components/SupplyApyChart", () => ({
  SupplyApyChart: () => <div data-testid="supply-apy-chart" />,
}));

vi.mock("@/components/features/dashboard/components/NetWorthTrend", () => ({
  default: () => <div data-testid="net-worth-trend" />,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("AnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders inside DashboardLayout", () => {
    render(<AnalyticsPage />);
    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
  });

  it("renders the Analytics page heading", () => {
    render(<AnalyticsPage />);
    expect(screen.getByRole("heading", { name: /analytics/i })).toBeInTheDocument();
  });

  it("renders the Export CSV button", () => {
    render(<AnalyticsPage />);
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  it("renders chart components", () => {
    render(<AnalyticsPage />);
    expect(screen.getByTestId("net-worth-trend")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-cards")).toBeInTheDocument();
    expect(screen.getByTestId("supply-apy-chart")).toBeInTheDocument();
  });

  it("does not expose a dead exportCSV function on the module", async () => {
    const mod = await import("./page");
    // The module must not export any function named exportCSV.
    expect((mod as Record<string, unknown>).exportCSV).toBeUndefined();
  });

  it("Export CSV button calls serializeTransactionsToCSV (shared utility), not a local naive join", async () => {
    const mockSerialize = vi.fn().mockReturnValue("id,type\n");
    vi.doMock("@/lib/transactions/csv", () => ({
      serializeTransactionsToCSV: mockSerialize,
    }));

    // The module-level fetch mock for the transaction endpoint
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transactions: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<AnalyticsPage />);
    const button = screen.getByRole("button", { name: /export csv/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/transactions", { method: "GET" });
    });
  });
});
