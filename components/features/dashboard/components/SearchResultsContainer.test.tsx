import React from 'react';
import { render, screen, fireEvent } from '@/test/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SearchResultsContainer from './SearchResultsContainer';
import type { SearchResultsData } from '@/lib/search/types';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockTransaction = {
  id: 'TXN001',
  type: 'transaction' as const,
  title: 'Deposit - XLM',
  subtitle: '500 XLM • 2025-07-01',
  transaction: {
    id: 'TXN001',
    type: 'Deposit' as const,
    amount: 500,
    asset: 'XLM' as const,
    date: '2025-07-01',
    time: '09:00AM',
    status: 'Completed' as const,
  },
};

const mockPosition = {
  id: 'pos-xlm-1',
  type: 'position' as const,
  title: 'XLM Position',
  subtitle: 'Balance: $2,500.00',
  asset: 'XLM',
};

const baseResults: SearchResultsData = {
  query: 'test',
  state: 'idle',
  results: { transactions: [], positions: [] },
  error: null,
  total: 0,
};

describe('SearchResultsContainer', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  describe('Navigation – transaction result', () => {
    it('calls router.push with the transaction detail path when a transaction result is clicked', () => {
      render(
        <SearchResultsContainer
          results={{
            ...baseResults,
            state: 'success',
            results: { transactions: [mockTransaction], positions: [] },
            total: 1,
          }}
          isOpen={true}
        />
      );

      fireEvent.click(screen.getByText('Deposit - XLM'));

      expect(mockPush).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith('/dashboard/transactions/TXN001');
    });
  });

  describe('Navigation – position result', () => {
    it('calls router.push with the position detail path when a position result is clicked', () => {
      render(
        <SearchResultsContainer
          results={{
            ...baseResults,
            state: 'success',
            results: { transactions: [], positions: [mockPosition] },
            total: 1,
          }}
          isOpen={true}
        />
      );

      fireEvent.click(screen.getByText('XLM Position'));

      expect(mockPush).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith('/dashboard/positions/XLM');
    });
  });

  describe('Navigation – keyboard Enter', () => {
    it('calls router.push when a transaction result is selected via Enter key', () => {
      const { container } = render(
        <SearchResultsContainer
          results={{
            ...baseResults,
            state: 'success',
            results: { transactions: [mockTransaction], positions: [] },
            total: 1,
          }}
          isOpen={true}
        />
      );

      const option = container.querySelector('[role="option"]') as HTMLElement;

      // Arrow Down to focus the first item, then Enter to select it
      fireEvent.keyDown(option, { key: 'ArrowDown' });
      fireEvent.keyDown(option, { key: 'Enter' });

      expect(mockPush).toHaveBeenCalledWith('/dashboard/transactions/TXN001');
    });
  });

  describe('Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(
        <SearchResultsContainer results={baseResults} isOpen={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders the results list when isOpen is true', () => {
      render(
        <SearchResultsContainer
          results={{
            ...baseResults,
            state: 'success',
            results: { transactions: [mockTransaction], positions: [] },
            total: 1,
          }}
          isOpen={true}
        />
      );

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('does not call router.push when no result is interacted with', () => {
      render(
        <SearchResultsContainer
          results={{
            ...baseResults,
            state: 'success',
            results: { transactions: [mockTransaction], positions: [] },
            total: 1,
          }}
          isOpen={true}
        />
      );

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Ref forwarding', () => {
    it('forwards a ref to the underlying container div', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <SearchResultsContainer
          ref={ref}
          results={{
            ...baseResults,
            state: 'success',
            results: { transactions: [mockTransaction], positions: [] },
            total: 1,
          }}
          isOpen={true}
        />
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});
