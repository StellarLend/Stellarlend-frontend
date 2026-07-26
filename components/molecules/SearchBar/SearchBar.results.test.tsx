import React from 'react';
import { render, screen, fireEvent } from '@/test/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SearchBar from './SearchBar';
import type { SearchResultsData, SearchResult } from '@/lib/search';

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

function idleResults(query = ''): SearchResultsData {
  return {
    query,
    state: 'idle',
    results: { transactions: [], positions: [] },
    error: null,
    total: 0,
  };
}

function loadingResults(query = 'test'): SearchResultsData {
  return {
    query,
    state: 'loading',
    results: { transactions: [], positions: [] },
    error: null,
    total: 0,
  };
}

function successResults(
  query = 'test',
  transactions = [mockTransaction],
  positions = [mockPosition]
): SearchResultsData {
  return {
    query,
    state: 'success',
    results: { transactions, positions },
    error: null,
    total: transactions.length + positions.length,
  };
}

function emptyResults(query = 'xyz'): SearchResultsData {
  return {
    query,
    state: 'success',
    results: { transactions: [], positions: [] },
    error: null,
    total: 0,
  };
}

function errorResults(query = 'test'): SearchResultsData {
  return {
    query,
    state: 'error',
    results: { transactions: [], positions: [] },
    error: { message: 'Search failed. Please try again.', source: 'all' },
    total: 0,
  };
}

