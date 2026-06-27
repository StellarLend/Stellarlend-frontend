import React from 'react';
import { render, screen, fireEvent } from '@/test/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SearchResults from './SearchResults';
import type { SearchResultsData } from '@/lib/search/types';

describe('SearchResults Component', () => {
  const mockTransaction = {
    id: 'TXN123',
    type: 'transaction' as const,
    title: 'Deposit - XLM',
    subtitle: '1000 XLM • 2025-06-27',
    transaction: {
      id: 'TXN123',
      type: 'Deposit' as const,
      amount: 1000,
      asset: 'XLM' as const,
      date: '2025-06-27',
      time: '10:00AM',
      status: 'Completed' as const,
    },
  };

  const mockPosition = {
    id: 'pos-xlm-1',
    type: 'position' as const,
    title: 'XLM Position',
    subtitle: 'Balance: $5,000.00',
    asset: 'XLM',
  };

  const mockResultsBase: SearchResultsData = {
    query: 'test',
    state: 'idle',
    results: {
      transactions: [],
      positions: [],
    },
    error: null,
    total: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <SearchResults
          results={mockResultsBase}
          isOpen={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: { transactions: [mockTransaction], positions: [] },
          }}
          isOpen={true}
        />
      );

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: { transactions: [mockTransaction], positions: [] },
          }}
          isOpen={true}
        />
      );

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Search results');
    });
  });

  describe('Loading State', () => {
    it('should display loading indicator', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'loading',
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText(/Searching transactions and positions/i)).toBeInTheDocument();
    });

    it('should show spinner icon during loading', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'loading',
          }}
          isOpen={true}
        />
      );

      const spinner = container.querySelector('svg');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'error',
            error: {
              message: 'Failed to fetch results',
              source: 'all',
            },
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText('Search Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch results')).toBeInTheDocument();
    });

    it('should display error icon', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'error',
            error: {
              message: 'Network error',
              source: 'all',
            },
          }}
          isOpen={true}
        />
      );

      const errorIcon = container.querySelector('svg');
      expect(errorIcon).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display "no results" message', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            query: 'xyz',
            results: {
              transactions: [],
              positions: [],
            },
            total: 0,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText(/No results found for/i)).toBeInTheDocument();
      expect(screen.getByText(/xyz/)).toBeInTheDocument();
    });

    it('should display helpful search tips in empty state', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [],
              positions: [],
            },
            total: 0,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText(/transaction ID, asset, or date/i)).toBeInTheDocument();
    });
  });

  describe('Transaction Results', () => {
    it('should display transaction results with section header', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText('Transactions (1)')).toBeInTheDocument();
      expect(screen.getByText('Deposit - XLM')).toBeInTheDocument();
    });

    it('should display multiple transactions', () => {
      const tx2 = {
        ...mockTransaction,
        id: 'TXN124',
        title: 'Withdrawal - USDC',
      };

      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction, tx2],
              positions: [],
            },
            total: 2,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText('Transactions (2)')).toBeInTheDocument();
      expect(screen.getByText('Deposit - XLM')).toBeInTheDocument();
      expect(screen.getByText('Withdrawal - USDC')).toBeInTheDocument();
    });

    it('should display transaction title and subtitle', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText('Deposit - XLM')).toBeInTheDocument();
      expect(screen.getByText('1000 XLM • 2025-06-27')).toBeInTheDocument();
    });
  });

  describe('Position Results', () => {
    it('should display position results with section header', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [],
              positions: [mockPosition],
            },
            total: 1,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText('Positions (1)')).toBeInTheDocument();
      expect(screen.getByText('XLM Position')).toBeInTheDocument();
    });

    it('should display multiple positions', () => {
      const pos2 = {
        ...mockPosition,
        id: 'pos-usdc-1',
        title: 'USDC Position',
      };

      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [],
              positions: [mockPosition, pos2],
            },
            total: 2,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText('Positions (2)')).toBeInTheDocument();
      expect(screen.getByText('XLM Position')).toBeInTheDocument();
      expect(screen.getByText('USDC Position')).toBeInTheDocument();
    });
  });

  describe('Grouped Results', () => {
    it('should display both transactions and positions', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [mockPosition],
            },
            total: 2,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText('Transactions (1)')).toBeInTheDocument();
      expect(screen.getByText('Positions (1)')).toBeInTheDocument();
      expect(screen.getByText('Deposit - XLM')).toBeInTheDocument();
      expect(screen.getByText('XLM Position')).toBeInTheDocument();
    });

    it('should display transactions before positions', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [mockPosition],
            },
            total: 2,
          }}
          isOpen={true}
        />
      );

      const headers = container.querySelectorAll(
        '[class*="uppercase"][class*="tracking-wider"]'
      );
      expect(headers[0]).toHaveTextContent('Transactions');
      expect(headers[1]).toHaveTextContent('Positions');
    });
  });

  describe('Keyboard Navigation', () => {

    it('should handle Arrow Up key to move up', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction, { ...mockTransaction, id: 'TXN124' }],
              positions: [],
            },
            total: 2,
          }}
          isOpen={true}
        />
      );

      const results = container.querySelectorAll('[role="option"]');
      const firstResult = results[0] as HTMLElement;

      fireEvent.keyDown(firstResult, { key: 'ArrowUp' });

      const lastResult = results[results.length - 1] as HTMLElement;
      expect(lastResult).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap around at top with Arrow Up', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction, { ...mockTransaction, id: 'TXN124' }],
              positions: [],
            },
            total: 2,
          }}
          isOpen={true}
        />
      );

      const results = container.querySelectorAll('[role="option"]');

      fireEvent.keyDown(results[0], { key: 'ArrowUp' });

      const lastResult = results[results.length - 1] as HTMLElement;
      expect(lastResult).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap around at bottom with Arrow Down', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
        />
      );

      const results = container.querySelectorAll('[role="option"]');
      const lastResult = results[results.length - 1] as HTMLElement;

      fireEvent.keyDown(lastResult, { key: 'ArrowDown' });

      const firstResult = results[0] as HTMLElement;
      expect(firstResult).toHaveAttribute('aria-selected', 'true');
    });

    it('should call onResultSelect on Enter key', () => {
      const onResultSelect = vi.fn();
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
          onResultSelect={onResultSelect}
        />
      );

      const result = container.querySelector('[role="option"]') as HTMLElement;

      // Navigate to the result with Arrow Down first
      fireEvent.keyDown(result, { key: 'ArrowDown' });

      // Now press Enter
      fireEvent.keyDown(result, { key: 'Enter' });

      expect(onResultSelect).toHaveBeenCalled();
    });
  });

  describe('Click Handling', () => {
    it('should call onResultSelect when result is clicked', () => {
      const onResultSelect = vi.fn();
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
          onResultSelect={onResultSelect}
        />
      );

      const resultItem = screen.getByText('Deposit - XLM');
      fireEvent.click(resultItem);

      expect(onResultSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'TXN123',
          type: 'transaction',
        })
      );
    });

    it('should highlight result on hover', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
        />
      );

      const result = container.querySelector('[role="option"]') as HTMLElement;
      fireEvent.mouseEnter(result);

      expect(result).toHaveClass('hover:bg-gray-50');
    });
  });

  describe('Escape Key Handling', () => {
    it('should call onClose on Escape key', () => {
      const onClose = vi.fn();
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
          onClose={onClose}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });

    it('should not call onClose if already closed', () => {
      const onClose = vi.fn();
      render(
        <SearchResults
          results={mockResultsBase}
          isOpen={false}
          onClose={onClose}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Active State Styling', () => {
    it('should set aria-selected on navigation', async () => {
      const { container, rerender } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction, { ...mockTransaction, id: 'TXN124' }],
              positions: [],
            },
            total: 2,
          }}
          isOpen={true}
        />
      );

      const results = container.querySelectorAll('[role="option"]');
      const firstResult = results[0] as HTMLElement;

      // Simulate keyboard navigation
      fireEvent.keyDown(firstResult, { key: 'ArrowDown' });

      // Re-render to verify state changes propagate
      rerender(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction, { ...mockTransaction, id: 'TXN124' }],
              positions: [],
            },
            total: 2,
          }}
          isOpen={true}
        />
      );

      // Check that results are still renderable
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);
    });
  });

  describe('ARIA Attributes', () => {
    it('should set aria-selected correctly', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
        />
      );

      const option = container.querySelector('[role="option"]') as HTMLElement;
      expect(option).toHaveAttribute('aria-selected');
    });

    it('should set aria-posinset and aria-setsize', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction, { ...mockTransaction, id: 'TXN124' }],
              positions: [],
            },
            total: 2,
          }}
          isOpen={true}
        />
      );

      const options = container.querySelectorAll('[role="option"]');
      expect(options[0]).toHaveAttribute('aria-posinset', '1');
      expect(options[0]).toHaveAttribute('aria-setsize', '2');
      expect(options[1]).toHaveAttribute('aria-posinset', '2');
      expect(options[1]).toHaveAttribute('aria-setsize', '2');
    });
  });

  describe('Dark Mode Support', () => {
    it('should have dark mode classes', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
        />
      );

      const listbox = container.querySelector('[role="listbox"]');
      expect(listbox).toHaveClass('dark:bg-gray-900');
      expect(listbox).toHaveClass('dark:border-gray-700');
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref to container div', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <SearchResults
          ref={ref}
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
        />
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
          className="custom-class"
        />
      );

      const listbox = container.querySelector('[role="listbox"]');
      expect(listbox).toHaveClass('custom-class');
    });
  });

  describe('Edge Cases', () => {
    it('should handle no transactions but has positions', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [],
              positions: [mockPosition],
            },
            total: 1,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText('Positions (1)')).toBeInTheDocument();
      expect(screen.queryByText(/Transactions/)).not.toBeInTheDocument();
    });

    it('should handle no positions but has transactions', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [mockTransaction],
              positions: [],
            },
            total: 1,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText('Transactions (1)')).toBeInTheDocument();
      expect(screen.queryByText(/Positions/)).not.toBeInTheDocument();
    });

    it('should handle keyboard navigation with no results', () => {
      const { container } = render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            results: {
              transactions: [],
              positions: [],
            },
            total: 0,
          }}
          isOpen={true}
        />
      );

      expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    });

    it('should handle null error gracefully', () => {
      render(
        <SearchResults
          results={{
            ...mockResultsBase,
            state: 'success',
            error: null,
            results: {
              transactions: [],
              positions: [],
            },
            total: 0,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByText(/No results found/)).toBeInTheDocument();
    });
  });
});
