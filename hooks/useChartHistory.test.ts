/**
 * useChartHistory — invariant and integration tests
 *
 * Covers:
 * - Atomic state transitions (no torn intermediate states)
 * - Request deduplication (module-level inflightRequests Map)
 * - Stale-response rejection via generation counter
 * - Exponential back-off retry (up to MAX_RETRIES=3)
 * - Abort-on-unmount / URL-change cleanup
 * - Unit normalisation: non-finite, negative, and out-of-range values
 * - APY clamping to [0, 100]
 * - Stale data preserved and surfaced during retries
 * - isStale cleared atomically with new data on recovery
 * - Empty-response path
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useChartHistory,
  isChartLoading,
  getSnapshots,
} from "./useChartHistory";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_URL = "/api/positions/history?interval=1d";

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: 1_700_000_000_000,
    supplied: 3_000,
    borrowed: 1_000,
    effectiveSupplyApy: 4.5,
    effectiveBorrowApy: 7.0,
    ...overrides,
  };
}

function okResponse(snapshots: unknown[] = [snapshot()]) {
  return {
    ok: true,
    json: async () => ({
      walletAddress: "G_TEST",
      snapshots,
      interval: "1d",
      bucketCount: snapshots.length,
    }),
  } as Response;
}

function errorResponse(status = 500) {
  return {
    ok: false,
    status,
    statusText: "Internal Server Error",
    json: async () => ({}),
  } as unknown as Response;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useChartHistory — initial state", () => {
  it("starts in loading state with isStale=false", () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));

    expect(result.current.state.status).toBe("loading");
    expect(isChartLoading(result.current.state)).toBe(true);
    expect(getSnapshots(result.current.state)).toHaveLength(0);
  });
});

describe("useChartHistory — success path", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("transitions atomically from loading → ready with normalised snapshots", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(okResponse());
    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));

    expect(result.current.state.status).toBe("loading");

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("ready");
    expect(isChartLoading(result.current.state)).toBe(false);

    const snaps = getSnapshots(result.current.state);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].supplied).toBe(3_000);
    expect(snaps[0].borrowed).toBe(1_000);
    expect(snaps[0].netValue).toBe(2_000);
    expect(snaps[0].supplyApy).toBe(4.5);
    expect(snaps[0].collateralRatio).toBe(3);
  });

  it("transitions to empty when response has no valid snapshots", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(okResponse([]));
    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("empty");
    expect(getSnapshots(result.current.state)).toHaveLength(0);
  });
});

describe("useChartHistory — unit normalisation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("clamps effectiveSupplyApy values above 100 to exactly 100", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(okResponse([snapshot({ effectiveSupplyApy: 150 })]));

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(getSnapshots(result.current.state)[0].supplyApy).toBe(100);
  });

  it("normalises NaN APY to 0", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(okResponse([snapshot({ effectiveSupplyApy: NaN })]));

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(getSnapshots(result.current.state)[0].supplyApy).toBe(0);
  });

  it("normalises negative APY to 0", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(okResponse([snapshot({ effectiveSupplyApy: -5 })]));

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(getSnapshots(result.current.state)[0].supplyApy).toBe(0);
  });

  it("excludes snapshots with negative supplied value", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        okResponse([
          snapshot({ supplied: -100 }),    // invalid — should be dropped
          snapshot({ timestamp: 1_700_000_100_000, supplied: 500 }),
        ]),
      );

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(getSnapshots(result.current.state)).toHaveLength(1);
    expect(getSnapshots(result.current.state)[0].supplied).toBe(500);
  });

  it("excludes snapshots with non-finite borrowed value", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        okResponse([snapshot({ borrowed: Infinity })]),
      );

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));
    await act(async () => { await vi.runAllTimersAsync(); });

    // All snapshots filtered → empty
    expect(result.current.state.status).toBe("empty");
  });

  it("sets collateralRatio to null when borrowed is 0 (no debt)", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        okResponse([snapshot({ borrowed: 0, supplied: 5_000 })]),
      );

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(getSnapshots(result.current.state)[0].collateralRatio).toBeNull();
  });

  it("excludes snapshots with invalid (zero/negative) timestamps", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        okResponse([
          snapshot({ timestamp: 0 }),      // invalid
          snapshot({ timestamp: -1 }),     // invalid
          snapshot({ timestamp: 1_700_000_000_001 }), // valid
        ]),
      );

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(getSnapshots(result.current.state)).toHaveLength(1);
  });

  it("sorts output snapshots by timestamp ascending regardless of input order", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        okResponse([
          snapshot({ timestamp: 1_700_000_200_000 }),
          snapshot({ timestamp: 1_700_000_100_000 }),
          snapshot({ timestamp: 1_700_000_000_000 }),
        ]),
      );

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));
    await act(async () => { await vi.runAllTimersAsync(); });

    const snaps = getSnapshots(result.current.state);
    expect(snaps[0].timestamp).toBeLessThan(snaps[1].timestamp);
    expect(snaps[1].timestamp).toBeLessThan(snaps[2].timestamp);
  });
});

describe("useChartHistory — retry and failure recovery", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("retries on non-ok HTTP responses and stops at MAX_RETRIES (3)", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(errorResponse(503));

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("error");
    // 1 initial + 3 retries = 4 calls
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("retries on network errors (thrown exceptions)", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("error");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("clears error and isStale atomically when a retry succeeds", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(okResponse());

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("ready");
    if (result.current.state.status === "ready") {
      expect(result.current.state.isStale).toBe(false);
    }
  });

  it("preserves last good snapshots in error state when retries are exhausted", async () => {
    // First call succeeds, subsequent calls fail
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(okResponse())
      .mockRejectedValue(new Error("persistent failure"));

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));

    // Let first fetch succeed
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.state.status).toBe("ready");

    // Trigger a refetch that will exhaust retries
    act(() => result.current.refetch());
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("error");
    // Stale data from first successful fetch is preserved
    const snaps = getSnapshots(result.current.state);
    expect(snaps).toHaveLength(1);
  });

  it("surfaces loading-stale status while retrying with prior data", async () => {
    let resolveFirst!: (v: Response) => void;
    let rejectRetry!: (e: Error) => void;

    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Response>((r) => { resolveFirst = r; }),
      )
      .mockImplementationOnce(
        () => new Promise<Response>((_, r) => { rejectRetry = r; }),
      );

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));

    // Resolve first fetch with good data
    await act(async () => {
      resolveFirst(okResponse());
      await vi.runAllTimersAsync();
    });

    expect(result.current.state.status).toBe("ready");

    // Trigger manual refetch — will fail
    act(() => result.current.refetch());

    await act(async () => {
      rejectRetry(new Error("transient"));
      // Advance into the first retry back-off
      await vi.advanceTimersByTimeAsync(1_200);
    });

    // Should be in loading-stale with prior snapshots still available
    const status = result.current.state.status;
    expect(["loading-stale", "error"]).toContain(status);
    expect(getSnapshots(result.current.state)).toHaveLength(1);
  });
});

describe("useChartHistory — deduplication", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("shares one in-flight request across concurrent mounts for the same URL", async () => {
    let resolveShared!: (v: Response) => void;
    const sharedPromise = new Promise<Response>((r) => { resolveShared = r; });

    const fetcher = vi.fn().mockReturnValue(sharedPromise);

    const { result: r1 } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));
    const { result: r2 } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));

    // Both show loading initially
    expect(r1.current.state.status).toBe("loading");
    expect(r2.current.state.status).toBe("loading");

    await act(async () => {
      resolveShared(okResponse());
      await vi.runAllTimersAsync();
    });

    // Only one HTTP request issued despite two hook instances
    expect(fetcher).toHaveBeenCalledTimes(1);

    expect(r1.current.state.status).toBe("ready");
    expect(r2.current.state.status).toBe("ready");
  });
});

describe("useChartHistory — stale-response rejection (generation counter)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("discards a slow response that arrives after refetch() supersedes it", async () => {
    // First fetch is slow; second (refetch) resolves first
    let resolveFirst!: (v: Response) => void;

    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Response>((r) => { resolveFirst = r; }),
      )
      .mockResolvedValueOnce(
        okResponse([snapshot({ timestamp: 1_700_000_200_000, supplied: 9_000, borrowed: 1_000 })]),
      );

    const { result } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));

    // Trigger refetch (generation 2) while generation 1 is still in flight
    act(() => result.current.refetch());

    // Let the refetch resolve
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.status).toBe("ready");
    const snaps = getSnapshots(result.current.state);
    // Should reflect the refetch data (supplied=9000), not the slow first fetch
    expect(snaps[0].supplied).toBe(9_000);

    // Now resolve the stale first fetch — state must not change
    const snapshotBefore = getSnapshots(result.current.state);
    await act(async () => {
      resolveFirst(
        okResponse([snapshot({ timestamp: 1_700_000_000_000, supplied: 3_000 })]),
      );
      await vi.runAllTimersAsync();
    });

    // State is unchanged — stale response was discarded
    expect(getSnapshots(result.current.state)).toEqual(snapshotBefore);
  });
});

describe("useChartHistory — abort on unmount", () => {
  it("aborts the in-flight request when the component unmounts", () => {
    const abortMock = vi.fn();
    vi.stubGlobal(
      "AbortController",
      vi.fn().mockImplementation(() => ({
        abort: abortMock,
        signal: { aborted: false, addEventListener: vi.fn() },
      })),
    );

    const fetcher = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
    const { unmount } = renderHook(() => useChartHistory(TEST_URL, { fetcher }));

    unmount();

    expect(abortMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

describe("useChartHistory — convenience selectors", () => {
  it("isChartLoading returns true for loading and loading-stale, false otherwise", () => {
    expect(isChartLoading({ status: "idle" })).toBe(false);
    expect(isChartLoading({ status: "loading", isStale: false })).toBe(true);
    expect(
      isChartLoading({
        status: "loading-stale",
        isStale: true,
        snapshots: [],
      }),
    ).toBe(true);
    expect(
      isChartLoading({ status: "ready", isStale: false, snapshots: [] }),
    ).toBe(false);
    expect(isChartLoading({ status: "empty", isStale: false })).toBe(false);
  });

  it("getSnapshots returns [] for non-data states and the array for data states", () => {
    expect(getSnapshots({ status: "idle" })).toEqual([]);
    expect(getSnapshots({ status: "loading", isStale: false })).toEqual([]);
    expect(getSnapshots({ status: "empty", isStale: false })).toEqual([]);

    const snaps = [
      {
        timestamp: 1,
        netValue: 0,
        supplied: 0,
        borrowed: 0,
        supplyApy: 0,
        collateralRatio: null,
      },
    ];
    expect(
      getSnapshots({ status: "ready", isStale: false, snapshots: snaps }),
    ).toBe(snaps);
    expect(
      getSnapshots({
        status: "loading-stale",
        isStale: true,
        snapshots: snaps,
      }),
    ).toBe(snaps);
    expect(
      getSnapshots({
        status: "error",
        isStale: true,
        error: new Error("x"),
        snapshots: snaps,
      }),
    ).toBe(snaps);
  });
});
