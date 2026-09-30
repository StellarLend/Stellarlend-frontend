import React from "react";
import { render, screen, waitFor, act } from "@/test/test-utils";
import { Transactions } from "./Transaction";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { addInFlightTx, removeInFlightTx, clearInFlightTxs } from "@/lib/tx/inFlightTxStore";
import { TX_API_STATUS } from "@/lib/tx/constants";

const mockFetchTransactions = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    transactions: [
      {
        id: "TXN-001",
        type: "Deposit",
        amount: 100,
        asset: "XLM",
        date: "2024-04-01",
        time: "10:00AM",
        status: "Completed",
      },
    ],
    total: 1,
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    let Comp: React.ComponentType<unknown> | null = null;
    loader().then((m) => {
      Comp = m.default;
    });
    return function DynamicResolved(props: unknown) {
      return Comp
        ? React.createElement(Comp, props as Record<string, unknown>)
        : React.createElement("div", null, "Loading…");
    };
  },
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

vi.mock("@/types/Transaction", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/types/Transaction")>();
  return { ...original, fetchTransactions: mockFetchTransactions };
});

describe("Transactions Optimistic Pending Row Integration", () => {
  beforeEach(() => {
    clearInFlightTxs();
    vi.clearAllMocks();
    mockFetchTransactions.mockResolvedValue({
      transactions: [
        {
          id: "TXN-001",
          type: "Deposit",
          amount: 100,
          asset: "XLM",
          date: "2024-04-01",
          time: "10:00AM",
          status: "Completed",
        },
      ],
      total: 1,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/tx/status/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ status: TX_API_STATUS.PENDING }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ transactions: [], total: 0 }),
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearInFlightTxs();
  });

  it("renders optimistic pending row at top of table when submission is in flight", async () => {
    render(<Transactions />);

    await waitFor(() => {
      expect(screen.getAllByText("#TXN-001").length).toBeGreaterThan(0);
    });

    act(() => {
      addInFlightTx({
        hash: "tx-pending-999",
        type: "Lend Funds",
        amount: 250,
        asset: "USDC",
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("pending-row-tx-pending-999")).toBeInTheDocument();
    });

    expect(screen.getAllByText("#tx-pending-999").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+$250").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Processing").length).toBeGreaterThan(0);
  });

  it("drives full lifecycle: submit → pending → confirmed (reconciliation)", async () => {
    render(<Transactions />);

    await waitFor(() => {
      expect(screen.getAllByText("#TXN-001").length).toBeGreaterThan(0);
    });

    act(() => {
      addInFlightTx({
        hash: "tx-flow-100",
        type: "Loan Payment",
        amount: -75,
        asset: "BTC",
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("pending-row-tx-flow-100")).toBeInTheDocument();
    });

    // Simulate backend indexing and status resolving to SUCCESS by removing in-flight row
    act(() => {
      removeInFlightTx("tx-flow-100");
    });

    await waitFor(() => {
      expect(screen.queryByTestId("pending-row-tx-flow-100")).not.toBeInTheDocument();
    });
  });

  it("handles edge case: submission failure", async () => {
    render(<Transactions />);

    act(() => {
      addInFlightTx({
        hash: "tx-fail-555",
        type: "Withdrawal",
        amount: -150,
        asset: "XLM",
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("pending-row-tx-fail-555")).toBeInTheDocument();
    });

    // Simulate submission failure on chain by removing in-flight row on failure callback
    act(() => {
      removeInFlightTx("tx-fail-555");
    });

    await waitFor(() => {
      expect(screen.queryByTestId("pending-row-tx-fail-555")).not.toBeInTheDocument();
    });
  });

  it("handles edge case: deduplication on reconciliation (confirm before fetch)", async () => {
    mockFetchTransactions.mockResolvedValueOnce({
      transactions: [
        {
          id: "tx-dedup-777",
          type: "Lend Funds",
          amount: 500,
          asset: "XLM",
          date: "2024-04-01",
          time: "10:00AM",
          status: "Completed",
        },
      ],
      total: 1,
    });

    render(<Transactions />);

    await waitFor(() => {
      expect(screen.getAllByText("#tx-dedup-777").length).toBeGreaterThan(0);
    });

    act(() => {
      addInFlightTx({
        hash: "tx-dedup-777",
        type: "Lend Funds",
        amount: 500,
        asset: "XLM",
      });
    });

    // Verify no duplicate pending row is rendered because real transaction with id tx-dedup-777 exists in fetched transactions
    expect(screen.queryByTestId("pending-row-tx-dedup-777")).not.toBeInTheDocument();
  });
});
