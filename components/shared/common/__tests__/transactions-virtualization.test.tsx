import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Transactions } from "../Transaction";
import { fetchTransactions } from "@/types/Transaction";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
    <img {...props} />
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
  return {
    id: `tx-${id}`,
    type: id % 2 === 0 ? "Borrow" : "Repay",
    amount: id * 10,
    asset: "XLM",
    date: "2024-01-01",
    time: "10:00 AM",
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
});
