'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, Loader, AlertCircle } from 'lucide-react';
import type {
  SearchResultsData,
  SearchResult,
  SearchResultTransaction,
  SearchResultPosition,
} from '@/lib/search/types';
import { flattenSearchResults, getResultsCount } from '@/lib/search';

export interface SearchResultsProps {
  /**
   * Search results data with state, results, and error information
   */
  results: SearchResultsData;

  /**
   * Whether the results dropdown is visible
   */
  isOpen: boolean;

  /**
   * Callback when a result is selected
   */
  onResultSelect?: (result: SearchResult) => void;

  /**
   * Callback when results are closed (e.g., Escape key)
   */
  onClose?: () => void;

  /**
   * Callback to navigate to result (optional for testing)
   */
  onNavigate?: (path: string) => void;

  /**
   * Additional CSS classes for the container
   */
  className?: string;

  /**
   * HTML id attribute for the root container.
   * Used for ARIA linkage with the combobox input.
   */
  id?: string;
}

/**
 * SearchResults Component
 *
 * Displays grouped, keyboard-navigable search results with:
 * - Grouped results by type (transactions, positions)
 * - Arrow key navigation between results
 * - Enter to select result
 * - Escape to close
 * - Loading and error states
 * - Accessible with aria-activedescendant
 * - Deep-linking to transaction detail views
 *
 * @example
 * ```tsx
 * const { results } = useSearchResults();
 *
 * return (
 *   <div>
 *     <SearchBar onSearch={handleSearch} />
 *     <SearchResults
 *       results={results}
 *       isOpen={showResults}
 *       onResultSelect={handleResultSelect}
 *       onClose={handleClose}
 *     />
 *   </div>
 * );
 * ```
 */