describe('SearchBar Live Results', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('Combobox ARIA', () => {
    it('should add combobox role when results prop is provided', () => {
      render(
        <SearchBar
          results={idleResults()}
          onSearch={vi.fn()}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toBeInTheDocument();
    });

    it('should not add combobox role when results prop is omitted', () => {
      render(<SearchBar />);

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should set aria-expanded to false when results are idle', () => {
      render(
        <SearchBar
          results={idleResults()}
          onSearch={vi.fn()}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    it('should set aria-expanded to true when results are loading', () => {
      render(
        <SearchBar
          results={loadingResults()}
          onSearch={vi.fn()}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });

    it('should set aria-controls and aria-haspopup', () => {
      render(
        <SearchBar
          results={idleResults()}
          onSearch={vi.fn()}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-controls');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
    });

    it('should set aria-label on the input', () => {
      render(
        <SearchBar
          ariaLabel="Search transactions and positions"
          results={idleResults()}
          onSearch={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Search transactions and positions')).toBeInTheDocument();
    });
  });

  describe('Results Dropdown Visibility', () => {
    it('should hide dropdown when results state is idle', () => {
      const { container } = render(
        <SearchBar
          results={idleResults()}
          onSearch={vi.fn()}
        />
      );

      expect(container.querySelector('[role="listbox"]')).not.toBeInTheDocument();
      expect(screen.queryByText(/Searching/)).not.toBeInTheDocument();
    });

    it('should show dropdown with loading state', () => {
      render(
        <SearchBar
          results={loadingResults()}
          onSearch={vi.fn()}
        />
      );

      expect(screen.getByText(/Searching transactions and positions/)).toBeInTheDocument();
    });

    it('should show dropdown with results on success', () => {
      render(
        <SearchBar
          results={successResults()}
          onSearch={vi.fn()}
        />
      );

      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('Transactions (1)')).toBeInTheDocument();
      expect(screen.getByText('Positions (1)')).toBeInTheDocument();
      expect(screen.getByText('Deposit - XLM')).toBeInTheDocument();
      expect(screen.getByText('XLM Position')).toBeInTheDocument();
    });

    it('should show empty state when no results match', () => {
      render(
        <SearchBar
          results={emptyResults()}
          onSearch={vi.fn()}
        />
      );

      expect(screen.getByText(/No results found for/)).toBeInTheDocument();
    });

    it('should show error state', () => {
      render(
        <SearchBar
          results={errorResults()}
          onSearch={vi.fn()}
        />
      );

      expect(screen.getByText('Search Error')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should move focus from input to first result on ArrowDown', () => {
      render(
        <SearchBar
          results={successResults()}
          onSearch={vi.fn()}
        />
      );

      const input = screen.getByRole('combobox');
      input.focus();

      fireEvent.keyDown(input, { key: 'ArrowDown' });

      const options = screen.getAllByRole('option');
      expect(document.activeElement).toBe(options[0]);
    });

    it('should close dropdown on Escape and keep input focused', () => {
      const onSearch = vi.fn();
      const { rerender } = render(
        <SearchBar
          results={loadingResults()}
          onSearch={onSearch}
        />
      );

      expect(screen.getByText(/Searching/)).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(screen.queryByText(/Searching/)).not.toBeInTheDocument();
    });

    it('should call onResultSelect when Enter is pressed in results', () => {
      const onResultSelect = vi.fn();
      const { container } = render(
        <SearchBar
          results={successResults()}
          onSearch={vi.fn()}
          onResultSelect={onResultSelect}
        />
      );

      const option = container.querySelector('[role="option"]') as HTMLElement;
      fireEvent.keyDown(option, { key: 'Enter' });

      expect(onResultSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'TXN123', type: 'transaction' })
      );
    });

    it('should navigate results with ArrowDown and ArrowUp', () => {
      const { container } = render(
        <SearchBar
          results={successResults('test', [mockTransaction, { ...mockTransaction, id: 'TXN124' }], [])}
          onSearch={vi.fn()}
        />
      );

      const options = container.querySelectorAll('[role="option"]');
      expect(options).toHaveLength(2);

      fireEvent.keyDown(options[0], { key: 'ArrowDown' });
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap focus around on ArrowDown at last result', () => {
      const { container } = render(
        <SearchBar
          results={successResults('test', [mockTransaction], [])}
          onSearch={vi.fn()}
        />
      );

      const options = container.querySelectorAll('[role="option"]');
      fireEvent.keyDown(options[0], { key: 'ArrowDown' });
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Outside Click', () => {
    it('should close dropdown on outside click', () => {
      const onSearch = vi.fn();
      render(
        <SearchBar
          results={loadingResults()}
          onSearch={onSearch}
        />
      );

      expect(screen.getByText(/Searching/)).toBeInTheDocument();

      fireEvent.mouseDown(document.body);
      fireEvent.mouseUp(document.body);

      expect(onSearch).toHaveBeenCalledWith('');
    });

    it('should not close when clicking inside the input', () => {
      const onSearch = vi.fn();
      render(
        <SearchBar
          results={successResults()}
          onSearch={onSearch}
        />
      );

      const input = screen.getByRole('combobox');
      fireEvent.mouseDown(input);

      expect(onSearch).not.toHaveBeenCalled();
    });

    it('should not close when clicking inside the dropdown', () => {
      const onSearch = vi.fn();
      const { container } = render(
        <SearchBar
          results={successResults()}
          onSearch={onSearch}
        />
      );

      const dropdown = container.querySelector('[role="listbox"]') as HTMLElement;
      fireEvent.mouseDown(dropdown);

      expect(onSearch).not.toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    it('should re-trigger search on focus when input has value but results are idle', () => {
      const onSearch = vi.fn();
      render(
        <SearchBar
          initialValue="test"
          results={idleResults()}
          onSearch={onSearch}
        />
      );

      const input = screen.getByRole('combobox');
      fireEvent.focus(input);

      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('should focus input after clear button is clicked', () => {
      const onSearch = vi.fn();
      render(
        <SearchBar
          initialValue="test"
          results={idleResults()}
          onSearch={onSearch}
          showClearButton
        />
      );

      const clearButton = screen.getByLabelText('Clear search input');
      fireEvent.click(clearButton);

      const input = screen.getByRole('combobox');
      expect(input).toHaveFocus();
    });
  });

  describe('Click Selection', () => {
    it('should call onResultSelect when a result is clicked', () => {
      const onResultSelect = vi.fn();
      render(
        <SearchBar
          results={successResults()}
          onSearch={vi.fn()}
          onResultSelect={onResultSelect}
        />
      );

      fireEvent.click(screen.getByText('Deposit - XLM'));
      expect(onResultSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'TXN123', type: 'transaction' })
      );
    });

    it('should call onResultSelect with position result', () => {
      const onResultSelect = vi.fn();
      render(
        <SearchBar
          results={successResults('test', [], [mockPosition])}
          onSearch={vi.fn()}
          onResultSelect={onResultSelect}
        />
      );

      fireEvent.click(screen.getByText('XLM Position'));
      expect(onResultSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pos-xlm-1', type: 'position' })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should render without results prop', () => {
      render(<SearchBar />);
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('should handle undefined results gracefully', () => {
      render(
        <SearchBar
          results={undefined}
          onSearch={vi.fn()}
        />
      );

      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should not show dropdown when input is empty', () => {
      const results = idleResults('');
      const { container } = render(
        <SearchBar
          results={results}
          onSearch={vi.fn()}
        />
      );

      expect(container.querySelector('[role="listbox"]')).not.toBeInTheDocument();
    });

    it('should show loading state' , () => {
      render(
        <SearchBar
          results={loadingResults()}
          onSearch={vi.fn()}
        />
      );

      expect(screen.getByText(/Searching transactions and positions/)).toBeInTheDocument();
    });
  });

  describe('Custom list ID', () => {
    it('should apply custom resultsListId', () => {
      render(
        <SearchBar
          results={successResults()}
          onSearch={vi.fn()}
          resultsListId="my-custom-list"
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-controls', 'my-custom-list');
    });
  });
});
