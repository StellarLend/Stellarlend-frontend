'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SearchResults from './SearchResults';
import type { SearchResultsProps } from './SearchResults';

/**
 * SearchResultsContainer
 *
 * Wrapper component that integrates SearchResults with Next.js router.
 * This separates the routing logic from the presentational component,
 * making testing easier while maintaining production functionality.
 */
const SearchResultsContainer = React.forwardRef<
  HTMLDivElement,
  Omit<SearchResultsProps, 'onNavigate'>
>(({ ...props }, ref) => {
  const router = useRouter();

  const handleNavigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  return (
    <SearchResults
      ref={ref}
      {...props}
      onNavigate={handleNavigate}
    />
  );
});

SearchResultsContainer.displayName = 'SearchResultsContainer';

export default SearchResultsContainer;
