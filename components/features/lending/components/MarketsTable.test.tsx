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
import type { MarketsResponse } from "../../../../lib/markets/types";

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
      vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
      render(<MarketsTable />);

      expect(screen.getByTestId("markets-loading")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders error state with retry when fetch fails", async () => {
      mockFetchError("Failed to fetch");
      render(<MarketsTable />);

      const errorContainer = await screen.findByTestId("markets-error");
      expect(errorContainer).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveAttribute(
        "aria-live",
        "assertive",
      );
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
      mockFetchError("Temporary failure");
      render(<MarketsTable />);

      await screen.findByTestId("markets-error");
      expect(screen.getByText("Temporary failure")).toBeInTheDocument();

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

      fireEvent.click(screen.getByLabelText(/Sort by Asset/));

      expect(getRowAssetNames()).toEqual([
        "Stellar Lumens",
        "USD Coin",
        "Ethereum",
        "Bitcoin",
      ]);
    });

    it("sorts by supply APR ascending on first click", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const btn = screen.getByLabelText(/Sort by Supply APR/);
      fireEvent.click(btn);

      expect(getRowAssetNames()).toEqual([
        "Bitcoin",
        "Ethereum",
        "USD Coin",
        "Stellar Lumens",
      ]);
      expect(btn).toHaveAttribute(
        "aria-label",
        expect.stringContaining("ascending"),
      );
    });

    it("sorts by utilization ascending on first click", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const btn = screen.getByLabelText(/Sort by Utilization/);
      fireEvent.click(btn);

      expect(getRowAssetNames()).toEqual([
        "Bitcoin",
        "Ethereum",
        "USD Coin",
        "Stellar Lumens",
      ]);
    });

    it("sorts by total supplied ascending on first click", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      fireEvent.click(screen.getByLabelText(/Sort by Total Supplied/));

      expect(getRowAssetNames()).toEqual([
        "Bitcoin",
        "Ethereum",
        "Stellar Lumens",
        "USD Coin",
      ]);
    });

    it("sorts by total borrowed ascending on first click", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      fireEvent.click(screen.getByLabelText(/Sort by Total Borrowed/));

      expect(getRowAssetNames()).toEqual([
        "Bitcoin",
        "Ethereum",
        "Stellar Lumens",
        "USD Coin",
      ]);
    });

    it("toggles to descending on second click of the same column", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const btn = screen.getByLabelText(/Sort by Supply APR/);
      fireEvent.click(btn); // asc
      fireEvent.click(btn); // desc

      expect(getRowAssetNames()).toEqual([
        "Stellar Lumens",
        "USD Coin",
        "Ethereum",
        "Bitcoin",
      ]);
      expect(btn).toHaveAttribute(
        "aria-label",
        expect.stringContaining("descending"),
      );
    });

    it("exposes aria-sort on active and inactive column headers", async () => {
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
      expect(
        within(table).getByRole("columnheader", { name: /Asset/ }),
      ).toHaveAttribute("aria-sort", "none");
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

    it("shows filter-empty state and clears it via the empty-state action", async () => {
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

    it("clears the filter from the input's clear button", async () => {
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

    it("all six sort buttons have accessible aria-labels", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      expect(screen.getByLabelText(/Sort by Asset/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sort by Supply APR/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sort by Borrow APR/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sort by Utilization/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sort by Total Supplied/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sort by Total Borrowed/)).toBeInTheDocument();
    });
  });

  describe("skeleton loading accessibility", () => {
    it("desktop skeleton table carries aria-busy=true", () => {
      vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
      render(<MarketsTable />);

      // The <table> inside MarketsTableSkeleton is the element with aria-busy
      const table = screen.getByRole("table");
      expect(table).toHaveAttribute("aria-busy", "true");
    });

    it("desktop skeleton wrapper is labelled 'Loading markets'", () => {
      vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
      render(<MarketsTable />);

      // The div wrapping the desktop skeleton carries aria-label="Loading markets"
      expect(screen.getAllByLabelText("Loading markets").length).toBeGreaterThanOrEqual(1);
    });

    it("mobile skeleton wrapper carries aria-busy=true and aria-label='Loading markets'", () => {
      vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
      render(<MarketsTable />);

      const loadingWrapper = screen.getByTestId("markets-loading");
      // The mobile skeleton div (md:hidden) carries both attributes directly
      const mobileWrapper = loadingWrapper.querySelector(".md\\:hidden[aria-busy='true']");
      expect(mobileWrapper).not.toBeNull();
      expect(mobileWrapper).toHaveAttribute("aria-label", "Loading markets");
    });
  });

  describe("apiUrl prop contract", () => {
    it("fetches from /api/markets by default", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/markets");
    });

    it("fetches from the supplied apiUrl when provided", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable apiUrl="/api/v2/markets" />);
      await screen.findByTestId("markets-table");

      expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/v2/markets");
    });

    it("re-fetches when apiUrl prop changes", async () => {
      mockFetchOnce(mockMarkets);
      const { rerender } = render(<MarketsTable apiUrl="/api/markets" />);
      await screen.findByTestId("markets-table");

      mockFetchOnce(mockMarkets);
      rerender(<MarketsTable apiUrl="/api/v2/markets" />);
      await waitFor(() => {
        expect(vi.mocked(fetch)).toHaveBeenLastCalledWith("/api/v2/markets");
      });
    });

    it("shows error state when the custom endpoint returns non-ok", async () => {
      mockFetchOnce({ error: "not found" }, false);
      render(<MarketsTable apiUrl="/api/staging/markets" />);

      await screen.findByTestId("markets-error");
      expect(screen.getByText("Unable to load markets")).toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    it("all sort buttons are in the natural tab order", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const sortButtons = screen.getAllByRole("button", { name: /Sort by/ });
      expect(sortButtons).toHaveLength(6);

      for (const btn of sortButtons) {
        expect(btn).not.toHaveAttribute("tabindex", "-1");
      }
    });

    it("sort button responds to click after receiving focus", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const btn = screen.getByLabelText(/Sort by Supply APR/);
      btn.focus();
      fireEvent.click(btn);

      expect(btn).toHaveAttribute(
        "aria-label",
        expect.stringContaining("ascending"),
      );
    });

    it("clear-filter button is in the natural tab order and operable", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      await typeFilter("btc");
      const clearBtn = screen.getByLabelText("Clear market filter");
      expect(clearBtn).not.toHaveAttribute("tabindex", "-1");

      clearBtn.focus();
      fireEvent.click(clearBtn);

      expect(screen.getByText("Showing 4 of 4 markets")).toBeInTheDocument();
    });

    it("retry button is in the natural tab order after an error", async () => {
      mockFetchError("Fetch failed");
      render(<MarketsTable />);
      await screen.findByTestId("markets-error");

      const retryBtn = screen.getByRole("button", { name: "Retry" });
      expect(retryBtn).not.toHaveAttribute("tabindex", "-1");
    });
  });

  describe("focus-visible styles", () => {
    it("sort buttons declare focus-visible ring classes", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const btn = screen.getByLabelText(/Sort by Asset/);
      expect(btn.className).toContain("focus-visible:ring-2");
    });

    it("clear-filter button declares focus-visible ring classes", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      await typeFilter("xlm");
      const clearBtn = screen.getByLabelText("Clear market filter");
      expect(clearBtn.className).toContain("focus-visible:ring-2");
    });
  });

  describe("screen-reader semantics", () => {
    it("result count uses aria-live=polite for non-interruptive updates", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const countEl = screen.getByText(/Showing \d+ of \d+ markets/);
      expect(countEl).toHaveAttribute("aria-live", "polite");
    });

    it("error region uses role=alert with aria-live=assertive", async () => {
      mockFetchError("Boom");
      render(<MarketsTable />);
      await screen.findByTestId("markets-error");

      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "assertive");
    });

    it("filter input has a visible accessible label", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      expect(screen.getByLabelText("Filter markets by asset")).toBeInTheDocument();
    });

    it("filter input enforces a maxlength to bound query size", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      expect(screen.getByLabelText("Filter markets by asset")).toHaveAttribute(
        "maxlength",
        "80",
      );
    });

    it("color-dot asset indicators carry aria-hidden", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const table = screen.getByRole("table");
      const hiddenDots = table.querySelectorAll(
        '[aria-hidden="true"].rounded-full',
      );
      expect(hiddenDots.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("reduced-motion", () => {
    it("skeleton placeholders include motion-reduce:animate-none to suppress pulse", () => {
      // Skeleton renders `animate-pulse motion-reduce:animate-none`.
      // The browser suppresses the animation when prefers-reduced-motion:reduce
      // is active — we verify the suppression class is present in the markup.
      vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
      render(<MarketsTable />);

      const loadingWrapper = screen.getByTestId("markets-loading");
      const skeletons = loadingWrapper.querySelectorAll(
        "[class*='motion-reduce:animate-none']",
      );
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("data rows use transition-colors, which Tailwind suppresses under prefers-reduced-motion", async () => {
      mockFetchOnce(mockMarkets);
      render(<MarketsTable />);
      await screen.findByTestId("markets-table");

      const table = screen.getByRole("table");
      const rows = within(table).getAllByRole("row").slice(1);
      for (const row of rows) {
        expect(row.className).toContain("transition-colors");
      }
    });
  });
});
