import React from 'react';
import { render, screen, waitFor, fireEvent } from "@/test/test-utils";
import { Transactions } from "./Transaction";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mock data (must be declared before vi.mock calls are hoisted) ───

const mockFetchTransactions = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    transactions: [
      { id: "TXN-001", type: "Deposit",    amount: 100,  asset: "XLM",  date: "2024-04-01", time: "10:00AM", status: "Completed" },
      { id: "TXN-002", type: "Withdrawal", amount: -50,  asset: "USDC", date: "2024-04-02", time: "11:00AM", status: "Processing" },
      { id: "TXN-003", type: "Lend",       amount: 200,  asset: "BTC",  date: "2024-04-03", time: "12:00PM", status: "Completed" },
    ],
    total: 3,
  })
);

// ── Module mocks ─────────────────────────────────────────────────────────────

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

describe("Transactions Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-assert the resolved value after clearAllMocks resets it
    mockFetchTransactions.mockResolvedValue({
      transactions: [
        { id: "TXN-001", type: "Deposit",    amount: 100,  asset: "XLM",  date: "2024-04-01", time: "10:00AM", status: "Completed" },
        { id: "TXN-002", type: "Withdrawal", amount: -50,  asset: "USDC", date: "2024-04-02", time: "11:00AM", status: "Processing" },
        { id: "TXN-003", type: "Lend",       amount: 200,  asset: "BTC",  date: "2024-04-03", time: "12:00PM", status: "Completed" },
      ],
      total: 3,
    });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders skeleton loading state initially", () => {
    render(<Transactions />);
    expect(screen.getByText("Transaction Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading transactions")).toBeInTheDocument();
  });

  it("renders transaction table headers after data loads", async () => {
    render(<Transactions />);

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Transaction Type")).toBeInTheDocument();
    expect(screen.getAllByText("Amount").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Asset").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Date").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
  });

  it("renders transaction rows with loaded data", async () => {
    render(<Transactions />);

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    expect(screen.getAllByText("Deposit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Withdrawal").length).toBeGreaterThan(0);
  });

  it("renders mobile cards with Type and Asset labels", async () => {
    render(<Transactions />);

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    expect(screen.getAllByText("Type").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Asset").length).toBeGreaterThan(0);
  });

  it("shows the search input when Search is clicked", async () => {
    render(<Transactions />);

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Search"));
    expect(screen.getByPlaceholderText(/Search by type/i)).toBeInTheDocument();
  });

  it("opens TransactionDetail modal (lazy-loaded) when Details is clicked", async () => {
    render(<Transactions />);

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    const detailButtons = await screen.findAllByRole("button", { name: /details/i });
    expect(detailButtons.length).toBeGreaterThan(0);
    fireEvent.click(detailButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Transaction Details")).toBeInTheDocument();
    });
  });

  it("closes TransactionDetail modal when close button is clicked", async () => {
    render(<Transactions />);

    await waitFor(() => {
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
    });

    const detailButtons = await screen.findAllByRole("button", { name: /details/i });
    fireEvent.click(detailButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Transaction Details")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => {
      expect(screen.queryByText("Transaction Details")).not.toBeInTheDocument();
    });
  });
});
