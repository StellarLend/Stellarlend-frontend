import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
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
    // The query string is percent-encoded by URLSearchParams (`,` -> %2C), so
    // assert against the decoded URL rather than the raw serialization.
    expect(
      decodeURIComponent(String(vi.mocked(global.fetch).mock.calls[0][0])),
    ).toContain("/api/prices?assets=USDC,XLM");
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

  it("bypasses the freshness window when force is set", async () => {
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

    await loadPrices(["XLM"], { force: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("still de-duplicates concurrent forced requests", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        prices: { XLM: 0.12 },
        timestamp: new Date().toISOString(),
        source: "test",
      }),
    } as Response);

    const [first, second] = await Promise.all([
      loadPrices(["XLM"], { force: true }),
      loadPrices(["XLM"], { force: true }),
    ]);

    expect(first).toBe(second);
    expect(global.fetch).toHaveBeenCalledTimes(1);
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

  it("does not refetch when re-rendered with a new-but-equivalent assets array", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        prices: { XLM: 0.12, USDC: 1 },
        timestamp: new Date().toISOString(),
        source: "test",
      }),
    } as Response);

    // Passing a fresh array literal on every render is the exact scenario
    // that used to defeat caching: `assets` in the effect's dependency array
    // always differs by reference even when its contents are identical.
    const { result, rerender } = renderHook(
      ({ assets }: { assets: string[] }) => usePrices(assets),
      { initialProps: { assets: ["XLM", "USDC"] } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Drop the session + in-flight caches WITHOUT touching component state.
    // A warm cache would mask a re-run of the effect (loadPrices would return
    // the cached entry and never touch the network), which is exactly why the
    // previous version of this test passed even with the bug present. Now the
    // only thing that can trigger a second /api/prices call is the effect
    // re-firing because an unstable `assets` reference is back in its deps.
    resetPricesCache();

    rerender({ assets: ["USDC", "XLM"] }); // same set, new order + identity
    rerender({ assets: ["XLM", "USDC"] });
    rerender({ assets: ["XLM", "USDC"] });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.hasError).toBe(false);
  });

  it("shares one network request between two consumers with equal symbol sets", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        prices: { XLM: 0.12, USDC: 1 },
        timestamp: new Date().toISOString(),
        source: "test",
      }),
    } as Response);

    // Two independent components, each passing its own fresh array literal in
    // a different order. They must coalesce into a single request.
    const first = renderHook(() => usePrices(["XLM", "USDC"]));
    const second = renderHook(() => usePrices(["USDC", "XLM"]));

    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes from the network even while the cache entry is still fresh", async () => {
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

    const { result } = renderHook(() => usePrices(["XLM"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getPriceLabel("XLM")).toBe("$0.12");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.getPriceLabel("XLM")).toBe("$0.15");
  });

  it("reads the latest assets from the ref when refreshing", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        prices: { XLM: 0.12, USDC: 1 },
        timestamp: new Date().toISOString(),
        source: "test",
      }),
    } as Response);

    const { result, rerender } = renderHook(
      ({ assets }: { assets: string[] }) => usePrices(assets),
      { initialProps: { assets: ["XLM"] } },
    );

    await waitFor(() =>
      expect(
        decodeURIComponent(String(vi.mocked(global.fetch).mock.calls[0][0])),
      ).toContain("/api/prices?assets=XLM"),
    );

    // Widen the symbol set: the effect re-runs for the new key, and refresh()
    // must follow the ref rather than the array captured on first render.
    rerender({ assets: ["XLM", "USDC"] });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    await act(async () => {
      await result.current.refresh();
    });

    expect(
      decodeURIComponent(
        String(vi.mocked(global.fetch).mock.calls[2][0]),
      ),
    ).toContain("/api/prices?assets=USDC,XLM");
  });
});
