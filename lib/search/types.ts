import type { Transaction } from '@/types/Transaction';

/**
 * Represents a single transaction in search results.
 */
export interface SearchResultTransaction {
  id: string;
  type: 'transaction';
  title: string;
  subtitle: string;
  transaction: Transaction;
}

/**
 * Represents a position in search results.
 */
export interface SearchResultPosition {
  id: string;
  type: 'position';
  title: string;
  subtitle: string;
  asset: string;
}

/**
 * Union type of all searchable result types.
 */
export type SearchResult = SearchResultTransaction | SearchResultPosition;

/**
 * Results grouped by type.
 */
export interface GroupedSearchResults {
  transactions: SearchResultTransaction[];
  positions: SearchResultPosition[];
}

/**
 * State of a search query.
 */
export type SearchState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Error details for search.
 */
export interface SearchError {
  message: string;
  source?: 'transactions' | 'positions' | 'all';
}

/**
 * Complete search results with metadata.
 */
export interface SearchResultsData {
  query: string;
  state: SearchState;
  results: GroupedSearchResults;
  error: SearchError | null;
  total: number;
}
