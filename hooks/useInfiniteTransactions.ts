"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  fetchTransactions,
  type Transaction,
  type FetchTransactionsOptions,
} from "@/types/Transaction";

export interface UseInfiniteTransactionsOptions
  extends Omit<FetchTransactionsOptions, "cursor" | "limit" | "page" | "pageSize"> {
  limit?: number;
  /** When true the hook mounts without triggering an initial fetch. */
  skip?: boolean;
}

export interface UseInfiniteTransactionsReturn {
  transactions: Transaction[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isError: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
}

export function useInfiniteTransactions(
  options: UseInfiniteTransactionsOptions = {},
): UseInfiniteTransactionsReturn {
  const { limit = 6, skip = false, ...filters } = options;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadingRef = useRef(false);
  const initialLoadRef = useRef(false);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
        setIsError(false);
        setError(null);

        const params: FetchTransactionsOptions = {
          ...filters,
          limit,
          cursor: cursor ?? undefined,
        };

        const response = await fetchTransactions(params);

        if (append) {
          setTransactions((prev) => [...prev, ...response.transactions]);
        } else {
          setTransactions(response.transactions);
        }
        setNextCursor(response.nextCursor ?? null);
      } catch (err) {
        setIsError(true);
        setError(err instanceof Error ? err : new Error("Failed to load transactions"));
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [filters, limit],
  );

  useEffect(() => {
    if (skip) return;
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      fetchPage(null, false);
    }
  }, [fetchPage, skip]);

  const loadMore = useCallback(() => {
    if (nextCursor && !loadingRef.current) {
      fetchPage(nextCursor, true);
    }
  }, [nextCursor, fetchPage]);

  const reset = useCallback(() => {
    loadingRef.current = false;
    initialLoadRef.current = false;
    setTransactions([]);
    setNextCursor(null);
    setIsLoading(true);
    setIsLoadingMore(false);
    setIsError(false);
    setError(null);
  }, []);

  return {
    transactions,
    isLoading,
    isLoadingMore,
    isError,
    error,
    hasMore: nextCursor !== null,
    loadMore,
    reset,
  };
}
