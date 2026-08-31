import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Transactions } from "../Transaction";
import { fetchTransactions } from "@/types/Transaction";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const DynamicComponent = (props: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props} />
    );
    return DynamicComponent;
  },
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt="" {...props} />
  ),
}));

vi.mock("react-datepicker", () => ({
  __esModule: true,
  default: () => <div />,
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "TESTNET" }),
}));

vi.mock("@/types/Transaction", async () => {
  const actual = await vi.importActual<typeof import("@/types/Transaction")>(
    "@/types/Transaction",
  );
  return {
    ...actual,
    fetchTransactions: vi.fn(),
  };
});

const mockedFetchTransactions = vi.mocked(fetchTransactions);

function makeTransaction(id: number) {
  // Distinct, strictly decreasing timestamps (id 1 = most recent) so the
  // default "date desc" sort has no ties to break and preserves a
  // predictable id order across the suite.
  const timestamp = new Date(2024, 0, 1, 12, 0, 0);
  timestamp.setMinutes(timestamp.getMinutes() - id);
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    id: `tx-${id}`,
    type: id % 2 === 0 ? "Borrow" : "Repay",
    amount: id * 10,
    asset: "XLM",
    date: `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}`,
    time: timestamp.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    status: "Completed" as const,
  };
}

describe("Transactions virtualization", () => {
  beforeEach(() => {
    mockedFetchTransactions.mockReset();
  });

  it("renders the full list when the history is small", async () => {
    mockedFetchTransactions.mockResolvedValue({
      transactions: Array.from({ length: 4 }, (_, index) =>
        makeTransaction(index + 1),
      ),
      total: 4,
    });

    render(<Transactions showPagination={false} />);

    await waitFor(() =>
      expect(screen.getAllByText("#tx-4").length).toBeGreaterThan(0),
    );

    expect(
      screen.queryByTestId("transactions-virtualizer"),
    ).not.toBeInTheDocument();
  });

  it("only mounts visible rows for large histories", async () => {
    const transactions = Array.from({ length: 200 }, (_, index) =>
      makeTransaction(index + 1),
    );
    mockedFetchTransactions.mockResolvedValue({
      transactions,
      total: transactions.length,
    });

    render(<Transactions showPagination={false} />);

    await waitFor(() =>
      expect(screen.getAllByText("#tx-1").length).toBeGreaterThan(0),
    );

    expect(screen.queryAllByText("#tx-150")).toHaveLength(0);
    expect(screen.getByTestId("transactions-virtualizer")).toBeInTheDocument();
  });

  it("supports keyboard navigation across the visible window", async () => {
    const transactions = Array.from({ length: 20 }, (_, index) =>
      makeTransaction(index + 1),
    );
    mockedFetchTransactions.mockResolvedValue({
      transactions,
      total: transactions.length,
    });

    render(<Transactions showPagination={false} rowHeight={40} />);

    await waitFor(() =>
      expect(screen.getAllByText("#tx-1").length).toBeGreaterThan(0),
    );

    const firstRow = screen.getAllByRole("row", {
      name: /transaction tx-1/i,
    })[0];
    firstRow.focus();

    fireEvent.keyDown(firstRow, { key: "ArrowDown" });

    await waitFor(() =>
      expect(
        screen.getAllByRole("row", { name: /transaction tx-2/i })[0],
      ).toHaveFocus(),
    );
  });

  it("uses the provided row height for the virtualized window", async () => {
    const transactions = Array.from({ length: 50 }, (_, index) =>
      makeTransaction(index + 1),
    );
    mockedFetchTransactions.mockResolvedValue({
      transactions,
      total: transactions.length,
    });

    render(<Transactions showPagination={false} rowHeight={44} />);

    await waitFor(() =>
      expect(screen.getAllByText("#tx-1").length).toBeGreaterThan(0),
    );

    const virtualizer = screen.getByTestId("transactions-virtualizer");
    expect(virtualizer).toHaveStyle({ height: "560px" });
  });

  it("re-measures the visible window instead of rendering blank rows when scrolled partway down", async () => {
    const transactions = Array.from({ length: 200 }, (_, index) =>
      makeTransaction(index + 1),
    );
    mockedFetchTransactions.mockResolvedValue({
      transactions,
      total: transactions.length,
    });

    render(<Transactions showPagination={false} rowHeight={40} />);

    await waitFor(() =>
      expect(screen.getAllByText("#tx-1").length).toBeGreaterThan(0),
    );

    const virtualizer = screen.getByTestId("transactions-virtualizer");

    fireEvent.scroll(virtualizer, { target: { scrollTop: 4000 } });

    await waitFor(() =>
      expect(screen.getAllByText("#tx-100").length).toBeGreaterThan(0),
    );
    expect(screen.queryAllByText("#tx-1")).toHaveLength(0);
    expect(screen.queryAllByText("#tx-200")).toHaveLength(0);
  });

  it("does not jump or leave a blank viewport when the sort order changes mid-scroll", async () => {
    const transactions = Array.from({ length: 200 }, (_, index) =>
      makeTransaction(index + 1),
    );
    mockedFetchTransactions.mockResolvedValue({
      transactions,
      total: transactions.length,
    });

    render(<Transactions showPagination={false} rowHeight={40} />);

    await waitFor(() =>
      expect(screen.getAllByText("#tx-1").length).toBeGreaterThan(0),
    );

    // Switch to a numerically-ordered sort key (amount) so row identity at
    // each index is deterministic, then scroll partway down that list.
    fireEvent.click(screen.getByText("Sort"));
    fireEvent.click(screen.getByRole("button", { name: "Amount" }));

    await waitFor(() =>
      expect(screen.getAllByText("#tx-200").length).toBeGreaterThan(0),
    );

    const virtualizer = screen.getByTestId("transactions-virtualizer");
    fireEvent.scroll(virtualizer, { target: { scrollTop: 4000 } });

    await waitFor(() =>
      expect(screen.getAllByText("#tx-100").length).toBeGreaterThan(0),
    );

    // Flip sort direction while scrolled partway down. The visible window
    // must reset cleanly to the new top of the list, not leave stale rows
    // from the old scroll position or a blank gap from a mismatched
    // scrollTop/DOM reset.
    fireEvent.click(screen.getByText("Sort"));
    fireEvent.click(screen.getByText("Toggle Direction"));

    await waitFor(() =>
      expect(screen.getAllByText("#tx-1").length).toBeGreaterThan(0),
    );
    expect(screen.queryAllByText("#tx-100")).toHaveLength(0);
    expect((virtualizer as HTMLDivElement).scrollTop).toBe(0);
  }, 15000);
});
