import { describe, it, expect } from 'vitest';
import { fetchTransactions, filterTransactions } from './repository';

describe('fetchTransactions', () => {
  it('returns a non-empty array of transactions', async () => {
    const txns = await fetchTransactions();
    expect(txns.length).toBeGreaterThan(0);
  });

  it('returns transactions with required fields', async () => {
    const txns = await fetchTransactions();
    for (const txn of txns) {
      expect(txn).toHaveProperty('id');
      expect(txn).toHaveProperty('type');
      expect(txn).toHaveProperty('amount');
      expect(txn).toHaveProperty('asset');
      expect(txn).toHaveProperty('date');
      expect(txn).toHaveProperty('time');
      expect(txn).toHaveProperty('status');
    }
  });
});

describe('filterTransactions', () => {
  const txns = [
    { id: 'TXN001', type: 'Deposit',    amount: 1000,  asset: 'XLM'  as const, date: '2025-04-01', time: '10:00AM', status: 'Completed'  as const },
    { id: 'TXN002', type: 'Withdrawal', amount: -500,  asset: 'BTC'  as const, date: '2025-03-15', time: '11:00AM', status: 'Processing' as const },
    { id: 'TXN003', type: 'Deposit',    amount: 2000,  asset: 'STRK' as const, date: '2025-02-10', time: '09:00AM', status: 'Failed'     as const },
    { id: 'TXN004', type: 'Loan Pay',   amount: -100,  asset: 'XLM'  as const, date: '2025-01-20', time: '08:00AM', status: 'Completed'  as const },
  ];

  it('returns all transactions with no filters', () => {
    expect(filterTransactions(txns, {})).toHaveLength(4);
  });

  it('filters by search on type (case-insensitive)', () => {
    const result = filterTransactions(txns, { search: 'deposit' });
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.type === 'Deposit')).toBe(true);
  });

  it('filters by search on asset', () => {
    const result = filterTransactions(txns, { search: 'BTC' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('TXN002');
  });

  it('filters by search on transaction id', () => {
    const result = filterTransactions(txns, { search: 'TXN004' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('TXN004');
  });

  it('filters by search on amount', () => {
    const result = filterTransactions(txns, { search: '2000' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('TXN003');
  });

  it('filters by status Completed', () => {
    const result = filterTransactions(txns, { status: 'Completed' });
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.status === 'Completed')).toBe(true);
  });

  it('returns all when status is All', () => {
    expect(filterTransactions(txns, { status: 'All' })).toHaveLength(4);
  });

  it('filters by dateFrom (inclusive)', () => {
    const result = filterTransactions(txns, { dateFrom: '2025-03-01' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(expect.arrayContaining(['TXN001', 'TXN002']));
  });

  it('filters by dateTo (inclusive)', () => {
    const result = filterTransactions(txns, { dateTo: '2025-02-28' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(expect.arrayContaining(['TXN003', 'TXN004']));
  });

  it('combines search, status, and date filters', () => {
    const result = filterTransactions(txns, {
      search: 'XLM',
      status: 'Completed',
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
    });
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.asset === 'XLM' && t.status === 'Completed')).toBe(true);
  });

  it('returns empty array when no transactions match', () => {
    const result = filterTransactions(txns, { search: 'NONEXISTENT' });
    expect(result).toHaveLength(0);
  });
});
