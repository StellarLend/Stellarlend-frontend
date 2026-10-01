import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePositions } from "../usePositions";

describe("usePositions", () => {
  const originalFetch = global.fetch;
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("retries on failure with backoff and eventually succeeds",  async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          borrowedAmount: "$100 USD",
          asset: "USD",
        }),
      });
    global.fetch = fetchMock as any;

    const { result } = renderHook(() => usePositions());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Advance timers to trigger retry backoff
    await act(async () => {
      vi.advanceTimersByTime(15000);
      await Promise.resolve();
    });

    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.positions).toHaveLength(1);
    expect(result.current.isStale).toBe(false);
    expect(result.current.isOffline).toBe(false);
  });

  it("detects offline state and does not retry", async () => {
    Object.defineProperty(global, "navigator", {
      value: { onLine: false },
      configurable: true,
    });

    const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
    global.fetch = fetchMock as any;

    const { result } = renderHook(() => usePositions());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isOffline).toBe(true);
    expect(result.current.isStale).toBe(true);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
