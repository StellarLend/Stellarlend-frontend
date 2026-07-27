import React from 'react';
import { render, screen, fireEvent } from '@/test/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearchResultsContainer from './SearchResultsContainer';
import type { SearchResultsData } from '@/lib/search/types';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('SearchResultsContainer', () => {
  const mockResultsBase: SearchResultsData = {
    query: 'xlm',
    state: 'idle',
    results: { transactions: [], positions: [] },
    error: null,
    total: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a distinct retryable error when the search data source returns 500', () => {
    const onRetry = vi.fn();

    render(
      <SearchResultsContainer
        results={{
          ...mockResultsBase,
          state: 'error',
          error: {
            message: 'Server error while searching. Please try again.',
            source: 'all',
            statusCode: 500,
            retryable: true,
          },
        }}
        isOpen={true}
        onRetry={onRetry}
      />
    );

    expect(screen.getByTestId('search-results-error')).toBeInTheDocument();
    expect(screen.getByText('Search Error')).toBeInTheDocument();
    expect(screen.queryByText(/No results found/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps empty success results visually distinct from a 500 error', () => {
    const { rerender } = render(
      <SearchResultsContainer
        results={{
          ...mockResultsBase,
          state: 'success',
          total: 0,
        }}
        isOpen={true}
      />
    );

    expect(screen.getByText(/No results found for/i)).toBeInTheDocument();
    expect(screen.queryByText('Search Error')).not.toBeInTheDocument();

    rerender(
      <SearchResultsContainer
        results={{
          ...mockResultsBase,
          state: 'error',
          error: {
            message: 'Server error while searching. Please try again.',
            source: 'all',
            statusCode: 500,
            retryable: true,
          },
        }}
        isOpen={true}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText('Search Error')).toBeInTheDocument();
    expect(screen.queryByText(/No results found/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
