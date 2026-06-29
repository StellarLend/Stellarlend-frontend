'use client';

import React, { useState, useCallback, useEffect, useRef, useId } from 'react';
import { X, Search } from 'lucide-react';
import { sanitiseString } from '@/lib/security/input-sanitizer';
import type { SearchResultsData, SearchResult } from '@/lib/search';
import SearchResults from '@/components/features/dashboard/components/SearchResults';

export interface SearchBarProps {
  /**
   * Placeholder text for the search input
   * @default "Search..."
   */
  placeholder?: string;

  /**
   * Callback function triggered when search value changes (debounced)
   */
  onSearch?: (value: string) => void;

  /**
   * Debounce delay in milliseconds
   * @default 300
   */
  debounceDelay?: number;

  /**
   * Callback function triggered when clear button is clicked
   */
  onClear?: () => void;

  /**
   * Additional CSS classes for the root container
   */
  className?: string;

  /**
   * If true, the slash key will focus the search input
   * @default true
   */
  enableSlashShortcut?: boolean;

  /**
   * If true, the clear button will be shown
   * @default true
   */
  showClearButton?: boolean;

  /**
   * If true, the search icon will be shown
   * @default true
   */
  showSearchIcon?: boolean;

  /**
   * Maximum width of the search bar
   * @default "md"
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'full';

  /**
   * Initial value for the search input
   * @default ""
   */
  initialValue?: string;

  /**
   * Aria-label for the search input
   * @default "Search input"
   */
  ariaLabel?: string;

  /**
   * Maximum allowed input length
   * @default 200
   */
  maxLength?: number;
   * Search results data to display in the live-results dropdown.
   * When provided, a dropdown appears below the input showing
   * matching transactions and positions as the user types.
  results?: SearchResultsData;

