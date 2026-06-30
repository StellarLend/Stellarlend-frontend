import { renderHook, act } from "@testing-library/react";
import { usePositions } from "./usePositions";

describe("usePositions retry logic", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("retries failed fetches with backoff and stops at max attempts", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => usePositions());

    expect(result.current.isLoading).toBe(true);
    
    // Attempt 0
    await act(async () => {
      await Promise.resolve();
    });

    // We should be stale now
    expect(result.current.isStale).toBe(true);

    // Fast-forward through 5 retries
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        jest.runAllTimers();
        await Promise.resolve();
      });
    }

    // It should stop retrying and finally set error
    expect(result.current.error).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(6); // 1 initial + 5 retries
  });

  it("aborts in-flight requests on unmount", () => {
    const abortMock = jest.fn();
    global.AbortController = jest.fn().mockImplementation(() => ({
      abort: abortMock,
      signal: {}
    }));
    
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    const { unmount } = renderHook(() => usePositions());
    unmount();
    
    expect(abortMock).toHaveBeenCalled();
  });
});
