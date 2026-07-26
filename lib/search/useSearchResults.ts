'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchTransactions } from '@/types/Transaction';
import type {
  SearchResult,
  GroupedSearchResults,
  SearchError,
  SearchResultsData,
  SearchResultTransaction,
  SearchResultPosition,
} from './types';

/**
 * Hook for searching transactions and positions with debouncing.
 *
 * Features:
 * - Queries transactions from /api/transactions with search parameter
 * - Debounced search to prevent excessive API calls
 * - Loading, success, and error state management
 * - Handles cancellation of in-flight requests
 * - Groups results by type (transactions, positions)
 *
 * @param debounceDelay - Debounce delay in milliseconds (default: 300ms)
 * @param maxResults - Maximum number of results per type (default: 5)
 * @returns Search results data with current query, state, results, and error
 *
 * @example
 * const { results, state, error } = useSearchResults(300, 5);
 *
 * // In your component
 * <SearchResults {...results} onResultClick={handleClick} />
 */
export function useSearchResults(
  debounceDelay: number = 300,
  maxResults: number = 5
): {
  results: SearchResultsData;
  search: (query: string) => void;
} {
  const [results, setResults] = useState<SearchResultsData>({
    query: '',
    state: 'idle',
    results: { transactions: [], positions: [] },
    error: null,
    total: 0,
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetches positions from /api/positions and filters by the search query.
   */
  const fetchPositions = useCallback(
    async (query: string, signal: AbortSignal): Promise<SearchResultPosition[]> => {
      const response = await fetch('/api/positions', { signal });

      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }

      const data = await response.json() as Record<string, unknown>;

      // Normalise: the route may return { positions: [...] } or a single flat object
      type RawPosition = { id?: string; asset?: string; availableBalance?: string };
      let rawList: RawPosition[];

      if (Array.isArray(data.positions) && data.positions.length > 0) {
        rawList = data.positions as RawPosition[];
      } else if (data.asset || data.availableBalance) {
        // Top-level flat object (single-position response)
        rawList = [data as RawPosition];
      } else {
        rawList = [];
      }

      const lowerQuery = query.toLowerCase();

      return rawList
        .filter((pos) => {
          const asset = (pos.asset ?? '').toLowerCase();
          const id = (pos.id ?? '').toLowerCase();
          return asset.includes(lowerQuery) || id.includes(lowerQuery);
        })
        .slice(0, maxResults)
        .map((pos, i) => ({
          id: pos.id ?? `pos-${pos.asset ?? i}`,
          type: 'position' as const,
          title: `${pos.asset ?? 'Unknown'} Position`,
          subtitle: `Balance: ${pos.availableBalance ?? 'N/A'}`,
          asset: pos.asset ?? '',
        }));
    },
    [maxResults]
  );

  /**
   * Searches transactions via /api/transactions endpoint.
   */
  const searchTransactions = useCallback(
    async (query: string, signal: AbortSignal): Promise<SearchResultTransaction[]> => {
      try {
        const response = await fetchTransactions({
          search: query,
          pageSize: maxResults,
        });

        return response.transactions.map((txn) => ({
          id: txn.id,
          type: 'transaction' as const,
          title: `${txn.type} - ${txn.asset}`,
          subtitle: `${txn.amount} ${txn.asset} • ${txn.date}`,
          transaction: txn,
        }));
      } catch (error) {
        if (signal.aborted) {
          throw new Error('Request cancelled');
        }
        throw error;
      }
    },
    [maxResults]
  );

  /**
   * Main search handler with debounce and API calls.
   */
  const search = useCallback(
    (query: string) => {
      // Clear previous debounce and abort in-flight requests
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Empty query resets state
      if (!query.trim()) {
        setResults({
          query: '',
          state: 'idle',
          results: { transactions: [], positions: [] },
          error: null,
          total: 0,
        });
        return;
      }

      // Set loading state immediately for UX feedback
      setResults((prev) => ({
        ...prev,
        query,
        state: 'loading',
        error: null,
      }));

      // Debounce the actual search
      debounceTimeoutRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          // Fetch from both sources in parallel
          const [transactions, positions] = await Promise.all([
            searchTransactions(query, controller.signal),
            fetchPositions(query, controller.signal),
          ]);

          if (controller.signal.aborted) {
            return;
          }

          const grouped: GroupedSearchResults = {
            transactions,
            positions,
          };

          setResults({
            query,
            state: 'success',
            results: grouped,
            error: null,
            total: transactions.length + positions.length,
          });
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          const errorMessage =
            error instanceof Error ? error.message : 'Search failed. Please try again.';

          setResults((prev) => ({
            ...prev,
            state: 'error',
            error: {
              message: errorMessage,
              source: 'all',
            },
          }));
        }
      }, debounceDelay);
    },
    [debounceDelay, searchTransactions, fetchPositions]
  );

  /**
   * Cleanup on unmount.
   */
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { results, search };
}

/**
 * Utility to flatten grouped results into a single array with metadata.
 */
export function flattenSearchResults(grouped: GroupedSearchResults): SearchResult[] {
  return [
    ...grouped.transactions,
    ...grouped.positions,
  ];
}

/**
 * Utility to get the result at a specific index in flattened results.
 */
export function getResultByIndex(
  grouped: GroupedSearchResults,
  index: number
): SearchResult | undefined {
  const flattened = flattenSearchResults(grouped);
  return flattened[index];
}

/**
 * Utility to get the total count of results.
 */
export function getResultsCount(grouped: GroupedSearchResults): number {
  return grouped.transactions.length + grouped.positions.length;
}
