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
});