const SearchResults = React.forwardRef<HTMLDivElement, SearchResultsProps>(
  (
    {
      results,
      isOpen,
      onResultSelect,
      onClose,
      onNavigate,
      className = '',
      id,
    },
    ref
  ) => {
    const [activeIndex, setActiveIndex] = useState(-1);
    const resultsContainerRef = useRef<HTMLDivElement>(null);
    const resultItemsRef = useRef<Map<number, HTMLDivElement>>(new Map());

    const flattened = flattenSearchResults(results.results);
    const resultCount = getResultsCount(results.results);

    /**
     * Navigate to transaction or position detail page
     */
    const navigateToResult = useCallback((result: SearchResult) => {
      if (onNavigate) {
        if (result.type === 'transaction') {
          const txn = (result as SearchResultTransaction).transaction;
          onNavigate(`/dashboard/transactions/${txn.id}`);
        } else if (result.type === 'position') {
          const position = result as SearchResultPosition;
          onNavigate(`/dashboard/positions/${position.asset}`);
        }
      }
    }, [onNavigate]);

    /**
     * Handle result selection
     */
    const handleSelectResult = useCallback(
      (result: SearchResult) => {
        onResultSelect?.(result);
        navigateToResult(result);
        onClose?.();
        setActiveIndex(-1);
      },
      [onResultSelect, navigateToResult, onClose]
    );

    /**
     * Handle keyboard navigation
     */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!isOpen || resultCount === 0) return;

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setActiveIndex((prev) => {
              const next = prev < resultCount - 1 ? prev + 1 : 0;
              scrollToResult(next);
              return next;
            });
            break;

          case 'ArrowUp':
            e.preventDefault();
            setActiveIndex((prev) => {
              const next = prev > 0 ? prev - 1 : resultCount - 1;
              scrollToResult(next);
              return next;
            });
            break;

          case 'Enter':
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < resultCount) {
              const result = flattened[activeIndex];
              if (result) {
                handleSelectResult(result);
              }
            }
            break;

          case 'Escape':
            e.preventDefault();
            onClose?.();
            setActiveIndex(-1);
            break;

          default:
            break;
        }
      },
      [isOpen, resultCount, flattened, activeIndex, handleSelectResult, onClose]
    );

    /**
     * Scroll active result into view
     */
    const scrollToResult = useCallback((index: number) => {
      const resultEl = resultItemsRef.current.get(index);
      if (resultEl && resultEl.scrollIntoView) {
        resultEl.scrollIntoView({ block: 'nearest' });
      }
    }, []);

    /**
     * Reset active index when results change
     */
    useEffect(() => {
      if (results.state !== 'success' || resultCount === 0) {
        setActiveIndex(-1);
      }
    }, [results.state, resultCount]);

    /**
     * Handle clicking outside or Escape key
     */
    useEffect(() => {
      if (!isOpen) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose?.();
          setActiveIndex(-1);
        }
      };

      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) {
      return null;
    }

    /**
     * Render loading state
     */
    if (results.state === 'loading') {
      return (
        <div
          ref={ref}
          id={id}
          className={`absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-50 p-4 ${className}`}
        >
          <div className="flex items-center justify-center gap-3 py-6">
            <Loader
              size={18}
              className="animate-spin text-[var(--New-outline,rgb(113,180,141))]"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Searching transactions and positions...
            </span>
          </div>
        </div>
      );
    }

    /**
     * Render error state
     */
    if (results.state === 'error' && results.error) {
      return (
        <div
          ref={ref}
          id={id}
          className={`absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-50 p-4 ${className}`}
        >
          <div className="flex items-start gap-3 py-4">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Search Error
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {results.error.message}
              </p>
            </div>
          </div>
        </div>
      );
    }

    /**
     * Render empty state
     */
    if (results.state === 'success' && resultCount === 0) {
      return (
        <div
          ref={ref}
          id={id}
          className={`absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-50 p-4 ${className}`}
        >
          <div className="text-center py-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No results found for "{results.query}"
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Try searching by transaction ID, asset, or date
            </p>
          </div>
        </div>
      );
    }

    /**
     * Render success state with grouped results
     */
    return (
      <div
        ref={ref}
        id={id}
        className={`absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-50 max-h-96 overflow-y-auto ${className}`}
        role="listbox"
        aria-label="Search results"
      >
        {/* Transactions Section */}
        {results.results.transactions.length > 0 && (
          <div>
            <div className="sticky top-0 bg-white dark:bg-gray-900 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Transactions ({results.results.transactions.length})
              </p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {results.results.transactions.map((result, idx) => {
                const globalIndex = idx;
                return (
                  <ResultItem
                    key={result.id}
                    result={result}
                    isActive={activeIndex === globalIndex}
                    onSelect={() => handleSelectResult(result)}
                    onKeyDown={handleKeyDown}
                    ref={(el) => {
                      if (el) {
                        resultItemsRef.current.set(globalIndex, el);
                      } else {
                        resultItemsRef.current.delete(globalIndex);
                      }
                    }}
                    ariaIndex={globalIndex}
                    ariaSetSize={resultCount}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Positions Section */}
        {results.results.positions.length > 0 && (
          <div>
            <div className="sticky top-0 bg-white dark:bg-gray-900 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Positions ({results.results.positions.length})
              </p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {results.results.positions.map((result, idx) => {
                const globalIndex = results.results.transactions.length + idx;
                return (
                  <ResultItem
                    key={result.id}
                    result={result}
                    isActive={activeIndex === globalIndex}
                    onSelect={() => handleSelectResult(result)}
                    onKeyDown={handleKeyDown}
                    ref={(el) => {
                      if (el) {
                        resultItemsRef.current.set(globalIndex, el);
                      } else {
                        resultItemsRef.current.delete(globalIndex);
                      }
                    }}
                    ariaIndex={globalIndex}
                    ariaSetSize={resultCount}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
);

SearchResults.displayName = 'SearchResults';

/**
 * Individual result item component
 */
interface ResultItemProps {
  result: SearchResult;
  isActive: boolean;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  ariaIndex: number;
  ariaSetSize: number;
}

const ResultItem = React.forwardRef<HTMLDivElement, ResultItemProps>(
  ({ result, isActive, onSelect, onKeyDown, ariaIndex, ariaSetSize }, ref) => {
    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isActive}
        aria-posinset={ariaIndex + 1}
        aria-setsize={ariaSetSize}
        className={`px-4 py-3 cursor-pointer transition-colors duration-150 flex items-center justify-between group ${
          isActive
            ? 'bg-gray-50 dark:bg-gray-800 border-l-2 border-[var(--New-outline,rgb(113,180,141))]'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-l-2 border-transparent'
        }`}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        tabIndex={0}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {result.title}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
            {result.subtitle}
          </p>
        </div>
        <ChevronRight
          size={16}
          className={`text-gray-400 dark:text-gray-600 flex-shrink-0 ml-2 transition-opacity duration-150 ${
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
          }`}
        />
      </div>
    );
  }
);

ResultItem.displayName = 'ResultItem';

export default SearchResults;
