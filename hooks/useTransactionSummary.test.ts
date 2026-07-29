import { renderHook, waitFor } from '@testing-library/react';
import { useTransactionSummary } from './useTransactionSummary';
import { describe, it, expect, vi } from 'vitest';

const { mockFetchTransactions, searchParamsRef } = vi.hoisted(() => ({
  mockFetchTransactions: vi.fn(),
  searchParamsRef: { current: new URLSearchParams('') },
}));

vi.mock('@/types/Transaction', () => ({
  fetchTransactions: (...args: unknown[]) => mockFetchTransactions(...args),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
}));

describe('useTransactionSummary', () => {
  beforeEach(() => {
    mockFetchTransactions.mockReset();
    searchParamsRef.current = new URLSearchParams('');
  });

  it('calls fetchTransactions with filters built from search params', async () => {
    searchParamsRef.current = new URLSearchParams('status=Completed&search=deposit');
    mockFetchTransactions.mockResolvedValue({
      transactions: [
        {
          id: '1',
          amount: 1000,
          type: 'Deposit',
          status: 'Completed',
          date: '2024-01-01',
          time: '00:00',
          asset: 'XLM',
        },
      ],
      total: 1,
    });

    const { result } = renderHook(() => useTransactionSummary());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchTransactions).toHaveBeenCalledWith({
      status: 'Completed',
      search: 'deposit',
    });
  });

  it('computes summary correctly from filtered response', async () => {
    mockFetchTransactions.mockResolvedValue({
      transactions: [
        {
          id: '1',
          amount: 1000,
          type: 'Deposit',
          status: 'Completed',
          date: '2024-01-01',
          time: '00:00',
          asset: 'XLM',
        },
        {
          id: '2',
          amount: -500,
          type: 'Withdrawal',
          status: 'Completed',
          date: '2024-01-02',
          time: '00:00',
          asset: 'XLM',
        },
      ],
      total: 2,
    });

    const { result } = renderHook(() => useTransactionSummary());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.inflow).toBe(1000);
    expect(result.current.outflow).toBe(500);
    expect(result.current.net).toBe(500);
  });

  it('calls fetchTransactions without filters when no search params are present', async () => {
    mockFetchTransactions.mockResolvedValue({
      transactions: [],
      total: 0,
    });

    renderHook(() => useTransactionSummary());

    await waitFor(() => {
      expect(mockFetchTransactions).toHaveBeenCalledWith({});
    });
  });

  it('omits invalid status values from filters', async () => {
    searchParamsRef.current = new URLSearchParams('status=INVALID_STATUS&search=test');
    mockFetchTransactions.mockResolvedValue({
      transactions: [],
      total: 0,
    });

    renderHook(() => useTransactionSummary());

    await waitFor(() => {
      expect(mockFetchTransactions).toHaveBeenCalledWith({ search: 'test' });
    });
  });
});
