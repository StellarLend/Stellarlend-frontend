import React from "react";
import { render, screen, waitFor } from "@/test/test-utils";
import { RecentTransactions } from "./RecentTransactions";
import { describe, it, expect, vi, beforeEach } from "vitest";
import useTxStatus from "@/lib/tx/useTxStatus";
import { useInfiniteTransactions } from "@/hooks/useInfiniteTransactions";

// Mocking Image since it's a Next.js component
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, className }: any) => (
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

// Mock Next.js navigation hooks
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(""),
  }),
}));

// Mock useTxStatus hook
vi.mock("@/lib/tx/useTxStatus", () => ({
  default: vi.fn(),
}));

// Mock useInfiniteTransactions hook
vi.mock("@/hooks/useInfiniteTransactions", () => ({
  useInfiniteTransactions: vi.fn(),
}));

describe("RecentTransactions Optimistic Pending Row", () => {
  const mockPendingTx = {
    hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    type: "Deposit" as const,
    amount: 125.5,
    asset: "USDC" as const,
  };

  const mockLoadedTransactions = [
    {
      id: "TXN_EXISTING",
      type: "Withdrawal" as const,
      amount: 50,
      asset: "XLM" as const,
      date: "2026-06-25",
      time: "10:00AM",
      status: "Completed" as const,
    },
  ];

  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default useTxStatus response
    (useTxStatus as any).mockReturnValue({ state: "processing" });
    // Default useInfiniteTransactions response
    (useInfiniteTransactions as any).mockReturnValue({
      transactions: [...mockLoadedTransactions],
      isLoading: false,
      isLoadingMore: false,
      isError: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reset: mockReset,
    });
  });

  it("renders normally when no pending transaction is provided", async () => {
    render(<RecentTransactions pendingTx={null} />);

    // The pending row should NOT be present
    expect(screen.queryByTestId("pending-tx-row")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pending-tx-card")).not.toBeInTheDocument();
    expect(screen.getAllByText("Withdrawal")[0]).toBeInTheDocument();
  });

  it("renders pending row at the top with processing status", async () => {
    (useTxStatus as any).mockReturnValue({ state: "processing" });

    render(<RecentTransactions pendingTx={mockPendingTx} />);

    // Check that the pending row appears in the desktop view
    const pendingRow = screen.getByTestId("pending-tx-row");
    expect(pendingRow).toBeInTheDocument();

    // Verify it contains details from pendingTx
    expect(screen.getAllByText("Deposit")[0]).toBeInTheDocument();
    expect(screen.getAllByText("+$125.5")[0]).toBeInTheDocument();
    expect(screen.getAllByText("USDC")[0]).toBeInTheDocument();

    // Verify it uses the StatusBadge with "Processing" label
    const badge = screen.getAllByRole("status").find(
      (el) => el.getAttribute("data-variant") === "pending"
    );
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toContain("Processing");
  });

  it("reconciles and dedupes pending row once the real transaction lands", async () => {
    // 1. Initial state: processing, list has only existing txn
    (useTxStatus as any).mockReturnValue({ state: "processing" });

    const { rerender } = render(<RecentTransactions pendingTx={mockPendingTx} />);

    expect(screen.getAllByText("Withdrawal")[0]).toBeInTheDocument();
    expect(screen.getByTestId("pending-tx-row")).toBeInTheDocument();

    // 2. Simulate transaction completion
    (useTxStatus as any).mockReturnValue({ state: "completed", result: {} });

    // 3. Rerender to trigger useEffect
    rerender(<RecentTransactions pendingTx={mockPendingTx} />);

    // 4. Verify that reset() was called to trigger refetch
    expect(mockReset).toHaveBeenCalled();

    // 5. Mock the resolved state where the landed transaction is now in the list
    (useInfiniteTransactions as any).mockReturnValue({
      transactions: [
        {
          id: mockPendingTx.hash,
          type: mockPendingTx.type,
          amount: mockPendingTx.amount,
          asset: mockPendingTx.asset,
          date: "2026-06-27",
          time: "11:00AM",
          status: "Completed" as const,
        },
        ...mockLoadedTransactions,
      ],
      isLoading: false,
      reset: mockReset,
    });

    // Rerender to reflect the refetched list
    rerender(<RecentTransactions pendingTx={mockPendingTx} />);

    // Once the real transaction lands, the pending row should NOT be rendered since it's deduped
    expect(screen.queryByTestId("pending-tx-row")).not.toBeInTheDocument();

    // The real landed transaction should be visible
    expect(screen.getAllByText("Deposit")[0]).toBeInTheDocument();
  });

  it("renders pending row as Failed when useTxStatus resolves to failed state", async () => {
    (useTxStatus as any).mockReturnValue({ state: "failed", error: "transaction failed" });

    render(<RecentTransactions pendingTx={mockPendingTx} />);

    const pendingRow = screen.getByTestId("pending-tx-row");
    expect(pendingRow).toBeInTheDocument();

    // Verify it uses the StatusBadge with "Failed" label
    const badge = screen.getAllByRole("status").find(
      (el) => el.getAttribute("data-variant") === "failed"
    );
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toContain("Failed");
  });

  it("is resilient to status poll errors or rate limit state and remains Processing", async () => {
    (useTxStatus as any).mockReturnValue({ state: "rate_limited", retryAfterSeconds: 30 });

    render(<RecentTransactions pendingTx={mockPendingTx} />);

    const pendingRow = screen.getByTestId("pending-tx-row");
    expect(pendingRow).toBeInTheDocument();

    // It remains in "Processing" fallback state
    const badge = screen.getAllByRole("status").find(
      (el) => el.getAttribute("data-variant") === "pending"
    );
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toContain("Processing");
  });
});
