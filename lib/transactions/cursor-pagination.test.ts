import { describe, it, expect } from 'vitest';
import {
  paginateTransactionsByCursor,
  type CursorPaginationOptions,
} from './cursor-pagination';
import { encodeTransactionCursor } from '@/lib/api/cursor';

interface TestTransaction {
  id: string;
  date: string;
  amount: number;
}

function tx(id: string, date: string): TestTransaction {
  return { id, date, amount: 0 };
}

function makeOptions(
  overrides: Partial<CursorPaginationOptions> = {},
): CursorPaginationOptions {
  return {
    cursor: null,
    limit: 6,
    sortDir: 'desc',
    ...overrides,
  };
}

describe('paginateTransactionsByCursor', () => {
  const sample: TestTransaction[] = [
    tx('tx-1', '2025-04-12'),
    tx('tx-2', '2025-04-11'),
    tx('tx-3', '2025-04-10'),
    tx('tx-4', '2025-04-09'),
    tx('tx-5', '2025-04-08'),
    tx('tx-6', '2025-04-07'),
    tx('tx-7', '2025-04-06'),
    tx('tx-8', '2025-04-05'),
  ];

  describe('first page (no cursor)', () => {
    it('returns the first `limit` items in sort order', () => {
      const result = paginateTransactionsByCursor(sample, makeOptions());
      expect(result.transactions).toHaveLength(6);
      expect(result.transactions[0].id).toBe('tx-1');
      expect(result.transactions[5].id).toBe('tx-6');
    });

    it('sets nextCursor when there are more items', () => {
      const result = paginateTransactionsByCursor(sample, makeOptions());
      expect(result.nextCursor).not.toBeNull();
    });

    it('sets prevCursor to null on the first page', () => {
      const result = paginateTransactionsByCursor(sample, makeOptions());
      expect(result.prevCursor).toBeNull();
    });
  });

  describe('next page (cursor.direction=next)', () => {
    it('returns the next page after the cursor position', () => {
      const cursor = encodeTransactionCursor({
        v: 1,
        date: '2025-04-07',
        id: 'tx-6',
        direction: 'next',
      });

      const result = paginateTransactionsByCursor(
        sample,
        makeOptions({ cursor: { v: 1, date: '2025-04-07', id: 'tx-6', direction: 'next' } }),
      );

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].id).toBe('tx-7');
      expect(result.transactions[1].id).toBe('tx-8');
    });

    it('sets nextCursor to null on the last page', () => {
      const result = paginateTransactionsByCursor(
        sample,
        makeOptions({ cursor: { v: 1, date: '2025-04-07', id: 'tx-6', direction: 'next' } }),
      );
      expect(result.nextCursor).toBeNull();
    });

    it('sets prevCursor when there are items before', () => {
      const result = paginateTransactionsByCursor(
        sample,
        makeOptions({ cursor: { v: 1, date: '2025-04-07', id: 'tx-6', direction: 'next' } }),
      );
      expect(result.prevCursor).not.toBeNull();
    });
  });

  describe('previous page (cursor.direction=prev)', () => {
    it('returns items before the cursor position', () => {
      const result = paginateTransactionsByCursor(
        sample,
        makeOptions({ cursor: { v: 1, date: '2025-04-07', id: 'tx-6', direction: 'prev' } }),
      );

      expect(result.transactions).toHaveLength(6);
      expect(result.transactions[0].id).toBe('tx-1');
      expect(result.transactions[5].id).toBe('tx-6');
    });

    it('sets nextCursor when there are items after', () => {
      const result = paginateTransactionsByCursor(
        sample,
        makeOptions({ cursor: { v: 1, date: '2025-04-07', id: 'tx-6', direction: 'prev' } }),
      );
      expect(result.nextCursor).not.toBeNull();
    });
  });

  describe('empty dataset', () => {
    it('returns empty transactions and null cursors', () => {
      const result = paginateTransactionsByCursor([], makeOptions());
      expect(result.transactions).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
      expect(result.prevCursor).toBeNull();
    });
  });

  describe('ascending sort order', () => {
    it('sorts and paginates in ascending order', () => {
      const result = paginateTransactionsByCursor(
        sample,
        makeOptions({ sortDir: 'asc' }),
      );
      expect(result.transactions[0].id).toBe('tx-8');
      expect(result.transactions[5].id).toBe('tx-3');
    });
  });

  describe('unsorted input', () => {
    it('sorts the input when it is not already sorted', () => {
      const unsorted = [tx('tx-c', '2025-04-10'), tx('tx-a', '2025-04-12'), tx('tx-b', '2025-04-11')];
      const result = paginateTransactionsByCursor(unsorted, makeOptions({ limit: 10 }));
      expect(result.transactions.map((t) => t.id)).toEqual(['tx-a', 'tx-b', 'tx-c']);
    });
  });

  describe('limit edge cases', () => {
    it('handles limit larger than dataset', () => {
      const result = paginateTransactionsByCursor(sample, makeOptions({ limit: 100 }));
      expect(result.transactions).toHaveLength(8);
      expect(result.nextCursor).toBeNull();
    });

    it('handles limit of 1', () => {
      const result = paginateTransactionsByCursor(sample, makeOptions({ limit: 1 }));
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].id).toBe('tx-1');
    });
  });
});
