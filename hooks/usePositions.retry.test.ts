import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePositions } from "./usePositions";

describe("usePositions retry logic", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries failed fetches with backoff and stops at max attempts", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => usePositions());

    expect(result.current.isLoading).toBe(true);

    // Flush the initial (attempt 0) fetch rejection so the first retry gets scheduled.
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isStale).toBe(true);
    expect(result.current.isLoading).toBe(false);

    // Drive the recursive setTimeout retry chain to completion.
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isOffline).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(6); // 1 initial attempt + 5 retries
  });

  it("recovers and clears stale state once a retry succeeds", async () => {
    vi.mocked(global.fetch)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ positions: [] }),
      } as Response);

    const { result } = renderHook(() => usePositions());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isStale).toBe(true);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.isStale).toBe(false);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("aborts in-flight requests on unmount", () => {
    const abortMock = vi.fn();
    vi.stubGlobal(
      "AbortController",
      vi.fn().mockImplementation(() => ({
        abort: abortMock,
        signal: {},
      })),
    );

    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));

    const { unmount } = renderHook(() => usePositions());
    unmount();

    expect(abortMock).toHaveBeenCalled();
  });
});

describe("usePositions offline detection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports isOffline and does not retry while the browser is offline", async () => {
    const onLineSpy = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const mockError = new Error("Network error");
    vi.mocked(global.fetch).mockRejectedValue(mockError);

    const { result } = renderHook(() => usePositions());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isOffline).toBe(true);
    expect(result.current.isStale).toBe(true);
    expect(result.current.error).toEqual(mockError);
    expect(result.current.isLoading).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1); // no retries scheduled while offline

    onLineSpy.mockRestore();
  });

  it("clears isOffline once a fetch succeeds again", async () => {
    const onLineSpy = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

    const { result, rerender } = renderHook(() => usePositions());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isOffline).toBe(true);

    onLineSpy.mockReturnValue(true);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ positions: [] }),
    } as Response);

    await act(async () => {
      await result.current.refetch();
    });
    rerender();

    expect(result.current.isOffline).toBe(false);
    expect(result.current.isStale).toBe(false);

    onLineSpy.mockRestore();
  });
});
