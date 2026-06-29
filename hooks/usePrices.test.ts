import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  usePrices,
  loadPrices,
  resetPricesCache,
  formatAssetPrice,
  cacheKeyForAssets,
  isPriceCacheStale,
} from "./usePrices";
import { PRICE_CACHE_CONFIG } from "@/lib/prices/constants";

describe("formatAssetPrice", () => {
  it("formats a valid price with currency formatting", () => {
    expect(formatAssetPrice(0.123456, false)).toBe("$0.12");
    expect(formatAssetPrice(65000, false)).toBe("$65,000.00");
  });

  it("returns unavailable when price is missing or flagged unavailable", () => {
    expect(formatAssetPrice(undefined, true)).toBe("Price unavailable");
    expect(formatAssetPrice(undefined, false)).toBe("Price unavailable");
  });
});

describe("cacheKeyForAssets", () => {
  it("normalizes and sorts asset symbols", () => {
    expect(cacheKeyForAssets(["USDC", "XLM", "XLM"])).toBe("USDC,XLM");
    expect(cacheKeyForAssets([])).toBe("ALL");
  });
});

describe("loadPrices", () => {
  beforeEach(() => {
    resetPricesCache();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches prices and stores them in the session cache", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        prices: { XLM: 0.12, USDC: 1 },
        timestamp: new Date().toISOString(),
        source: "test",
      }),
    } as Response);

    const entry = await loadPrices(["XLM", "USDC"]);

    expect(entry.error).toBe(false);
    expect(entry.prices).toEqual({ XLM: 0.12, USDC: 1 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/prices?assets=USDC,XLM"),
    );
  });

  it("deduplicates concurrent requests for the same asset set", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        prices: { XLM: 0.12 },
        timestamp: new Date().toISOString(),
        source: "test",
      }),
    } as Response);

    const [first, second] = await Promise.all([
      loadPrices(["XLM"]),
      loadPrices(["XLM"]),
    ]);

    expect(first).toBe(second);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns cached data without refetching while fresh", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        prices: { XLM: 0.12 },
        timestamp: new Date().toISOString(),
        source: "test",
      }),
    } as Response);

    await loadPrices(["XLM"]);
    await loadPrices(["XLM"]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("refetches when cache is stale", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          prices: { XLM: 0.12 },
          timestamp: new Date().toISOString(),
          source: "test",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          prices: { XLM: 0.15 },
          timestamp: new Date().toISOString(),
          source: "test",
        }),
      } as Response);

    await loadPrices(["XLM"]);

    vi.setSystemTime(
      new Date(Date.now() + PRICE_CACHE_CONFIG.ttl + 1),
    );

    const refreshed = await loadPrices(["XLM"]);

    expect(refreshed.prices.XLM).toBe(0.15);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("marks cache entry as errored when fetch fails", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

    const entry = await loadPrices(["XLM"]);

    expect(entry.error).toBe(true);
    expect(entry.prices).toEqual({});
  });
});

describe("isPriceCacheStale", () => {
  it("detects stale cache entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const fresh = {
      prices: { XLM: 0.12 },
      fetchedAt: Date.now(),
      error: false,
    };
    expect(isPriceCacheStale(fresh)).toBe(false);

    vi.setSystemTime(
      new Date(Date.now() + PRICE_CACHE_CONFIG.ttl + 1),
    );
    expect(isPriceCacheStale(fresh)).toBe(true);

    vi.useRealTimers();
  });
});

describe("usePrices", () => {
  beforeEach(() => {
    resetPricesCache();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns formatted labels after prices load", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        prices: { XLM: 0.12, USDC: 1 },
        timestamp: new Date().toISOString(),
        source: "test",
      }),
    } as Response);

    const { result } = renderHook(() => usePrices(["XLM", "USDC"]));

    await waitFor(() =>
      expect(result.current.getPriceLabel("XLM")).toBe("$0.12"),
    );

    expect(result.current.getPriceLabel("USDC")).toBe("$1.00");
    expect(result.current.hasError).toBe(false);
  });

  it("returns unavailable labels when the fetch fails", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => usePrices(["XLM"]));

    await waitFor(() => expect(result.current.hasError).toBe(true));

    expect(result.current.getPriceLabel("XLM")).toBe("Price unavailable");
  });
});
