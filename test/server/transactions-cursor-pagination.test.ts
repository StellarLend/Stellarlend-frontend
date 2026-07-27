import { describe, expect, it, vi } from 'vitest';
import { decodeTransactionCursor } from '@/lib/api/cursor';

vi.mock('@/lib/db', () => ({
  db: {},
}));

vi.mock('@/lib/indexer', () => ({
  indexAccountTransactions: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn() },
}));

vi.mock('@/lib/transactions/store', () => ({
  getTransaction: vi.fn(),
}));

import { paginateTransactionsByCursor } from '@/lib/transactions/cursor-pagination';

const transactions = [
  { id: 'txn-a', date: '2025-01-01' },
  { id: 'txn-b', date: '2025-01-01' },
  { id: 'txn-c', date: '2025-01-02' },
  { id: 'txn-d', date: '2025-01-03' },
  { id: 'txn-e', date: '2025-01-03' },
];

describe('paginateTransactionsByCursor', () => {
  it('uses date and id as stable keyset boundaries for forward paging', () => {
    const first = paginateTransactionsByCursor(transactions, {
      cursor: null,
      limit: 2,
      sortDir: 'asc',
    });

    expect(first.transactions.map((transaction) => transaction.id)).toEqual(['txn-a', 'txn-b']);
    expect(first.prevCursor).toBeNull();
    expect(decodeTransactionCursor(first.nextCursor!)).toEqual({
      v: 1,
      date: '2025-01-01',
      id: 'txn-b',
      direction: 'next',
    });

    const second = paginateTransactionsByCursor(transactions, {
      cursor: decodeTransactionCursor(first.nextCursor!),
      limit: 2,
      sortDir: 'asc',
    });

    expect(second.transactions.map((transaction) => transaction.id)).toEqual(['txn-c', 'txn-d']);
    expect(decodeTransactionCursor(second.prevCursor!)).toEqual({
      v: 1,
      date: '2025-01-02',
      id: 'txn-c',
      direction: 'prev',
    });
  });

  it('supports reverse iteration without duplicating boundary rows', () => {
    const first = paginateTransactionsByCursor(transactions, {
      cursor: null,
      limit: 2,
      sortDir: 'asc',
    });
    const second = paginateTransactionsByCursor(transactions, {
      cursor: decodeTransactionCursor(first.nextCursor!),
      limit: 2,
      sortDir: 'asc',
    });

    const previous = paginateTransactionsByCursor(transactions, {
      cursor: decodeTransactionCursor(second.prevCursor!),
      limit: 2,
      sortDir: 'asc',
    });

    expect(previous.transactions.map((transaction) => transaction.id)).toEqual(['txn-a', 'txn-b']);
    expect(previous.prevCursor).toBeNull();
    expect(decodeTransactionCursor(previous.nextCursor!).id).toBe('txn-b');
  });

  it('applies the keyset in descending order', () => {
    const first = paginateTransactionsByCursor(transactions, {
      cursor: null,
      limit: 3,
      sortDir: 'desc',
    });

    expect(first.transactions.map((transaction) => transaction.id)).toEqual(['txn-e', 'txn-d', 'txn-c']);

    const second = paginateTransactionsByCursor(transactions, {
      cursor: decodeTransactionCursor(first.nextCursor!),
      limit: 3,
      sortDir: 'desc',
    });

    expect(second.transactions.map((transaction) => transaction.id)).toEqual(['txn-b', 'txn-a']);
    expect(second.nextCursor).toBeNull();
  });
});
