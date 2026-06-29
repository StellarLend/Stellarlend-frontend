import React from "react";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecentTransactions } from "./RecentTransactions";
import type { Transaction } from "@/types/Transaction";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: any) => (
    <img src={src} alt={alt} width={width} height={height} />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("@headlessui/react", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  Transition: ({ children }: any) => <>{children}</>,
  TransitionChild: ({ children }: any) => <>{children}</>,
}));

const mockWalletNetwork = vi.hoisted(() => ({ current: "TESTNET" }));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: mockWalletNetwork.current }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeTxn = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "txn-001",
  type: "Deposit",
  amount: 100,
  asset: "USDC",
  date: "2024-01-15",
  time: "10:30AM",
  status: "Completed",
  ...overrides,
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

  // --- Structural ---

  it("renders the section heading", async () => {
    render(<RecentTransactions />);
    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
  });

  it("renders the View All button", () => {
    render(<RecentTransactions />);
    expect(
      screen.getByRole("button", { name: /view all/i }),
    ).toBeInTheDocument();
  });

  // --- Loading state ---

  it("shows loading skeleton initially", () => {
    render(<RecentTransactions />);
    expect(screen.getByLabelText("Loading transactions")).toBeInTheDocument();
  });

  // --- Empty feed ---

  it("shows empty state when there are no transactions", async () => {
    mockApi([]);
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

  it("renders the toolbar filter toggle", async () => {
    render(<RecentTransactions />);
    expect(screen.getByText("Filter")).toBeInTheDocument();
  });
});
