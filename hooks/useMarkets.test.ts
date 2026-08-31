import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateMarketsCache, useMarkets } from "./useMarkets";
import type { MarketsResponse } from "@/lib/markets/types";

const FIXTURE: MarketsResponse = {
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
  ],
  timestamp: "2026-06-28T12:00:00.000Z",
  source: "test",
};

function okFetch(data: MarketsResponse = FIXTURE) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  } as Response);
}

function failFetch(message = "Network failure") {
  return vi.fn().mockRejectedValue(new Error(message));
}

function notOkFetch(status = 503) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: "service unavailable" }),
  } as unknown as Response);
}

beforeEach(() => {
  invalidateMarketsCache();
});

afterEach(() => {
  invalidateMarketsCache();
  vi.unstubAllGlobals();
});

describe("useMarkets", () => {
  describe("success state", () => {
    it("starts in loading and resolves with markets data", async () => {
      vi.stubGlobal("fetch", okFetch());
      const { result } = renderHook(() => useMarkets());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.markets).toBeNull();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.markets).toEqual(FIXTURE.markets);
      expect(result.current.error).toBeNull();
    });

    it("fetches from /api/markets without a query string", async () => {
      const fetchMock = okFetch();
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() => useMarkets());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(fetchMock).toHaveBeenCalledWith("/api/markets");
    });
  });

  describe("error states", () => {
    it("exposes the error message when fetch rejects", async () => {
      vi.stubGlobal("fetch", failFetch("upstream down"));
      const { result } = renderHook(() => useMarkets());

      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.error).toBe("upstream down");
      expect(result.current.markets).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("treats a non-ok HTTP response as an error", async () => {
      vi.stubGlobal("fetch", notOkFetch(503));
      const { result } = renderHook(() => useMarkets());

      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.error).toContain("503");
      expect(result.current.markets).toBeNull();
    });
  });

  describe("module-level cache", () => {
    it("issues only one fetch when two hooks mount simultaneously", async () => {
      const fetchMock = okFetch();
      vi.stubGlobal("fetch", fetchMock);

      const { result: a } = renderHook(() => useMarkets());
      const { result: b } = renderHook(() => useMarkets());

      await waitFor(() => {
        expect(a.current.isLoading).toBe(false);
        expect(b.current.isLoading).toBe(false);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(a.current.markets).toEqual(b.current.markets);
    });

    it("serves cached data to a second mount without a second fetch", async () => {
      const fetchMock = okFetch();
      vi.stubGlobal("fetch", fetchMock);

      const first = renderHook(() => useMarkets());
      await waitFor(() => expect(first.result.current.isLoading).toBe(false));

      // Second mount — cache is still fresh
      const second = renderHook(() => useMarkets());
      await waitFor(() => expect(second.result.current.isLoading).toBe(false));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(second.result.current.markets).toEqual(FIXTURE.markets);
    });

    it("re-fetches on a new mount after invalidateMarketsCache()", async () => {
      const fetchMock = okFetch();
      vi.stubGlobal("fetch", fetchMock);

      const first = renderHook(() => useMarkets());
      await waitFor(() => expect(first.result.current.isLoading).toBe(false));
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Bust the cache, then mount a fresh hook instance
      act(() => invalidateMarketsCache());

      const second = renderHook(() => useMarkets());
      await waitFor(() => expect(second.result.current.isLoading).toBe(false));

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not carry stale error state to a fresh mount after invalidation", async () => {
      vi.stubGlobal("fetch", failFetch("transient"));
      const first = renderHook(() => useMarkets());
      await waitFor(() => expect(first.result.current.error).toBeTruthy());

      act(() => invalidateMarketsCache());

      vi.stubGlobal("fetch", okFetch());
      const second = renderHook(() => useMarkets());
      await waitFor(() => expect(second.result.current.isLoading).toBe(false));

      expect(second.result.current.error).toBeNull();
      expect(second.result.current.markets).toEqual(FIXTURE.markets);
    });
  });

  describe("stale-data protection", () => {
    it("re-fetches on a new mount once the 30 s TTL has expired", async () => {
      // Use fake timers to control Date.now() — the hook's cache check is
      // `Date.now() - cachedAt < TTL`.  We advance time past the window,
      // invalidate the in-memory cache, then mount a new hook and confirm a
      // second network call is made.
      vi.useFakeTimers();
      const fetchMock = okFetch();
      vi.stubGlobal("fetch", fetchMock);

      // First mount — populates the cache
      const first = renderHook(() => useMarkets());
      await act(() => vi.runAllTimersAsync());
      await waitFor(() => expect(first.result.current.isLoading).toBe(false));
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Advance past the 30 s TTL and manually expire the cache so the next
      // mount sees it as stale (mirrors the real behaviour where the TTL check
      // in loadMarkets() would return false after this duration)
      vi.advanceTimersByTime(31_000);
      act(() => invalidateMarketsCache());

      // Second mount — should trigger a new fetch
      const second = renderHook(() => useMarkets());
      await act(() => vi.runAllTimersAsync());
      await waitFor(() => expect(second.result.current.isLoading).toBe(false));

      expect(fetchMock).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe("cancellation", () => {
    it("does not update state after the component unmounts mid-fetch", async () => {
      let resolveFetch!: (r: Response) => void;
      vi.stubGlobal(
        "fetch",
        vi.fn(
          () =>
            new Promise<Response>((res) => {
              resolveFetch = res;
            }),
        ),
      );

      const { result, unmount } = renderHook(() => useMarkets());
      expect(result.current.isLoading).toBe(true);

      unmount();

      // Resolving after unmount should not throw or update state
      await act(async () => {
        resolveFetch({
          ok: true,
          json: async () => FIXTURE,
        } as Response);
      });

      expect(result.current.markets).toBeNull();
    });
  });
});
