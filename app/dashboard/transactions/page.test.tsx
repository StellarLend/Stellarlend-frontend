import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import TransactionsPage, {
  MAX_SEARCH_LENGTH,
  normaliseTransactionFilters,
} from "./page";

/**
 * Focused coverage for the transactions dashboard page.
 *
 * The page is an orchestrator: it derives validated filters from the URL,
 * mounts the filter/table widgets, and relays the table's total count to the
 * filter bar. These tests pin the invariants the page is responsible for:
 * invalid URL input is dropped (fail closed), the count relay is bounded and
 * last-write-wins, and a failed summary fetch degrades to a zeroed, still
 * usable page instead of throwing.
 */

// ── Next.js stubs ────────────────────────────────────────────────────────────
const searchParamsRef = { current: new URLSearchParams() };
const routerReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
  usePathname: () => "/dashboard/transactions",
}));

// ── Data layer (real useTransactionSummary, controlled fetch) ─────────────────
const fetchTransactionsMock = vi.fn();

vi.mock("@/types/Transaction", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/types/Transaction")>();
  return {
    ...actual,
    fetchTransactions: (...args: unknown[]) => fetchTransactionsMock(...args),
  };
});

// ── Layout / shared stubs ─────────────────────────────────────────────────────
vi.mock("@/components", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

vi.mock("@/components/shared/common", () => ({
  PageHeader: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      <div data-testid="page-header-actions">{actions}</div>
    </header>
  ),
}));

// ── Feature-component stubs ───────────────────────────────────────────────────
vi.mock("@/components/features/dashboard/components", () => ({
  TransactionsSummaryHeader: ({
    inflow,
    outflow,
    net,
    isLoading,
  }: {
    inflow: number;
    outflow: number;
    net: number;
    isLoading: boolean;
  }) => (
    <div
      data-testid="summary"
      data-loading={String(isLoading)}
      data-inflow={inflow}
      data-outflow={outflow}
      data-net={net}
    />
  ),
}));

vi.mock("@/components/features/dashboard/components/FilterPresets", () => ({
  default: () => <div data-testid="filter-presets" />,
}));

vi.mock("@/components/features/dashboard/components/TransactionFilters", () => ({
  default: ({ totalCount }: { totalCount: number }) => (
    <div data-testid="transaction-filters" data-total={totalCount} />
  ),
}));

vi.mock(
  "@/components/features/dashboard/components/TransactionExportButton",
  () => ({
    TransactionExportButton: ({
      filters,
    }: {
      filters: Record<string, unknown>;
    }) => (
      <div data-testid="export-button" data-filters={JSON.stringify(filters)} />
    ),
  })
);

let transactionsPropsRef: {
  infiniteScroll?: boolean;
  hideToolbar?: boolean;
  onDataLoad?: (count: number) => void;
} = {};

vi.mock("@/components/shared/common/Transaction", () => ({
  Transactions: (props: typeof transactionsPropsRef) => {
    transactionsPropsRef = props;
    return (
      <div
        data-testid="transactions"
        data-infinite={String(props.infiniteScroll)}
        data-hide-toolbar={String(props.hideToolbar)}
      />
    );
  },
}));

const setSearchParams = (query: Record<string, string | string[]>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else {
      params.set(key, value);
    }
  }
  searchParamsRef.current = params;
};

const exportFilters = () =>
  JSON.parse(screen.getByTestId("export-button").dataset.filters ?? "{}");

/**
 * Renders the page and waits for the real summary hook's async fetch to settle,
 * so every state update happens inside `act` instead of leaking a warning.
 */