  /**
   * Callback fired when a result is selected via click or Enter key.
   * Receives the selected SearchResult.
  onResultSelect?: (result: SearchResult) => void;
   * Callback fired when a result should navigate to its detail page.
   * Receives the path string (e.g. "/dashboard/transactions/TXN123").
  onNavigate?: (path: string) => void;
   * Unique ID for the combobox. Auto-generated if not provided.
   * Used for ARIA attribute linkage between input and results listbox.
  resultsListId?: string;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  full: 'max-w-full',
};

/**
 * Consolidated SearchBar component with debounce, clear button, and keyboard support
 * 
 * Features:
 * - Debounced search callback to optimize performance
 * - Clear (x) button for quick input reset
 * - Slash (/) keyboard shortcut to focus the search input
 * - Visible focus state with ring indicator
 * - Proper icon alignment
 * - Full accessibility support (ARIA labels, keyboard navigation)
 * - TypeScript support with comprehensive JSDoc documentation
 * 
 * @example
 * ```tsx
 * const [searchQuery, setSearchQuery] = useState('');
 * 
 * return (
 *   <SearchBar
 *     placeholder="Search for token, asset, wallet address"
 *     onSearch={(value) => setSearchQuery(value)}
 *     onClear={() => setSearchQuery('')}
 *   />
 * );
 * ```
 */
const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      placeholder = 'Search...',
      onSearch,
      debounceDelay = 300,
      onClear,
      className = '',
      enableSlashShortcut = true,
      showClearButton = true,
      showSearchIcon = true,
      maxWidth = 'md',
      initialValue = '',
      ariaLabel = 'Search input',
      maxLength = 200,
      results,
      onResultSelect,
      onNavigate,
      resultsListId,
    },
    ref
  ) => {
    const [value, setValue] = useState(initialValue);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const generatedId = useId();
    const listId = resultsListId || `search-results-${generatedId}`;

    const resultsOpen = results && results.state !== 'idle';

    // Merge refs
    useEffect(() => {
      if (typeof ref === 'function') {
        ref(inputRef.current);
      } else if (ref) {
        ref.current = inputRef.current;
      }
    }, [ref]);

    // Debounced search callback with sanitization
    const handleValueChange = useCallback(
      (newValue: string) => {
        // Sanitize input
        const sanitized = sanitiseString(newValue);
        // Truncate if exceeds max length
        const truncated = sanitized.slice(0, maxLength);
        setValue(truncated);

        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
          onSearch?.(truncated);
        }, debounceDelay);
      },
      [onSearch, debounceDelay, maxLength]
    );

    // Handle clear button click
    const handleClear = useCallback(() => {
      setValue('');
      onClear?.();
      onSearch?.('');
      inputRef.current?.focus();
    }, [onClear, onSearch]);

    // Handle input change
    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleValueChange(e.target.value);
      },
      [handleValueChange]
    );

    // Handle keyboard shortcuts
    useEffect(() => {
      if (!enableSlashShortcut) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isInOtherInput =
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
          target !== inputRef.current;

        if (isInOtherInput) return;

        if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enableSlashShortcut]);

    // Re-trigger search on focus if input has value but results are idle
    const handleInputFocus = useCallback(() => {
      if (value.trim() && results && results.state === 'idle') {
        onSearch?.(value);
      }
    }, [value, results, onSearch]);

    // Handle keyboard navigation between input and results dropdown
    const handleInputKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!resultsOpen) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const listbox = document.getElementById(listId);
          if (listbox) {
            const firstOption = listbox.querySelector('[role="option"]') as HTMLElement | null;
            firstOption?.focus();
          }
        }
      },
      [resultsOpen, listId]
    );

    // Handle closing results on Escape
    useEffect(() => {
      if (!resultsOpen) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          inputRef.current?.focus();
        }
      };

      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }, [resultsOpen]);

    // Handle outside clicks to close results dropdown
    useEffect(() => {
      if (!resultsOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current &&
          !inputRef.current.contains(e.target as Node)
        ) {
          onSearch?.('');
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [resultsOpen, onSearch]);

    // Cleanup debounce timeout on unmount
    useEffect(() => {
      return () => {
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }
      };
    }, []);

    const isNearMaxLength = value.length >= maxLength * 0.9;
    const isAtMaxLength = value.length >= maxLength;

    return (
      <div className={`w-full ${maxWidthClasses[maxWidth]} ${className}`}>
        <div className="relative w-full">
          {/* Search Icon */}
          {showSearchIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 flex-shrink-0 pointer-events-none">
              <Search
                size={18}
                strokeWidth={2}
                aria-hidden="true"
              />
            </div>
          )}

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onFocus={handleInputFocus}
            aria-label={ariaLabel}
            role={results ? 'combobox' : undefined}
            aria-expanded={results ? resultsOpen : undefined}
            aria-controls={results ? listId : undefined}
            aria-activedescendant={resultsOpen ? undefined : undefined}
            aria-haspopup={results ? 'listbox' : undefined}
            aria-autocomplete="list"
            className={`
              w-full
              ${showSearchIcon ? 'pl-10' : 'pl-4'}
              ${showClearButton && value ? 'pr-20' : 'pr-10'}
              py-3
              rounded-xl
              font-semibold
              text-sm
              sm:text-base
              bg-white
              dark:bg-gray-900
              text-gray-900
              dark:text-gray-100
              placeholder-gray-500
              dark:placeholder-gray-400
              border
              ${isAtMaxLength ? 'border-red-500' : 'border-[var(--New-outline,rgb(113,180,141))]'}
              focus:outline-none
              focus:ring-2
              ${isAtMaxLength ? 'focus:ring-red-500' : 'focus:ring-[var(--New-outline,rgb(113,180,141))]'}
              focus:ring-opacity-50
              ${isAtMaxLength ? 'hover:border-red-500' : 'hover:border-[var(--New-outline,rgb(113,180,141))]'}
              transition-colors
              duration-200
              ${resultsOpen ? 'rounded-b-none rounded-t-xl' : 'rounded-xl'}
            `}
          />

          {/* Clear Button */}
          {showClearButton && value && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search input"
              className={`
                absolute
                ${isAtMaxLength ? 'right-12' : 'right-3'}
                top-1/2
                -translate-y-1/2
                text-gray-400
                hover:text-gray-600
                dark:hover:text-gray-300
                flex-shrink-0
                focus:outline-none
                focus:ring-2
                focus:ring-[var(--New-outline,rgb(113,180,141))]
                focus:ring-offset-2
                focus:ring-offset-white
                dark:focus:ring-offset-gray-900
                rounded
                transition-colors
                duration-150
                p-1
              `}
              title="Clear search"
            >
              <X
                size={18}
                strokeWidth={2}
              />
            </button>
          )}

          {/* Length Hint */}
          <div className={`
            absolute
            right-3
            top-1/2
            -translate-y-1/2
            text-xs
            font-medium
            ${isAtMaxLength ? 'text-red-500' : isNearMaxLength ? 'text-amber-500' : 'text-gray-400'}
            pointer-events-none
            hidden
            sm:block
          `}>
            {value.length}/{maxLength}
          </div>

          {/* Keyboard shortcut hint - only show when empty and slash shortcut enabled */}
          {enableSlashShortcut && !value && !isNearMaxLength && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none hidden sm:block">
              <kbd className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                /
              </kbd>
            </div>
          )}

          {/* Live results dropdown */}
          {results && (
            <SearchResults
              ref={dropdownRef}
              results={results}
              isOpen={resultsOpen}
              onResultSelect={onResultSelect}
              onNavigate={onNavigate}
              onClose={() => onSearch?.('')}
              id={listId}
            />
          )}
        </div>
      </div>
    );
  }
);

SearchBar.displayName = 'SearchBar';

export default SearchBar;
