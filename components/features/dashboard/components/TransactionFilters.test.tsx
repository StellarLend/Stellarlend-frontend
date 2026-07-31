import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TransactionFilters from './TransactionFilters';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

describe('TransactionFilters', () => {
  let mockReplace: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockReplace = vi.fn();
    (useRouter as any).mockReturnValue({
      replace: mockReplace,
    });
    (usePathname as any).mockReturnValue('/dashboard/transactions');
    (useSearchParams as any).mockReturnValue(new URLSearchParams());
  });

  it('renders correctly with default state', () => {
    render(<TransactionFilters totalCount={0} />);
    
    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/results/i)).toBeInTheDocument();
    
    expect(screen.getByLabelText(/Asset/i)).toHaveValue('');
    expect(screen.getByLabelText(/Type/i)).toHaveValue('');
    expect(screen.getByLabelText(/Status/i)).toHaveValue('');
    expect(screen.getByPlaceholderText('Search IDs or amounts...')).toHaveValue('');
    
    // Clear all button should not be visible when no filters are applied
    expect(screen.queryByText('Clear All')).not.toBeInTheDocument();

    // Date range is announced for assistive tech.
    expect(screen.getByText(/No date range selected/i)).toBeInTheDocument();
  });

  it('restores state from URL params on load', () => {
    (useSearchParams as any).mockReturnValue(new URLSearchParams('?asset=XLM&type=lend&status=Completed&search=123&fromDate=2023-01-01&toDate=2023-12-31'));
    
    render(<TransactionFilters totalCount={5} />);
    
    expect(screen.getByLabelText(/Asset/i)).toHaveValue('XLM');
    expect(screen.getByLabelText(/Type/i)).toHaveValue('lend');
    expect(screen.getByLabelText(/Status/i)).toHaveValue('Completed');
    expect(screen.getByPlaceholderText('Search IDs or amounts...')).toHaveValue('123');
    
    // Date pickers restore state
    expect(screen.getByPlaceholderText('From Date')).toHaveValue('01-01-2023');
    expect(screen.getByPlaceholderText('To Date')).toHaveValue('12-31-2023');
    
    // Clear all should be visible
    expect(screen.getByText('Clear All')).toBeInTheDocument();
    
    // Check result count live region
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('updates URL when asset filter is changed', () => {
    render(<TransactionFilters totalCount={10} />);
    
    const assetSelect = screen.getByLabelText(/Asset/i);
    fireEvent.change(assetSelect, { target: { value: 'BTC' } });
    
    expect(mockReplace).toHaveBeenCalledWith('/dashboard/transactions?asset=BTC', { scroll: false });
  });

  it('updates URL when multiple filters are combined', () => {
    (useSearchParams as any).mockReturnValue(new URLSearchParams('?asset=XLM'));
    
    render(<TransactionFilters totalCount={10} />);
    
    const statusSelect = screen.getByLabelText(/Status/i);
    fireEvent.change(statusSelect, { target: { value: 'Processing' } });
    
    expect(mockReplace).toHaveBeenCalledWith('/dashboard/transactions?asset=XLM&status=Processing', { scroll: false });
  });

  it('clears all filters when Clear All button is clicked', () => {
    (useSearchParams as any).mockReturnValue(new URLSearchParams('?asset=XLM&type=lend'));
    
    render(<TransactionFilters totalCount={2} />);
    
    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);
    
    expect(mockReplace).toHaveBeenCalledWith('/dashboard/transactions', { scroll: false });
    expect(screen.getByLabelText(/Asset/i)).toHaveValue('');
    expect(screen.getByLabelText(/Type/i)).toHaveValue('');
  });

  it('debounces or updates search on blur', () => {
    render(<TransactionFilters totalCount={10} />);
    
    const searchInput = screen.getByPlaceholderText('Search IDs or amounts...');
    fireEvent.change(searchInput, { target: { value: 'TXN123' } });
    
    // Blur triggers search param update
    fireEvent.blur(searchInput);
    
    expect(mockReplace).toHaveBeenCalledWith('/dashboard/transactions?search=TXN123', { scroll: false });
  });

  it('handles Enter key in search to submit', () => {
    render(<TransactionFilters totalCount={10} />);
    
    const searchInput = screen.getByPlaceholderText('Search IDs or amounts...');
    fireEvent.change(searchInput, { target: { value: 'TXN123' } });
    
    // Pressing a non-enter key does not trigger replace
    fireEvent.keyDown(searchInput, { key: 'a', code: 'KeyA' });
    expect(mockReplace).not.toHaveBeenCalled();
    
    // Pressing enter triggers replace
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
    expect(mockReplace).toHaveBeenCalledWith('/dashboard/transactions?search=TXN123', { scroll: false });
  });

  it('removes page param when a filter is changed', () => {
    (useSearchParams as any).mockReturnValue(new URLSearchParams('?page=2&asset=XLM'));
    
    render(<TransactionFilters totalCount={10} />);
    
    const typeSelect = screen.getByLabelText(/Type/i);
    fireEvent.change(typeSelect, { target: { value: 'repay' } });
    
    // page param should be removed
    expect(mockReplace).toHaveBeenCalledWith('/dashboard/transactions?asset=XLM&type=repay', { scroll: false });
  });

  it('re-syncs filter state from URL on external navigation (e.g., browser back button)', async () => {
    // Start with asset=BTC in the URL
    (useSearchParams as any).mockReturnValue(new URLSearchParams('?asset=BTC'));
    const { rerender } = render(<TransactionFilters totalCount={10} />);

    // Verify initial state matches URL
    expect(screen.getByLabelText(/Asset/i)).toHaveValue('BTC');

    // User changes asset to XLM
    fireEvent.change(screen.getByLabelText(/Asset/i), { target: { value: 'XLM' } });

    // Verify URL was updated by the component
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/dashboard/transactions?asset=XLM',
      { scroll: false }
    );

    // Simulate browser back: URL returns to ?asset=BTC
    (useSearchParams as any).mockReturnValue(new URLSearchParams('?asset=BTC'));
    rerender(<TransactionFilters totalCount={10} />);

    // Wait for the re-sync effect to run and verify filter UI shows the restored value
    await waitFor(() => {
      expect(screen.getByLabelText(/Asset/i)).toHaveValue('BTC');
    });
  });

});