async function renderPage() {
  render(<TransactionsPage />);
  await waitFor(() =>
    expect(screen.getByTestId("summary").dataset.loading).toBe("false")
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchTransactionsMock.mockReset();
  transactionsPropsRef = {};
  searchParamsRef.current = new URLSearchParams();
  fetchTransactionsMock.mockResolvedValue({ transactions: [], total: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── normaliseTransactionFilters: invalid input is dropped (fail closed) ──────
describe("normaliseTransactionFilters", () => {
  it("keeps only values the transactions API accepts", () => {
    const filters = normaliseTransactionFilters(
      new URLSearchParams({
        status: "Completed",
        type: "borrow",
        asset: "xlm",
        fromDate: "2025-01-01",
        toDate: "2025-02-28",
        search: "  coffee  ",
      })
    );

    expect(filters).toEqual({
      status: "Completed",
      type: "borrow",
      asset: "XLM",
      fromDate: "2025-01-01",
      toDate: "2025-02-28",
      search: "coffee",
    });
  });

  it("drops malformed status, type, asset, and date values instead of forwarding them", () => {
    const filters = normaliseTransactionFilters(
      new URLSearchParams({
        status: "admin",
        type: "DROP TABLE",
        asset: "<script>",
        fromDate: "not-a-date",
        toDate: "2025-13-40",
      })
    );

    expect(filters).toEqual({});
  });

  it("drops empty and whitespace-only values", () => {
    const filters = normaliseTransactionFilters(
      new URLSearchParams({ status: "", type: "", asset: "", search: "   " })
    );

    expect(filters).toEqual({});
  });

  it("rejects calendar-invalid dates (no silent rollover)", () => {
    expect(
      normaliseTransactionFilters(new URLSearchParams({ fromDate: "2025-02-30" }))
    ).toEqual({});
    expect(
      normaliseTransactionFilters(new URLSearchParams({ toDate: "2025-00-10" }))
    ).toEqual({});
    // Leap day is accepted when valid.
    expect(
      normaliseTransactionFilters(new URLSearchParams({ fromDate: "2024-02-29" }))
    ).toEqual({ fromDate: "2024-02-29" });
  });

  it("truncates an oversized search term to the configured bound", () => {
    const filters = normaliseTransactionFilters(
      new URLSearchParams({ search: "x".repeat(MAX_SEARCH_LENGTH + 50) })
    );

    expect(filters.search).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it("resolves duplicate query keys to the first value", () => {
    const filters = normaliseTransactionFilters(
      new URLSearchParams([
        ["status", "Completed"],
        ["status", "Failed"],
      ])
    );

    expect(filters.status).toBe("Completed");
  });
});

// ── Page rendering ────────────────────────────────────────────────────────────
describe("TransactionsPage", () => {
  it("renders inside DashboardLayout with the header and its action", async () => {
    await renderPage();

    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Transactions" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("export-button")).toBeInTheDocument();
    expect(screen.getByTestId("filter-presets")).toBeInTheDocument();
    expect(screen.getByTestId("transaction-filters")).toBeInTheDocument();
  });

  it("configures the table for URL-driven infinite scroll without its own toolbar", async () => {
    await renderPage();

    const table = screen.getByTestId("transactions");
    expect(table.dataset.infinite).toBe("true");
    expect(table.dataset.hideToolbar).toBe("true");
  });

  it("forwards the validated URL filters to the export control", async () => {
    setSearchParams({
      status: "Processing",
      type: "repay",
      asset: "usdc",
      fromDate: "2025-03-01",
      toDate: "2025-03-31",
      search: "rent",
    });

    await renderPage();

    expect(exportFilters()).toEqual({
      status: "Processing",
      type: "repay",
      asset: "USDC",
      search: "rent",
      dateFrom: "2025-03-01",
      dateTo: "2025-03-31",
    });
  });

  it("never forwards hostile URL input to the export control", async () => {
    setSearchParams({
      status: "'; DROP TABLE transactions;--",
      type: "../../etc/passwd",
      asset: "<img src=x onerror=alert(1)>",
      fromDate: "9999-99-99",
      search: "   ",
    });

    await renderPage();

    expect(exportFilters()).toEqual({});
  });
});

// ── Summary: success, loading, and failure degradation ────────────────────────
describe("TransactionsPage summary", () => {
  it("renders loading state while the summary request is pending", () => {
    fetchTransactionsMock.mockReturnValue(new Promise(() => {}));

    render(<TransactionsPage />);

    expect(screen.getByTestId("summary").dataset.loading).toBe("true");
  });

  it("computes inflow, outflow, and net from the returned transactions", async () => {
    fetchTransactionsMock.mockResolvedValue({
      transactions: [{ amount: 100 }, { amount: -40 }, { amount: 25 }],
      total: 3,
    });

    render(<TransactionsPage />);

    await waitFor(() =>
      expect(screen.getByTestId("summary").dataset.loading).toBe("false")
    );

    const summary = screen.getByTestId("summary");
    expect(summary.dataset.inflow).toBe("125");
    expect(summary.dataset.outflow).toBe("40");
    expect(summary.dataset.net).toBe("85");
  });

  it("degrades to a zeroed summary when the request rejects, without crashing the page", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchTransactionsMock.mockRejectedValue(new Error("network down"));

    render(<TransactionsPage />);

    await waitFor(() =>
      expect(screen.getByTestId("summary").dataset.loading).toBe("false")
    );

    const summary = screen.getByTestId("summary");
    expect(summary.dataset.inflow).toBe("0");
    expect(summary.dataset.outflow).toBe("0");
    expect(summary.dataset.net).toBe("0");
    // The page remains interactive and the failure is logged for diagnosis.
    expect(screen.getByTestId("transactions")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });
});

// ── Count relay: boundaries, last-write-wins, failure recovery ───────────────
describe("TransactionsPage count relay", () => {
  it("relays the table's total count to the filter bar", async () => {
    await renderPage();
    expect(transactionsPropsRef.onDataLoad).toBeTypeOf("function");

    act(() => transactionsPropsRef.onDataLoad?.(12));

    expect(screen.getByTestId("transaction-filters").dataset.total).toBe("12");
  });

  it("clamps negative, NaN, and fractional totals to a safe integer", async () => {
    await renderPage();
    expect(transactionsPropsRef.onDataLoad).toBeTypeOf("function");

    act(() => transactionsPropsRef.onDataLoad?.(-5));
    expect(screen.getByTestId("transaction-filters").dataset.total).toBe("0");

    act(() => transactionsPropsRef.onDataLoad?.(Number.NaN));
    expect(screen.getByTestId("transaction-filters").dataset.total).toBe("0");

    act(() => transactionsPropsRef.onDataLoad?.(4.9));
    expect(screen.getByTestId("transaction-filters").dataset.total).toBe("4");
  });

  it("keeps the latest count when stale loads resolve out of order", async () => {
    await renderPage();
    expect(transactionsPropsRef.onDataLoad).toBeTypeOf("function");

    act(() => transactionsPropsRef.onDataLoad?.(30));
    act(() => transactionsPropsRef.onDataLoad?.(7));

    expect(screen.getByTestId("transaction-filters").dataset.total).toBe("7");
  });

  it("recovers to a fresh count after a failed load reports zero", async () => {
    await renderPage();
    expect(transactionsPropsRef.onDataLoad).toBeTypeOf("function");

    act(() => transactionsPropsRef.onDataLoad?.(0));
    expect(screen.getByTestId("transaction-filters").dataset.total).toBe("0");

    act(() => transactionsPropsRef.onDataLoad?.(9));
    expect(screen.getByTestId("transaction-filters").dataset.total).toBe("9");
  });
});
