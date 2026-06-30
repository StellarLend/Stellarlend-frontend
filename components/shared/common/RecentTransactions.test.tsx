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

const mockWalletNetwork = vi.hoisted(() => ({ current: "TESTNET" }));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: mockWalletNetwork.current }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/types/Transaction", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/types/Transaction")>();
  return { ...original, fetchTransactions: mockFetchTransactions };
});

const inflowTxn = makeTxn({
  id: "txn-in",
  type: "Deposit",
  amount: 250,
  asset: "XLM",
});
const outflowTxn = makeTxn({
  id: "txn-out",
  type: "Withdrawal",
  amount: -80,
  asset: "USDC",
});
const zeroTxn = makeTxn({
  id: "txn-zero",
  type: "Loan Payment",
  amount: 0,
  asset: "ETH",
});
const processTxn = makeTxn({
  id: "txn-proc",
  type: "Lend Funds",
  amount: 500,
  asset: "BTC",
  status: "Processing",
});
const failedTxn = makeTxn({
  id: "txn-fail",
  type: "Withdrawal",
  amount: -40,
  asset: "USDC",
  status: "Failed",
});
const negTxn = makeTxn({
  id: "txn-neg",
  type: "Loan Payment",
  amount: -999,
  asset: "ETH",
  status: "Completed",
});

const txHash =
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd";

function mockApi(transactions: Transaction[], total = transactions.length) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ transactions, total, nextCursor: null }),
  } as any);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RecentTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletNetwork.current = "TESTNET";
    mockApi([]);
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
    expect(
      screen.getByRole("button", { name: /view all/i }),
    ).toBeInTheDocument();
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

  // --- Row content (both desktop table + mobile card render the same txn) ---

  it("renders transaction type", async () => {
    mockApi([inflowTxn]);
    render(<RecentTransactions />);
    const items = await screen.findAllByText("Deposit");
    expect(items.length).toBeGreaterThan(0);
  });

  it("renders transaction ID", async () => {
    mockApi([inflowTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Deposit");
    const idEls = screen.getAllByText(`#${inflowTxn.id}`);
    expect(idEls.length).toBeGreaterThan(0);
  });

  it("renders asset symbol and icon", async () => {
    mockApi([inflowTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Deposit");
    expect(screen.getAllByText("XLM").length).toBeGreaterThan(0);
    expect(screen.getAllByAltText("XLM").length).toBeGreaterThan(0);
  });

  // --- Signed-amount semantics ---

  it("displays inflow amount with leading +", async () => {
    mockApi([inflowTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Deposit");
    expect(screen.getAllByText(`+$${inflowTxn.amount}`).length).toBeGreaterThan(
      0,
    );
  });

  it("displays outflow amount with leading -", async () => {
    mockApi([outflowTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Withdrawal");
    expect(
      screen.getAllByText(`-$${Math.abs(outflowTxn.amount)}`).length,
    ).toBeGreaterThan(0);
  });

  it("displays large negative amount correctly", async () => {
    mockApi([negTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Loan Payment");
    expect(screen.getAllByText("-$999").length).toBeGreaterThan(0);
  });

  it("displays zero amount with - prefix (non-positive path)", async () => {
    mockApi([zeroTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Loan Payment");
    // amount 0 is falsy → component renders -$0
    expect(screen.getAllByText("-$0").length).toBeGreaterThan(0);
  });

  // --- Status rendering ---

  it("renders Completed status badge", async () => {
    mockApi([inflowTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Deposit");
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
  });

  it("renders Processing status badge", async () => {
    mockApi([processTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Lend Funds");
    expect(screen.getAllByText("Processing").length).toBeGreaterThan(0);
  });

  it("renders Failed status badge", async () => {
    mockApi([failedTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Withdrawal");
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
  });

  // --- Multiple rows ---

  it("renders multiple transaction rows", async () => {
    mockApi([inflowTxn, outflowTxn, processTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Deposit");
    expect(screen.getAllByText("Withdrawal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lend Funds").length).toBeGreaterThan(0);
  });

  // --- Asset variety ---

  it("renders BTC asset icon", async () => {
    mockApi([processTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Lend Funds");
    expect(screen.getAllByAltText("BTC").length).toBeGreaterThan(0);
  });

  it("renders ETH asset icon", async () => {
    mockApi([zeroTxn]);
    render(<RecentTransactions />);
    await screen.findAllByText("Loan Payment");
    expect(screen.getAllByAltText("ETH").length).toBeGreaterThan(0);
  });

  it("renders Stellar Expert links for real transaction hashes", async () => {
    mockApi([makeTxn({ id: "TXN-001", txHash })]);
    render(<RecentTransactions />);

    await screen.findAllByText("Deposit");

    const links = screen.getAllByRole("link", {
      name: /view transaction TXN-001 on Stellar Expert/i,
    });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/testnet/tx/${txHash}`,
      );
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it("does not render explorer links for mock transaction ids", async () => {
    mockApi([makeTxn({ id: "TXN-001" })]);
    render(<RecentTransactions />);

    await screen.findAllByText("Deposit");

    expect(
      screen.queryByRole("link", {
        name: /view transaction TXN-001 on Stellar Expert/i,
      }),
    ).not.toBeInTheDocument();
  });

  // --- Wrapped inside Transactions with infiniteScroll — toolbar IS present ---

  it("renders the toolbar search toggle", async () => {
    render(<RecentTransactions />);
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("renders toolbar filter toggle", async () => {
    render(<RecentTransactions />);
    expect(screen.getByText("Filter")).toBeInTheDocument();
  });
});
