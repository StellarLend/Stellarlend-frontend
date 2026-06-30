import React from "react";
import { render, screen, fireEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecentTransactions } from "./RecentTransactions";
import { rowRenderCounts, mobileRowRenderCounts } from "./TransactionRow";
import type { Transaction } from "@/types/Transaction";

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

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "TESTNET" }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const makeTxn = (
  id: string,
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id,
  type: "Deposit",
  amount: 100,
  asset: "USDC",
  date: "2024-01-15",
  time: "10:30AM",
  status: "Completed",
  ...overrides,
});

describe("RecentTransactions row memoisation performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rowRenderCounts.clear();
    mobileRowRenderCounts.clear();
  });

  it("only renders rows once on initial load", () => {
    const txns = [makeTxn("txn-1"), makeTxn("txn-2")];
    render(<RecentTransactions transactions={txns} />);

    expect(rowRenderCounts.get("txn-1")).toBe(1);
    expect(rowRenderCounts.get("txn-2")).toBe(1);
    expect(mobileRowRenderCounts.get("txn-1")).toBe(1);
    expect(mobileRowRenderCounts.get("txn-2")).toBe(1);
  });

  it("does not re-render unchanged rows when appending a page", () => {
    const page1 = [makeTxn("txn-1"), makeTxn("txn-2")];
    const { rerender } = render(<RecentTransactions transactions={page1} />);

    expect(rowRenderCounts.get("txn-1")).toBe(1);
    expect(rowRenderCounts.get("txn-2")).toBe(1);

    // Append page 2
    const page2 = [...page1, makeTxn("txn-3"), makeTxn("txn-4")];
    rerender(<RecentTransactions transactions={page2} />);

    // Existing unchanged rows must NOT re-render
    expect(rowRenderCounts.get("txn-1")).toBe(1);
    expect(rowRenderCounts.get("txn-2")).toBe(1);
    expect(mobileRowRenderCounts.get("txn-1")).toBe(1);
    expect(mobileRowRenderCounts.get("txn-2")).toBe(1);

    // Newly appended rows render exactly once
    expect(rowRenderCounts.get("txn-3")).toBe(1);
    expect(rowRenderCounts.get("txn-4")).toBe(1);
    expect(mobileRowRenderCounts.get("txn-3")).toBe(1);
    expect(mobileRowRenderCounts.get("txn-4")).toBe(1);
  });

  it("only re-renders changed rows when updating one row", () => {
    const txns = [makeTxn("txn-1"), makeTxn("txn-2"), makeTxn("txn-3")];
    const { rerender } = render(<RecentTransactions transactions={txns} />);

    expect(rowRenderCounts.get("txn-1")).toBe(1);
    expect(rowRenderCounts.get("txn-2")).toBe(1);
    expect(rowRenderCounts.get("txn-3")).toBe(1);

    // Update txn-2
    const updatedTxns = [
      txns[0],
      { ...txns[1], amount: 500, status: "Processing" as const },
      txns[2],
    ];
    rerender(<RecentTransactions transactions={updatedTxns} />);

    // Unchanged rows keep render count 1
    expect(rowRenderCounts.get("txn-1")).toBe(1);
    expect(rowRenderCounts.get("txn-3")).toBe(1);
    expect(mobileRowRenderCounts.get("txn-1")).toBe(1);
    expect(mobileRowRenderCounts.get("txn-3")).toBe(1);

    // Updated row re-renders (render count 2)
    expect(rowRenderCounts.get("txn-2")).toBe(2);
    expect(mobileRowRenderCounts.get("txn-2")).toBe(2);
  });

  it("handles reordering rows without unexpected behavior", () => {
    const txns = [makeTxn("txn-1"), makeTxn("txn-2"), makeTxn("txn-3")];
    const { rerender } = render(<RecentTransactions transactions={txns} />);

    expect(rowRenderCounts.get("txn-1")).toBe(1);
    expect(rowRenderCounts.get("txn-2")).toBe(1);
    expect(rowRenderCounts.get("txn-3")).toBe(1);

    // Reorder: reverse list [txn-3, txn-2, txn-1]
    const reordered = [txns[2], txns[1], txns[0]];
    rerender(<RecentTransactions transactions={reordered} />);

    // txn-2 remained at index 1 -> no re-render
    expect(rowRenderCounts.get("txn-2")).toBe(1);
    // txn-1 and txn-3 swapped indices (actualIndex prop changed) -> re-rendered
    expect(rowRenderCounts.get("txn-1")).toBe(2);
    expect(rowRenderCounts.get("txn-3")).toBe(2);

    // For mobile rows, actualIndex is not a prop -> no rows re-render on reorder!
    expect(mobileRowRenderCounts.get("txn-1")).toBe(1);
    expect(mobileRowRenderCounts.get("txn-2")).toBe(1);
    expect(mobileRowRenderCounts.get("txn-3")).toBe(1);
  });

  it("maintains stable callbacks so parent re-renders do not churn row identity", () => {
    const txns = [makeTxn("txn-1"), makeTxn("txn-2")];
    const { rerender } = render(<RecentTransactions transactions={txns} />);

    expect(rowRenderCounts.get("txn-1")).toBe(1);
    expect(rowRenderCounts.get("txn-2")).toBe(1);

    // Rerender parent with identical array reference
    rerender(<RecentTransactions transactions={txns} />);

    expect(rowRenderCounts.get("txn-1")).toBe(1);
    expect(rowRenderCounts.get("txn-2")).toBe(1);
  });

  it("clicking row details expands only the targeted row", () => {
    const txns = [makeTxn("txn-1"), makeTxn("txn-2")];
    render(<RecentTransactions transactions={txns} />);

    expect(rowRenderCounts.get("txn-1")).toBe(1);
    expect(rowRenderCounts.get("txn-2")).toBe(1);

    const buttons = screen.getAllByRole("button", { name: /details/i });
    fireEvent.click(buttons[0]); // Click desktop Details for txn-1

    // txn-1 expanded -> re-rendered
    expect(rowRenderCounts.get("txn-1")).toBe(2);
    // txn-2 unchanged -> skipped
    expect(rowRenderCounts.get("txn-2")).toBe(1);
  });
});
