import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { useInfiniteTransactions } from "./useInfiniteTransactions";
import type { FetchTransactionsResponse } from "@/types/Transaction";

const mockPage1: FetchTransactionsResponse = {
  transactions: [
    { id: "t1", type: "Lend", amount: 100, asset: "XLM", date: "2024-01-03", time: "10:00", status: "Completed" },
    { id: "t2", type: "Borrow", amount: 200, asset: "USDC", date: "2024-01-02", time: "11:00", status: "Completed" },
  ],
  total: 5,
  nextCursor: "cursor-page-2",
};

const mockPage2: FetchTransactionsResponse = {
  transactions: [
    { id: "t3", type: "Repay", amount: 50, asset: "XLM", date: "2024-01-01", time: "12:00", status: "Processing" },
  ],
  total: 5,
  nextCursor: null,
};

describe("useInfiniteTransactions", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("cursor=cursor-page-2")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockPage2,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockPage1,
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the first page on mount", async () => {
    const { result } = renderHook(() => useInfiniteTransactions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.transactions).toHaveLength(2);
    expect(result.current.transactions[0].id).toBe("t1");
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it("loads the next page when loadMore is called", async () => {
    const { result } = renderHook(() => useInfiniteTransactions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });

    expect(result.current.transactions).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);
  });

  it("does not fetch when already loading", async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => mockPage1,
              }),
            100,
          ),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useInfiniteTransactions());

    await act(async () => {
      result.current.loadMore();
      result.current.loadMore();
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sets isError when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const { result } = renderHook(() => useInfiniteTransactions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeTruthy();
    expect(result.current.transactions).toHaveLength(0);
  });

  it("handles empty first page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ transactions: [], total: 0, nextCursor: null }),
      }),
    );

    const { result } = renderHook(() => useInfiniteTransactions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.transactions).toHaveLength(0);
    expect(result.current.hasMore).toBe(false);
  });

  it("resets state when reset is called", async () => {
    const { result } = renderHook(() => useInfiniteTransactions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.transactions).toHaveLength(2);

    act(() => {
      result.current.reset();
    });

    expect(result.current.transactions).toHaveLength(0);
    expect(result.current.isLoading).toBe(true);
  });

  it("starts with isLoading false and does not fetch when enabled is false", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useInfiniteTransactions({ enabled: false }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.transactions).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops at final cursor and does not fetch again", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("cursor=cursor-page-2")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPage2,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockPage1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useInfiniteTransactions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });

    expect(result.current.hasMore).toBe(false);
    expect(result.current.transactions).toHaveLength(3);

    await act(async () => {
      result.current.loadMore();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("prevents race conditions from rapid successive loadMore triggers", async () => {
    let resolveFirstRequest: ((value: any) => void) | null = null;
    let resolveSecondRequest: ((value: any) => void) | null = null;
    let firstRequestStarted = false;
    let secondRequestStarted = false;

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      // Initial page load
      if (!url.includes("cursor=")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPage1,
        });
      }
      
      // First loadMore call - delayed response
      if (url.includes("cursor=cursor-page-2") && !firstRequestStarted) {
        firstRequestStarted = true;
        return new Promise((resolve) => {
          resolveFirstRequest = resolve;
        });
      }
      
      // Second loadMore call (should be blocked)
      secondRequestStarted = true;
      return new Promise((resolve) => {
        resolveSecondRequest = resolve;
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useInfiniteTransactions());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.transactions).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    // Trigger loadMore twice in rapid succession
    act(() => {
      result.current.loadMore();
      result.current.loadMore(); // This should be ignored due to loadingRef guard
    });

    // Wait a bit to ensure second call would have been processed if not guarded
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Only the first request should have been initiated
    expect(firstRequestStarted).toBe(true);
    expect(secondRequestStarted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2); // Initial + first loadMore only

    // Resolve the first request
    act(() => {
      resolveFirstRequest?.({
        ok: true,
        json: async () => mockPage2,
      });
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });

    // Verify results are correct and not duplicated
    expect(result.current.transactions).toHaveLength(3);
    expect(result.current.transactions[0].id).toBe("t1");
    expect(result.current.transactions[1].id).toBe("t2");
    expect(result.current.transactions[2].id).toBe("t3");
    expect(result.current.hasMore).toBe(false);

    // Verify no second request was ever made
    expect(secondRequestStarted).toBe(false);
  });

  it("allows subsequent loadMore after previous request completes", async () => {
    const mockPage3: FetchTransactionsResponse = {
      transactions: [
        { id: "t4", type: "Withdraw", amount: 75, asset: "XLM", date: "2023-12-31", time: "13:00", status: "Completed" },
      ],
      total: 6,
      nextCursor: null,
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("cursor=cursor-page-3")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPage3,
        });
      }
      if (url.includes("cursor=cursor-page-2")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...mockPage2,
            nextCursor: "cursor-page-3",
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockPage1,
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useInfiniteTransactions());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // First loadMore
    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });

    expect(result.current.transactions).toHaveLength(3);
    expect(result.current.hasMore).toBe(true);

    // Second loadMore (should succeed now that first is complete)
    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });

    expect(result.current.transactions).toHaveLength(4);
    expect(result.current.hasMore).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3); // Initial + 2 loadMore calls
  });
});
