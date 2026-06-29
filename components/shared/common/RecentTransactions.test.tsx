import React from "react";
import { render, screen, waitFor } from "@/test/test-utils";
import { RecentTransactions } from "./RecentTransactions";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TX_HOOK_STATE } from "@/lib/tx/constants";
import type { Transaction } from "@/types/Transaction";

// ── Hoisted mocks ───────────────────────────────────────────────────────────

const mockUseTxStatus = vi.hoisted(() => vi.fn());

const mockFetchTransactions = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    transactions: [
      { id: "TXN-001", type: "Deposit",    amount: 100,  asset: "XLM",  date: "2024-04-01", time: "10:00AM", status: "Completed" },
      { id: "TXN-002", type: "Withdrawal", amount: -50,  asset: "USDC", date: "2024-04-02", time: "11:00AM", status: "Processing" },
      { id: "TXN-003", type: "Lend Funds", amount: 200,  asset: "BTC",  date: "2024-04-03", time: "12:00PM", status: "Completed" },
    ],
    total: 3,
  })
);

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/tx/useTxStatus", () => ({
  default: (...args: unknown[]) => mockUseTxStatus(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    let Comp: React.ComponentType<unknown> | null = null;
    loader().then((m) => { Comp = m.default; });
    return function DynamicResolved(props: unknown) {
      return Comp
        ? React.createElement(Comp, props as Record<string, unknown>)
        : React.createElement("div", null, "Loading\u2026");
    };
  },
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, className }: { src: string; alt: string; width: number; height: number; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

vi.mock("@/types/Transaction", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/types/Transaction")>();
  return { ...original, fetchTransactions: mockFetchTransactions };
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("RecentTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTxStatus.mockReturnValue(null);
    mockFetchTransactions.mockResolvedValue({
      transactions: [
        { id: "TXN-001", type: "Deposit",    amount: 100,  asset: "XLM",  date: "2024-04-01", time: "10:00AM", status: "Completed" },
        { id: "TXN-002", type: "Withdrawal", amount: -50,  asset: "USDC", date: "2024-04-02", time: "11:00AM", status: "Processing" },
        { id: "TXN-003", type: "Lend Funds", amount: 200,  asset: "BTC",  date: "2024-04-03", time: "12:00PM", status: "Completed" },
      ],
      total: 3,
    });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders without crashing and shows heading", async () => {
    render(<RecentTransactions />);
    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
    expect(screen.getByText("View All")).toBeInTheDocument();
  });

  it("renders transaction data after loading", async () => {
    render(<RecentTransactions />);

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    expect(screen.getAllByText("Deposit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Withdrawal").length).toBeGreaterThan(0);
  });

  it("does not render a pending row when no inFlightTx is provided", async () => {
    render(<RecentTransactions />);

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("Pending…")).not.toBeInTheDocument();
  });

  it("renders a pending row at the top when inFlightTx is provided and status is processing", async () => {
    mockUseTxStatus.mockReturnValue({ state: TX_HOOK_STATE.PROCESSING });

    render(
      <RecentTransactions
        inFlightTx={{
          hash: "abc123def456",
          type: "Deposit",
          amount: 500,
          asset: "XLM",
        }}
      />
    );

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    const pendingBadges = screen.getAllByText("Processing");
    expect(pendingBadges.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending…").length).toBeGreaterThan(0);
  });

  it("removes pending row when useTxStatus reaches completed", async () => {
    mockUseTxStatus.mockReturnValue({ state: TX_HOOK_STATE.PROCESSING });

    const { rerender } = render(
      <RecentTransactions
        inFlightTx={{
          hash: "abc123def456",
          type: "Deposit",
          amount: 500,
          asset: "XLM",
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("Pending…").length).toBeGreaterThan(0);
    });

    mockUseTxStatus.mockReturnValue({ state: TX_HOOK_STATE.COMPLETED, result: {} });

    rerender(
      <RecentTransactions
        inFlightTx={{
          hash: "abc123def456",
          type: "Deposit",
          amount: 500,
          asset: "XLM",
        }}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText("Pending…")).not.toBeInTheDocument();
    });
  });

  it("shows failed status when useTxStatus reaches failed", async () => {
    mockUseTxStatus.mockReturnValue({ state: TX_HOOK_STATE.FAILED, error: new Error("not found") });

    render(
      <RecentTransactions
        inFlightTx={{
          hash: "abc123def456",
          type: "Deposit",
          amount: 500,
          asset: "XLM",
        }}
      />
    );

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
  });

  it("deduplicates pending row when real transaction lands with matching data", async () => {
    mockUseTxStatus.mockReturnValue({ state: TX_HOOK_STATE.PROCESSING });

    mockFetchTransactions.mockResolvedValue({
      transactions: [
        { id: "TXN-999", type: "Deposit", amount: 500, asset: "XLM", date: "2024-04-04", time: "01:00PM", status: "Completed" },
        { id: "TXN-001", type: "Deposit", amount: 100, asset: "XLM", date: "2024-04-01", time: "10:00AM", status: "Completed" },
      ],
      total: 2,
    });

    render(
      <RecentTransactions
        inFlightTx={{
          hash: "abc123def456",
          type: "Deposit",
          amount: 500,
          asset: "XLM",
        }}
      />
    );

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("Pending…")).not.toBeInTheDocument();

    const depositRows = screen.getAllByText("Deposit");
    expect(depositRows.length).toBeGreaterThanOrEqual(2);
  });

  it("shows pending row when useTxStatus returns rate_limited", async () => {
    mockUseTxStatus.mockReturnValue({ state: TX_HOOK_STATE.RATE_LIMITED, retryAfterSeconds: 30 });

    render(
      <RecentTransactions
        inFlightTx={{
          hash: "abc123def456",
          type: "Loan Payment",
          amount: 100,
          asset: "USDC",
        }}
      />
    );

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    expect(screen.getAllByText("Pending…").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Processing").length).toBeGreaterThan(0);
  });

  it("renders pending row before fetched transactions (at the top)", async () => {
    mockUseTxStatus.mockReturnValue({ state: TX_HOOK_STATE.PROCESSING });

    render(
      <RecentTransactions
        inFlightTx={{
          hash: "abc123def456",
          type: "Deposit",
          amount: 500,
          asset: "XLM",
        }}
      />
    );

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    const table = document.querySelector("table");
    if (table) {
      const rows = table.querySelectorAll("tbody tr");
      const firstRow = rows[0];
      expect(firstRow?.className).toContain("animate-pulse");
    }
  });

  it("shows Pending… action text instead of Details button for pending row", async () => {
    mockUseTxStatus.mockReturnValue({ state: TX_HOOK_STATE.PROCESSING });

    render(
      <RecentTransactions
        inFlightTx={{
          hash: "abc123def456",
          type: "Deposit",
          amount: 500,
          asset: "XLM",
        }}
      />
    );

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    const pendingActions = screen.getAllByText("Pending…");
    expect(pendingActions.length).toBeGreaterThan(0);
  });

  it("passes null hash to useTxStatus when no inFlightTx", () => {
    render(<RecentTransactions />);
    expect(mockUseTxStatus).toHaveBeenCalledWith(null);
  });

  it("passes hash to useTxStatus when inFlightTx is provided", () => {
    render(
      <RecentTransactions
        inFlightTx={{
          hash: "mytesthash123",
          type: "Deposit",
          amount: 100,
          asset: "XLM",
        }}
      />
    );
    expect(mockUseTxStatus).toHaveBeenCalledWith("mytesthash123");
  });

  it("does not show pending row when useTxStatus returns null (initial state)", async () => {
    mockUseTxStatus.mockReturnValue(null);

    render(
      <RecentTransactions
        inFlightTx={{
          hash: "abc123def456",
          type: "Deposit",
          amount: 500,
          asset: "XLM",
        }}
      />
    );

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("Pending…")).not.toBeInTheDocument();
  });

  it("shows loading skeleton initially", () => {
    render(<RecentTransactions />);
    expect(screen.getByLabelText("Loading transactions")).toBeInTheDocument();
  });

  it("shows empty state when there are no transactions", async () => {
    mockFetchTransactions.mockResolvedValue({ transactions: [], total: 0 });
    render(<RecentTransactions />);
    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
  });

  it("renders toolbar search toggle", async () => {
    render(<RecentTransactions />);
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("renders toolbar filter toggle", async () => {
    render(<RecentTransactions />);
    expect(screen.getByText("Filter")).toBeInTheDocument();
  });
});
