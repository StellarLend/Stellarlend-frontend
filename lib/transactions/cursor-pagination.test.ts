import { describe, it, expect } from 'vitest';
import { paginateTransactionsByCursor } from './cursor-pagination';
import { decodeTransactionCursor, encodeTransactionCursor } from '@/lib/api/cursor';

interface TestTx {
  id: string;
  date: string;
  amount: number;
}

const mockTxns: TestTx[] = [
  { id: 'tx-1', date: '2025-01-01T00:00:00Z', amount: 100 },
  { id: 'tx-2', date: '2025-01-02T00:00:00Z', amount: 200 },
  { id: 'tx-3', date: '2025-01-03T00:00:00Z', amount: 300 },
  { id: 'tx-4', date: '2025-01-04T00:00:00Z', amount: 400 },
  { id: 'tx-5', date: '2025-01-05T00:00:00Z', amount: 500 },
];

describe('paginateTransactionsByCursor', () => {
  describe('Initial Page (no cursor)', () => {
    it('returns first page for ascending sort order', () => {
      const result = paginateTransactionsByCursor(mockTxns, {
        cursor: null,
        limit: 2,
        sortDir: 'asc',
      });

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions.map((t) => t.id)).toEqual(['tx-1', 'tx-2']);
      expect(result.prevCursor).toBeNull();

      expect(result.nextCursor).not.toBeNull();
      const decodedNext = decodeTransactionCursor(result.nextCursor!);
      expect(decodedNext).toEqual({
        v: 1,
        date: '2025-01-02T00:00:00Z',
        id: 'tx-2',
        direction: 'next',
      });
    });

    it('returns first page for descending sort order', () => {
      const result = paginateTransactionsByCursor(mockTxns, {
        cursor: null,
        limit: 2,
        sortDir: 'desc',
      });

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions.map((t) => t.id)).toEqual(['tx-5', 'tx-4']);
      expect(result.prevCursor).toBeNull();

      expect(result.nextCursor).not.toBeNull();
      const decodedNext = decodeTransactionCursor(result.nextCursor!);
      expect(decodedNext).toEqual({
        v: 1,
        date: '2025-01-04T00:00:00Z',
        id: 'tx-4',
        direction: 'next',
      });
    });
  });

  describe('Forward Navigation (next direction)', () => {
    it('paginates forward through dataset in ascending order', () => {
      const cursor1 = decodeTransactionCursor(
        encodeTransactionCursor({ v: 1, date: '2025-01-02T00:00:00Z', id: 'tx-2', direction: 'next' }),
      );

      const page2 = paginateTransactionsByCursor(mockTxns, {
        cursor: cursor1,
        limit: 2,
        sortDir: 'asc',
      });

      expect(page2.transactions.map((t) => t.id)).toEqual(['tx-3', 'tx-4']);
      expect(page2.prevCursor).not.toBeNull();
      expect(decodeTransactionCursor(page2.prevCursor!)).toEqual({
        v: 1,
        date: '2025-01-03T00:00:00Z',
        id: 'tx-3',
        direction: 'prev',
      });

      expect(page2.nextCursor).not.toBeNull();
      expect(decodeTransactionCursor(page2.nextCursor!)).toEqual({
        v: 1,
        date: '2025-01-04T00:00:00Z',
        id: 'tx-4',
        direction: 'next',
      });
    });

    it('handles last page boundary when next page is partially filled', () => {
      const cursor2 = decodeTransactionCursor(
        encodeTransactionCursor({ v: 1, date: '2025-01-04T00:00:00Z', id: 'tx-4', direction: 'next' }),
      );

      const page3 = paginateTransactionsByCursor(mockTxns, {
        cursor: cursor2,
        limit: 2,
        sortDir: 'asc',
      });

      expect(page3.transactions.map((t) => t.id)).toEqual(['tx-5']);
      expect(page3.nextCursor).toBeNull();
      expect(page3.prevCursor).not.toBeNull();
      expect(decodeTransactionCursor(page3.prevCursor!)).toEqual({
        v: 1,
        date: '2025-01-05T00:00:00Z',
        id: 'tx-5',
        direction: 'prev',
      });
    });
  });

  describe('Backward Navigation (prev direction)', () => {
    it('paginates backward from a middle cursor', () => {
      const prevCursor = decodeTransactionCursor(
        encodeTransactionCursor({ v: 1, date: '2025-01-05T00:00:00Z', id: 'tx-5', direction: 'prev' }),
      );

      const page = paginateTransactionsByCursor(mockTxns, {
        cursor: prevCursor,
        limit: 2,
        sortDir: 'asc',
      });

      expect(page.transactions.map((t) => t.id)).toEqual(['tx-3', 'tx-4']);
      expect(page.nextCursor).not.toBeNull();
      expect(decodeTransactionCursor(page.nextCursor!)).toEqual({
        v: 1,
        date: '2025-01-04T00:00:00Z',
        id: 'tx-4',
        direction: 'next',
      });
    });

    it('reaches the first page when navigating backward and sets prevCursor to null', () => {
      const prevCursor = decodeTransactionCursor(
        encodeTransactionCursor({ v: 1, date: '2025-01-03T00:00:00Z', id: 'tx-3', direction: 'prev' }),
      );

      const page = paginateTransactionsByCursor(mockTxns, {
        cursor: prevCursor,
        limit: 2,
        sortDir: 'asc',
      });

      expect(page.transactions.map((t) => t.id)).toEqual(['tx-1', 'tx-2']);
      expect(page.prevCursor).toBeNull();
      expect(page.nextCursor).not.toBeNull();
    });
  });

  describe('Edge Cases & Secondary Sorting', () => {
    it('handles empty transaction list', () => {
      const result = paginateTransactionsByCursor([], {
        cursor: null,
        limit: 5,
        sortDir: 'asc',
      });

      expect(result.transactions).toEqual([]);
      expect(result.nextCursor).toBeNull();
      expect(result.prevCursor).toBeNull();
    });

    it('handles dataset smaller than limit', () => {
      const result = paginateTransactionsByCursor(mockTxns.slice(0, 2), {
        cursor: null,
        limit: 10,
        sortDir: 'asc',
      });

      expect(result.transactions).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
      expect(result.prevCursor).toBeNull();
    });

    it('breaks ties using secondary sort on id when dates are identical', () => {
      const sameDateTxns: TestTx[] = [
        { id: 'tx-b', date: '2025-01-01T00:00:00Z', amount: 10 },
        { id: 'tx-a', date: '2025-01-01T00:00:00Z', amount: 20 },
        { id: 'tx-c', date: '2025-01-01T00:00:00Z', amount: 30 },
      ];

      const result = paginateTransactionsByCursor(sameDateTxns, {
        cursor: null,
        limit: 2,
        sortDir: 'asc',
      });

      expect(result.transactions.map((t) => t.id)).toEqual(['tx-a', 'tx-b']);

      const cursor = decodeTransactionCursor(result.nextCursor!);
      const page2 = paginateTransactionsByCursor(sameDateTxns, {
        cursor,
        limit: 2,
        sortDir: 'asc',
      });

      expect(page2.transactions.map((t) => t.id)).toEqual(['tx-c']);
    });

    it('produces identical result whether input array is pre-sorted or unsorted', () => {
      const unsorted = [...mockTxns].reverse();

      const sortedResult = paginateTransactionsByCursor(mockTxns, {
        cursor: null,
        limit: 3,
        sortDir: 'asc',
      });

      const unsortedResult = paginateTransactionsByCursor(unsorted, {
        cursor: null,
        limit: 3,
        sortDir: 'asc',
      });

      expect(sortedResult).toEqual(unsortedResult);
    });
  });
});
