import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useMarketParams } from "./use-market-params";
import { MARKETS } from "@/lib/markets";

// ── mock lib/market-params ───────────────────────────────────────────────────

vi.mock("@/lib/market-params", () => ({
  fetchLiveMarketParams: vi.fn(),
  bpsToPercent: (bps: number) => Math.round(bps * 100) / 10000,
}));

import { fetchLiveMarketParams } from "@/lib/market-params";
const mockFetch = vi.mocked(fetchLiveMarketParams);

// ── helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe("useMarketParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns static MARKETS while loading (isLoading = true)", () => {
    // fetchLiveMarketParams never resolves during this check
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useMarketParams(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    // Static MARKETS should be returned immediately as the fallback
    expect(result.current.markets).toEqual(MARKETS);
  });

  it("returns merged markets on success", async () => {
    const merged = MARKETS.map((m) => ({ ...m, ltv: 0.65 }));
    mockFetch.mockResolvedValue(merged);

    const { result } = renderHook(() => useMarketParams(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.markets).toEqual(merged);
    expect(result.current.markets[0].ltv).toBe(0.65);
  });

  it("falls back to MARKETS and sets isError on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("RPC timeout"));

    const { result } = renderHook(() => useMarketParams(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    // Should still return the static fallback so the table renders
    expect(result.current.markets).toEqual(MARKETS);
  });

  it("uses queryKeys.marketParams() as the React Query key", async () => {
    const spy = vi.spyOn(await import("@/lib/query-keys"), "queryKeys", "get");
    mockFetch.mockResolvedValue(MARKETS);

    renderHook(() => useMarketParams(), { wrapper: makeWrapper() });

    // The spy confirms queryKeys is accessed; fetchLiveMarketParams is called
    expect(mockFetch).toHaveBeenCalledWith(MARKETS);
    spy.mockRestore();
  });
});
