import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecentTransactions } from "./RecentTransactions";
import { useInfiniteTransactions } from "@/hooks/useInfiniteTransactions";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, className }: any) => (
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

vi.mock("@/hooks/useInfiniteTransactions", () => ({
  useInfiniteTransactions: vi.fn(),
}));

describe("RecentTransactions sorting", () => {
  const replace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    replace.mockReset();

    (useRouter as any).mockReturnValue({ replace });
    (usePathname as any).mockReturnValue("/dashboard");
    (useSearchParams as any).mockReturnValue(new URLSearchParams());

    (useInfiniteTransactions as any).mockReturnValue({
      transactions: [
        { id: "txn-1", type: "Lend", amount: 100, asset: "XLM", date: "2024-02-01", time: "09:00", status: "Completed" },
        { id: "txn-2", type: "Borrow", amount: 250, asset: "USDC", date: "2024-01-15", time: "10:00", status: "Processing" },
        { id: "txn-3", type: "Repay", amount: 250, asset: "BTC", date: "2024-03-10", time: "11:00", status: "Failed" },
      ],
      isLoading: false,
      isLoadingMore: false,
      isError: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("sorts the loaded feed by amount and exposes the active sort state", () => {
    render(<RecentTransactions />);

    const amountButton = screen.getByRole("button", { name: /sort by amount/i });
    fireEvent.click(amountButton);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("txn-2");
    expect(rows[0]).toHaveTextContent("$250");
    expect(rows[1]).toHaveTextContent("txn-3");
    expect(rows[2]).toHaveTextContent("txn-1");

    const amountHeader = screen.getByRole("columnheader", { name: /amount/i });
    expect(amountHeader).toHaveAttribute("aria-sort", "descending");
  });

  it("persists the active sort in the URL query and toggles direction with the keyboard", () => {
    render(<RecentTransactions />);

    const statusButton = screen.getByRole("button", { name: /sort by status/i });
    fireEvent.keyDown(statusButton, { key: "Enter" });

    expect(replace).toHaveBeenCalledWith("/dashboard?sort=status&order=asc", { scroll: false });

    fireEvent.keyDown(statusButton, { key: " " });

    expect(replace).toHaveBeenLastCalledWith("/dashboard?sort=status&order=desc", { scroll: false });
  });
});
