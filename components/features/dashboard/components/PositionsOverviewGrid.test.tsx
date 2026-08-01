import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PositionsOverviewGrid, {
  sortPositions,
} from "./PositionsOverviewGrid";
import type { BorrowPosition } from "@/hooks/usePositions";

vi.mock("@/hooks/usePositions", () => ({
  usePositions: () => ({
    positions: [],
    supplyPositions: [],
    isLoading: false,
    isStale: false,
    isOffline: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const sample: BorrowPosition[] = [
  { id: "b-xlm", asset: "XLM", amount: 500, healthFactor: 1.8 },
  { id: "b-usdc", asset: "USDC", amount: 1200, healthFactor: 1.1 },
  { id: "b-btc", asset: "BTC", amount: 0.5, healthFactor: 2.4 },
];

describe("sortPositions", () => {
  it("sorts riskiest health first when ascending by health", () => {
    const sorted = sortPositions(sample, "health", "asc");
    expect(sorted.map((p) => p.asset)).toEqual(["USDC", "XLM", "BTC"]);
  });

  it("sorts largest size first when descending by size", () => {
    const sorted = sortPositions(sample, "size", "desc");
    expect(sorted.map((p) => p.asset)).toEqual(["USDC", "XLM", "BTC"]);
  });

  it("handles health ties with a stable asset fallback", () => {
    const tied: BorrowPosition[] = [
      { id: "a", asset: "ETH", amount: 1, healthFactor: 1.5 },
      { id: "b", asset: "BTC", amount: 2, healthFactor: 1.5 },
    ];
    const sorted = sortPositions(tied, "health", "asc");
    expect(sorted.map((p) => p.asset)).toEqual(["BTC", "ETH"]);
  });

  it("treats missing size as zero", () => {
    const rows: BorrowPosition[] = [
      { id: "a", asset: "XLM", amount: 10, healthFactor: 2 },
      { id: "b", asset: "USDC", amount: undefined as unknown as number, healthFactor: 2 },
    ];
    const sorted = sortPositions(rows, "size", "desc");
    expect(sorted[0].asset).toBe("XLM");
  });
});

describe("PositionsOverviewGrid", () => {
  it("shows loading state", () => {
    render(<PositionsOverviewGrid positions={[]} isLoading error={null} />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading positions/i);
  });

  it("shows empty state", () => {
    render(<PositionsOverviewGrid positions={[]} isLoading={false} error={null} />);
    expect(screen.getByText(/no open positions/i)).toBeInTheDocument();
  });

  it("shows error state with retry", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <PositionsOverviewGrid
        positions={[]}
        isLoading={false}
        error={new Error("network down")}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(/couldn.t load positions/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders rows and defaults to riskiest-first health sort with aria-sort", () => {
    render(
      <PositionsOverviewGrid
        positions={sample}
        isLoading={false}
        error={null}
      />,
    );

    const table = screen.getByRole("table", { name: /borrow positions/i });
    const rows = within(table).getAllByRole("row");
    // header + 3 data rows
    expect(rows).toHaveLength(4);
    // First data row should be riskiest (USDC 1.1)
    expect(rows[1]).toHaveTextContent("USDC");

    const healthHeader = screen.getByRole("columnheader", { name: /health/i });
    expect(healthHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("toggles size sort via keyboard-operable header button", async () => {
    const user = userEvent.setup();
    render(
      <PositionsOverviewGrid
        positions={sample}
        isLoading={false}
        error={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /size/i }));
    const sizeHeader = screen.getByRole("columnheader", { name: /size/i });
    expect(sizeHeader).toHaveAttribute("aria-sort", "descending");

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("USDC");
  });

  it("handles a single position", () => {
    render(
      <PositionsOverviewGrid
        positions={[sample[0]]}
        isLoading={false}
        error={null}
      />,
    );
    expect(screen.getByText(/1 position/i)).toBeInTheDocument();
    expect(screen.getByTestId("position-row-b-xlm")).toBeInTheDocument();
  });
});
