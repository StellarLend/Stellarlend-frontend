import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

describe("useFeatureFlag", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when the flag is enabled", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ newMarketsTable: true }),
    } as Response);

    const { useFeatureFlag } = await import("./useFeatureFlag");
    const { result } = renderHook(() => useFeatureFlag("newMarketsTable"));

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("returns false when the flag is disabled", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ newMarketsTable: false }),
    } as Response);

    const { useFeatureFlag } = await import("./useFeatureFlag");
    const { result } = renderHook(() => useFeatureFlag("newMarketsTable"));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("returns defaultValue for an unknown flag", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ existingFlag: true }),
    } as Response);

    const { useFeatureFlag } = await import("./useFeatureFlag");
    const { result } = renderHook(() => useFeatureFlag("unknownFlag"));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("returns false (default) when fetch fails", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

    const { useFeatureFlag } = await import("./useFeatureFlag");
    const { result } = renderHook(() => useFeatureFlag("anyFlag"));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("returns default value when flag is unknown and defaultValue is provided", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ existingFlag: true }),
    } as Response);

    const { useFeatureFlag } = await import("./useFeatureFlag");
    const { result } = renderHook(() => useFeatureFlag("unknownFlag", true));

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("returns default value when fetch fails and defaultValue is provided", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

    const { useFeatureFlag } = await import("./useFeatureFlag");
    const { result } = renderHook(() => useFeatureFlag("anyFlag", true));

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("caches results so multiple hooks use a single fetch", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ priceTicker: true }),
    } as Response);

    const { useFeatureFlag } = await import("./useFeatureFlag");
    const { result: resultA } = renderHook(() => useFeatureFlag("priceTicker"));
    const { result: resultB } = renderHook(() => useFeatureFlag("priceTicker"));

    await waitFor(() => {
      expect(resultA.current).toBe(true);
      expect(resultB.current).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("handles non-ok response", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const { useFeatureFlag } = await import("./useFeatureFlag");
    const { result } = renderHook(() => useFeatureFlag("anyFlag"));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
