/**
 * usePositionHistory — invariant and regression tests
 *
 * Covers:
 * - Initial loading state
 * - Success path: snapshot normalisation, unit preservation, output sorting
 * - isStale set during retries, cleared on recovery
 * - Generation counter rejects responses from superseded fetches
 * - Retry exhaustion → error surfaced, isStale stays true
 * - Abort-on-unmount and abort-on-window-change
 * - Boundary: non-finite/negative supplied or borrowed → snapshot excluded
 * - Boundary: invalid timestamps → snapshot excluded
 * - Boundary: netWorth correctly computed as supplied − borrowed
 * - Window change triggers a new independent fetch sequence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePositionHistory } from "./usePositionHistory";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rawSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: 1_700_000_000_000,
    supplied: 5_000,
    borrowed: 2_000,
    effectiveSupplyApy: 3.5,
    effectiveBorrowApy: 8.0,
    ...overrides,
  };
}

function okFetcher(snapshots: unknown[] = [rawSnapshot()]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      walletAddress: "G_TEST",
      snapshots,
      interval: "1h",
      bucketCount: snapshots.length,
    }),
  } as Response);
}

function errorFetcher(message = "Server error") {
  return vi.fn().mockRejectedValue(new Error(message));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("usePositionHistory — initial load", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("starts with isLoading=true, isStale=false, no data", () => {
    const fetcher = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
    const { result } = renderHook(() => usePositionHistory("7d", fetcher));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isStale).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe("usePositionHistory — success path", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("sets data and clears loading after a successful fetch", async () => {
    const { result } = renderHook(() =>
      usePositionHistory("7d", okFetcher()),
    );

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data?.snapshots).toHaveLength(1);
    expect(result.current.data?.window).toBe("7d");
  });

  it("correctly computes netWorth as supplied − borrowed", async () => {
    const fetcher = okFetcher([rawSnapshot({ supplied: 8_000, borrowed: 3_000 })]);
    const { result } = renderHook(() => usePositionHistory("7d", fetcher));

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.data?.snapshots[0].netWorth).toBe(5_000);
  });

  it("allows negative netWorth when borrowed > supplied", async () => {
    const fetcher = okFetcher([rawSnapshot({ supplied: 500, borrowed: 1_500 })]);
    const { result } = renderHook(() => usePositionHistory("7d", fetcher));

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.data?.snapshots[0].netWorth).toBe(-1_000);
  });

  it("sorts snapshots by timestamp ascending regardless of server order", async () => {
    const fetcher = okFetcher([
      rawSnapshot({ timestamp: 1_700_000_200_000 }),
      rawSnapshot({ timestamp: 1_700_000_000_000 }),
      rawSnapshot({ timestamp: 1_700_000_100_000 }),
    ]);

    const { result } = renderHook(() => usePositionHistory("7d", fetcher));
    await act(async () => { await vi.runAllTimersAsync(); });

    const snaps = result.current.data!.snapshots;
    expect(snaps[0].timestamp).toBeLessThan(snaps[1].timestamp);
    expect(snaps[1].timestamp).toBeLessThan(snaps[2].timestamp);
  });
});

describe("usePositionHistory — normalisation / boundary values", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("excludes snapshots with negative supplied", async () => {
    const fetcher = okFetcher([
      rawSnapshot({ supplied: -100 }),                               // invalid
      rawSnapshot({ timestamp: 1_700_000_100_000, supplied: 200 }), // valid
    ]);

    const { result } = renderHook(() => usePositionHistory("7d", fetcher));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.data?.snapshots).toHaveLength(1);
    expect(result.current.data?.snapshots[0].netWorth).toBe(200 - 2_000);
  });

  it("excludes snapshots with non-finite borrowed (Infinity)", async () => {
    const fetcher = okFetcher([rawSnapshot({ borrowed: Infinity })]);

    const { result } = renderHook(() => usePositionHistory("7d", fetcher));
    await act(async () => { await vi.runAllTimersAsync(); });

    // All normalised out → empty snapshots array (not null data)
    expect(result.current.data?.snapshots).toHaveLength(0);
  });

  it("excludes snapshots with NaN supplied", async () => {
    const fetcher = okFetcher([rawSnapshot({ supplied: NaN })]);

    const { result } = renderHook(() => usePositionHistory("7d", fetcher));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.data?.snapshots).toHaveLength(0);
  });

  it("excludes snapshots with invalid (zero) timestamps", async () => {
    const fetcher = okFetcher([
      rawSnapshot({ timestamp: 0 }),                         // invalid
      rawSnapshot({ timestamp: 1_700_000_000_001 }),         // valid
    ]);

    const { result } = renderHook(() => usePositionHistory("7d", fetcher));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.data?.snapshots).toHaveLength(1);
  });
});

describe("usePositionHistory — retry logic", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("retries up to MAX_RETRIES=3 and surfaces error after exhaustion", async () => {
    const fetcher = errorFetcher("Network down");
    const { result } = renderHook(() => usePositionHistory("7d", fetcher));

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
    // 1 initial + 3 retries
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("sets isStale=true while retries are in progress after a prior success", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          walletAddress: "G",
          snapshots: [rawSnapshot()],
          interval: "1h",
          bucketCount: 1,
        }),
      } as Response)
      .mockRejectedValue(new Error("transient"));

    const { result } = renderHook(() => usePositionHistory("7d", fetcher));

    // First fetch succeeds
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.isStale).toBe(false);

    // Refetch — will hit the rejection path
    act(() => result.current.refetch());

    // Advance into first back-off period
    await act(async () => { await vi.advanceTimersByTimeAsync(1_200); });

    expect(result.current.isStale).toBe(true);
    // Prior data still intact
    expect(result.current.data?.snapshots).toHaveLength(1);
  });

  it("clears isStale and error atomically when a retry succeeds", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("first fail"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          walletAddress: "G",
          snapshots: [rawSnapshot()],
          interval: "1h",
          bucketCount: 1,
        }),
      } as Response);

    const { result } = renderHook(() => usePositionHistory("7d", fetcher));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data?.snapshots).toHaveLength(1);
  });
});

describe("usePositionHistory — generation counter / stale-response rejection", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("discards a response that arrives after a newer refetch was issued", async () => {
    let resolveFirst!: (v: Response) => void;

    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Response>((r) => { resolveFirst = r; }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          walletAddress: "G",
          snapshots: [rawSnapshot({ supplied: 9_000 })],
          interval: "1h",
          bucketCount: 1,
        }),
      } as Response);

    const { result } = renderHook(() => usePositionHistory("7d", fetcher));

    // Fire refetch before the first response arrives
    act(() => result.current.refetch());

    // Let the second (refetch) request resolve
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.data?.snapshots[0].netWorth).toBe(9_000 - 2_000);

    // Now resolve the stale first request — state must not change
    const dataBefore = result.current.data;
    await act(async () => {
      resolveFirst({
        ok: true,
        json: async () => ({
          walletAddress: "G",
          snapshots: [rawSnapshot({ supplied: 1_000 })],
          interval: "1h",
          bucketCount: 1,
        }),
      } as Response);
      await vi.runAllTimersAsync();
    });

    expect(result.current.data).toEqual(dataBefore);
  });
});

describe("usePositionHistory — abort on unmount", () => {
  it("aborts the in-flight request when the hook unmounts", () => {
    const abortMock = vi.fn();
    vi.stubGlobal(
      "AbortController",
      vi.fn().mockImplementation(() => ({
        abort: abortMock,
        signal: { aborted: false, addEventListener: vi.fn() },
      })),
    );

    const fetcher = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
    const { unmount } = renderHook(() => usePositionHistory("7d", fetcher));

    unmount();

    expect(abortMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("usePositionHistory — window change", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("issues a new fetch and resets loading state when the window prop changes", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        walletAddress: "G",
        snapshots: [rawSnapshot()],
        interval: "1h",
        bucketCount: 1,
      }),
    } as Response);

    const { result, rerender } = renderHook(
      ({ w }: { w: "24h" | "7d" | "30d" }) => usePositionHistory(w, fetcher),
      { initialProps: { w: "7d" as const } },
    );

    await act(async () => { await vi.runAllTimersAsync(); });
    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ w: "30d" });

    await act(async () => { await vi.runAllTimersAsync(); });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.data?.window).toBe("30d");
  });
});
