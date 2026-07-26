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
   * Parses mock positions data.
   * TODO: Replace with actual API call to /api/positions when available.
   */
  const fetchPositions = useCallback(
    async (query: string): Promise<SearchResultPosition[]> => {
      // Mock positions data - in a real app, this would query /api/positions
      const mockPositions = [
        {
          id: 'pos-xlm-1',
          asset: 'XLM',
          balance: '$5,000.00',
        },
        {
          id: 'pos-usdc-1',
          asset: 'USDC',
          balance: '$3,750.00',
        },
        {
          id: 'pos-btc-1',
          asset: 'BTC',
          balance: '$1,250.00',
        },
      ];

      // Filter by search term (asset or ID match)
      return mockPositions
        .filter(
          (pos) =>
            pos.asset.toLowerCase().includes(query.toLowerCase()) ||
            pos.id.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, maxResults)
        .map((pos) => ({
          id: pos.id,
          type: 'position' as const,
          title: `${pos.asset} Position`,
          subtitle: `Balance: ${pos.balance}`,
          asset: pos.asset,
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
            fetchPositions(query),
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
