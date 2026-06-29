import React from "react";
import {
  act,
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketsTable } from "./MarketsTable";
import type { MarketsResponse } from "@/lib/markets/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockMarkets: MarketsResponse = {
  markets: [
    {
      asset: "XLM",
      supplyApr: 8.5,
      borrowApr: 12.0,
      utilization: 0.71,
      totalSupply: 2_500_000,
      totalBorrow: 1_775_000,
    },
    {
      asset: "USDC",
      supplyApr: 5.2,
      borrowApr: 7.8,
      utilization: 0.65,
      totalSupply: 10_000_000,
      totalBorrow: 6_500_000,
    },
    {
      asset: "BTC",
      supplyApr: 2.1,
      borrowApr: 4.5,
      utilization: 0.47,
      totalSupply: 500_000,
      totalBorrow: 235_000,
    },
    {
      asset: "ETH",
      supplyApr: 3.8,
      borrowApr: 6.2,
      utilization: 0.58,
      totalSupply: 1_200_000,
      totalBorrow: 696_000,
    },
  ],
  timestamp: "2026-06-28T12:00:00.000Z",
  source: "test",
};

const emptyResponse: MarketsResponse = {
  markets: [],
  timestamp: "2026-06-28T12:00:00.000Z",
  source: "test",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchOnce(data: unknown, ok = true) {
  return vi.mocked(fetch).mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockFetchError(message = "Network error") {
  return vi.mocked(fetch).mockRejectedValueOnce(new Error(message));
}

function getDesktopMarketRows() {
  const table = screen.getByRole("table");
  return within(table).getAllByRole("row").slice(1);
}

function getRowAssetNames() {
  return getDesktopMarketRows().map(
    (row) =>
      within(row).getAllByText(/Stellar Lumens|USD Coin|Bitcoin|Ethereum/)[0]
        .textContent,
  );
}

async function typeFilter(query: string) {
  fireEvent.change(screen.getByLabelText("Filter markets by asset"), {
    target: { value: query },
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 275));
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(globalThis, "fetch");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MarketsTable", () => {
  describe("loading state", () => {
    it("shows skeleton while fetching", () => {
      // Never resolve the fetch to keep loading state
      vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
      render(<MarketsTable />);

      expect(screen.getByTestId("markets-loading")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders error state with retry when fetch fails", async () => {
      mockFetchError("Failed to fetch");
      render(<MarketsTable />);

      // Wait for the error state to appear
      const errorContainer = await screen.findByTestId("markets-error");
      expect(errorContainer).toBeInTheDocument();
      expect(screen.getByText("Unable to load markets")).toBeInTheDocument();
      expect(screen.getByText("Failed to fetch")).toBeInTheDocument();
    });

    it("renders error state when response is not ok", async () => {
      mockFetchOnce({ error: "Server error" }, false);
      render(<MarketsTable />);

      const errorContainer = await screen.findByTestId("markets-error");
      expect(errorContainer).toBeInTheDocument();
      expect(screen.getByText("Unable to load markets")).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to fetch market data/),
      ).toBeInTheDocument();
    });

    it("retries fetch when retry button is clicked", async () => {
      // First call fails
      mockFetchError("Temporary failure");
      render(<MarketsTable />);

      await screen.findByTestId("markets-error");
      expect(screen.getByText("Temporary failure")).toBeInTheDocument();

      // Second call succeeds
      mockFetchOnce(mockMarkets);
      fireEvent.click(screen.getByText("Retry"));

      await waitFor(() => {
        expect(screen.getByTestId("markets-table")).toBeInTheDocument();
      });
      expect(screen.getAllByText("XLM")[0]).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("renders empty state when markets array is empty", async () => {
      mockFetchOnce(emptyResponse);
      render(<MarketsTable />);

      const emptyContainer = await screen.findByTestId("markets-empty");
      expect(emptyContainer).toBeInTheDocument();
      expect(screen.getByText("No markets available")).toBeInTheDocument();
      expect(
        screen.getByText(/no supported assets to display/),
      ).toBeInTheDocument();
    });
  });

  describe("data rendering", () => {
    beforeEach(async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");
    });

    it("renders all markets", () => {
      expect(screen.getAllByText("XLM")[0]).toBeInTheDocument();
      expect(screen.getAllByText("USDC")[0]).toBeInTheDocument();
      expect(screen.getAllByText("BTC")[0]).toBeInTheDocument();
      expect(screen.getAllByText("ETH")[0]).toBeInTheDocument();
    });

    it("renders asset names", () => {
      expect(screen.getAllByText("Stellar Lumens")[0]).toBeInTheDocument();
      expect(screen.getAllByText("USD Coin")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Bitcoin")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Ethereum")[0]).toBeInTheDocument();
    });

    it("renders formatted supply APR values", () => {
      expect(screen.getAllByText("8.50%")[0]).toBeInTheDocument();
      expect(screen.getAllByText("5.20%")[0]).toBeInTheDocument();
      expect(screen.getAllByText("2.10%")[0]).toBeInTheDocument();
      expect(screen.getAllByText("3.80%")[0]).toBeInTheDocument();
    });

    it("renders formatted borrow APR values", () => {
      expect(screen.getAllByText("12.00%")[0]).toBeInTheDocument();
      expect(screen.getAllByText("7.80%")[0]).toBeInTheDocument();
      expect(screen.getAllByText("4.50%")[0]).toBeInTheDocument();
      expect(screen.getAllByText("6.20%")[0]).toBeInTheDocument();
    });

    it("renders formatted utilization values", () => {
      expect(screen.getAllByText("71.0%")[0]).toBeInTheDocument();
      expect(screen.getAllByText("65.0%")[0]).toBeInTheDocument();
      expect(screen.getAllByText("47.0%")[0]).toBeInTheDocument();
      expect(screen.getAllByText("58.0%")[0]).toBeInTheDocument();
    });

    it("renders formatted total supplied values", () => {
      expect(screen.getAllByText("$2,500,000.00")[0]).toBeInTheDocument();
      expect(screen.getAllByText("$10,000,000.00")[0]).toBeInTheDocument();
      expect(screen.getAllByText("$500,000.00")[0]).toBeInTheDocument();
      expect(screen.getAllByText("$1,200,000.00")[0]).toBeInTheDocument();
    });

    it("renders formatted total borrowed values", () => {
      expect(screen.getAllByText("$1,775,000.00")[0]).toBeInTheDocument();
      expect(screen.getAllByText("$6,500,000.00")[0]).toBeInTheDocument();
      expect(screen.getAllByText("$235,000.00")[0]).toBeInTheDocument();
      expect(screen.getAllByText("$696,000.00")[0]).toBeInTheDocument();
    });
  });

  describe("sorting", () => {
    it("sorts by asset name ascending by default", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      // Default sort is ascending by asset: BTC, ETH, USDC, XLM
      expect(getRowAssetNames()).toEqual([
        "Bitcoin",
        "Ethereum",
        "USD Coin",
        "Stellar Lumens",
      ]);
    });

    it("toggles asset sort direction on click", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const sortButton = screen.getByLabelText(/Sort by Asset/);
      fireEvent.click(sortButton);

      // Should now be descending: XLM, USDC, ETH, BTC
      expect(getRowAssetNames()).toEqual([
        "Stellar Lumens",
        "USD Coin",
        "Ethereum",
        "Bitcoin",
      ]);
    });

    it("sorts by supply APR when clicking Supply APR header", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const sortButton = screen.getByLabelText(/Sort by Supply APR/);
      fireEvent.click(sortButton);

      // Ascending: BTC (2.10%), ETH (3.80%), USDC (5.20%), XLM (8.50%)
      expect(getRowAssetNames()).toEqual([
        "Bitcoin",
        "Ethereum",
        "USD Coin",
        "Stellar Lumens",
      ]);
      expect(sortButton).toHaveAttribute(
        "aria-label",
        expect.stringContaining("ascending"),
      );
    });

    it("sorts by utilization", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const sortButton = screen.getByLabelText(/Sort by Utilization/);
      fireEvent.click(sortButton);

      // Ascending utilization: BTC (47.0%), ETH (58.0%), USDC (65.0%), XLM (71.0%)
      expect(getRowAssetNames()).toEqual([
        "Bitcoin",
        "Ethereum",
        "USD Coin",
        "Stellar Lumens",
      ]);
      expect(sortButton).toHaveAttribute(
        "aria-label",
        expect.stringContaining("ascending"),
      );
    });

    it("sorts by total supplied", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const sortButton = screen.getByLabelText(/Sort by Total Supplied/);
      fireEvent.click(sortButton);

      // Ascending: BTC (500K), ETH (1.2M), XLM (2.5M), USDC (10M)
      expect(getRowAssetNames()).toEqual([
        "Bitcoin",
        "Ethereum",
        "Stellar Lumens",
        "USD Coin",
      ]);
      expect(sortButton).toHaveAttribute(
        "aria-label",
        expect.stringContaining("ascending"),
      );
    });

    it("sorts by total borrowed", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const sortButton = screen.getByLabelText(/Sort by Total Borrowed/);
      fireEvent.click(sortButton);

      // Ascending: BTC (235K), ETH (696K), XLM (1.775M), USDC (6.5M)
      expect(getRowAssetNames()).toEqual([
        "Bitcoin",
        "Ethereum",
        "Stellar Lumens",
        "USD Coin",
      ]);
      expect(sortButton).toHaveAttribute(
        "aria-label",
        expect.stringContaining("ascending"),
      );
    });

    it("toggles sort direction on second click", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const sortButton = screen.getByLabelText(/Sort by Supply APR/);
      fireEvent.click(sortButton);
      // First click: ascending
      expect(sortButton).toHaveAttribute(
        "aria-label",
        expect.stringContaining("ascending"),
      );

      fireEvent.click(sortButton);
      // Second click: descending
      expect(getRowAssetNames()).toEqual([
        "Stellar Lumens",
        "USD Coin",
        "Ethereum",
        "Bitcoin",
      ]);
      expect(sortButton).toHaveAttribute(
        "aria-label",
        expect.stringContaining("descending"),
      );
    });

    it("exposes aria-sort on active and inactive sortable headers", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const table = screen.getByRole("table");
      expect(
        within(table).getByRole("columnheader", { name: /Asset/ }),
      ).toHaveAttribute("aria-sort", "ascending");
      expect(
        within(table).getByRole("columnheader", { name: /Borrow APR/ }),
      ).toHaveAttribute("aria-sort", "none");

      fireEvent.click(screen.getByLabelText(/Sort by Borrow APR/));

      expect(
        within(table).getByRole("columnheader", { name: /Borrow APR/ }),
      ).toHaveAttribute("aria-sort", "ascending");
    });
  });

  describe("filtering", () => {
    it("filters by asset symbol after the debounce window", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      await typeFilter("us");

      expect(screen.getByText("Showing 1 of 4 markets")).toBeInTheDocument();
      expect(getRowAssetNames()).toEqual(["USD Coin"]);
    });

    it("filters by asset name case-insensitively", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      await typeFilter("stellar");

      expect(getRowAssetNames()).toEqual(["Stellar Lumens"]);
    });

    it("renders a filter-empty state and clears it with the empty-state action", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      await typeFilter("doge");

      expect(screen.getByTestId("markets-filter-empty")).toBeInTheDocument();
      expect(screen.getByText("No matching markets")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Clear filter"));

      expect(
        screen.queryByTestId("markets-filter-empty"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Showing 4 of 4 markets")).toBeInTheDocument();
    });

    it("clears the filter from the search input clear control", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      await typeFilter("btc");
      expect(getRowAssetNames()).toEqual(["Bitcoin"]);

      fireEvent.click(screen.getByLabelText("Clear market filter"));

      expect(screen.getByText("Showing 4 of 4 markets")).toBeInTheDocument();
      expect(getRowAssetNames()).toEqual([
        "Bitcoin",
        "Ethereum",
        "USD Coin",
        "Stellar Lumens",
      ]);
    });
  });

  describe("accessibility and structure", () => {
    it("uses data-testid markets-table for the data container", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      expect(await screen.findByTestId("markets-table")).toBeInTheDocument();
    });

    it("has sort buttons with accessible aria-labels", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      expect(screen.getByLabelText(/Sort by Asset/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sort by Supply APR/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sort by Borrow APR/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sort by Utilization/)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Sort by Total Supplied/),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Sort by Total Borrowed/),
      ).toBeInTheDocument();
    });
  });
});
