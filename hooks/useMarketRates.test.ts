import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMarketRates } from "./useMarketRates";

describe("useMarketRates", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a loading state before the request resolves", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    const { result } = renderHook(() => useMarketRates("USDC"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.rate).toBeNull();
  });

  it("returns the borrow APR from the markets API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          markets: [
            {
              asset: "USDC",
              supplyApr: 5.5,
              borrowApr: 11.25,
              utilization: 0.5,
              totalSupply: 1000,
              totalBorrow: 500,
            },
          ],
          timestamp: "2026-06-29T12:00:00.000Z",
          source: "test",
        }),
      } as Response),
    );

    const { result } = renderHook(() => useMarketRates("USDC"));

    await waitFor(() => {
      expect(result.current.rate).toBe(11.25);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("reports an error when the response omits the requested asset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          markets: [
            {
              asset: "XLM",
              supplyApr: 5.5,
              borrowApr: 8.25,
              utilization: 0.5,
              totalSupply: 1000,
              totalBorrow: 500,
            },
          ],
          timestamp: "2026-06-29T12:00:00.000Z",
          source: "test",
        }),
      } as Response),
    );

    const { result } = renderHook(() => useMarketRates("USDC"));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.rate).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("preserves a zero borrow APR when the API returns zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          markets: [
            {
              asset: "USDC",
              supplyApr: 0,
              borrowApr: 0,
              utilization: 0,
              totalSupply: 0,
              totalBorrow: 0,
            },
          ],
          timestamp: "2026-06-29T12:00:00.000Z",
          source: "test",
        }),
      } as Response),
    );

    const { result } = renderHook(() => useMarketRates("USDC"));

    await waitFor(() => {
      expect(result.current.rate).toBe(0);
    });

    expect(result.current.isLoading).toBe(false);
  });
});
