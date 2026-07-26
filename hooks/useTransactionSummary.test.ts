import { renderHook, waitFor } from '@testing-library/react';
import { useTransactionSummary } from './useTransactionSummary';
import { describe, it, expect, vi } from 'vitest';

// Mock the dependencies
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/lib/transactions/repository', () => ({
  fetchTransactions: () => Promise.resolve([
    { amount: 1000, type: 'Deposit', status: 'Completed', id: '1', date: '2024-01-01', time: '00:00', asset: 'XLM' },
    { amount: -500, type: 'Withdrawal', status: 'Completed', id: '2', date: '2024-01-02', time: '00:00', asset: 'XLM' },
  ]),
  filterTransactions: (txs: any[]) => txs, // Mock filter to return all for simplicity
}));

describe('useTransactionSummary', () => {
  it('computes summary correctly', async () => {
    const { result } = renderHook(() => useTransactionSummary());
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.inflow).toBe(1000);
    expect(result.current.outflow).toBe(500);
    expect(result.current.net).toBe(500);
  });
});
