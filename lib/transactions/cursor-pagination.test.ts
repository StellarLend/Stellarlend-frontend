import { describe, it, expect } from 'vitest';

import { paginateTransactionsByCursor } from './cursor-pagination';
import {
  decodeTransactionCursor,
  type TransactionCursor,
} from '@/lib/api/cursor';

type Tx = { id: string; date: string };

function tx(id: string, date: string): Tx {
  return { id, date };
}

describe('lib/transactions/cursor-pagination - keyset paging boundaries', () => {
  const base = '2025-01-01T00:00:00.000Z';
  const day1 = base; // 2025-01-01
  const day2 = '2025-01-02T00:00:00.000Z';
  const day3 = '2025-01-03T00:00:00.000Z';
  const day4 = '2025-01-04T00:00:00.000Z';

  // Ordered by (date, id) ascending is:
  // A1 (day1), A2 (day1), B1 (day2), B2 (day2), C1 (day3), D1 (day4)
  const transactions: Tx[] = [
    tx('B2', day2),
    tx('A2', day1),
    tx('C1', day3),
    tx('A1', day1),
    tx('D1', day4),
    tx('B1', day2),
  ];

  const limit = 2;

  it('asc: no cursor returns earliest page, sets nextCursor, prevCursor is null', () => {
    const result = paginateTransactionsByCursor(transactions, {
      cursor: null,
      limit,
      sortDir: 'asc',
    });

    expect(result.transactions.map((t) => t.id)).toEqual(['A1', 'A2']);

    expect(result.prevCursor).toBeNull();

    expect(result.nextCursor).not.toBeNull();
    const decoded = decodeTransactionCursor(result.nextCursor!);
    const expected: TransactionCursor = {
      v: 1,
      date: day1,
      id: 'A2',
      direction: 'next',
    };

    expect(decoded).toEqual(expected);
  });

  it('desc: no cursor returns latest page, sets prevCursor, nextCursor is null', () => {
    const result = paginateTransactionsByCursor(transactions, {
      cursor: null,
      limit,
      sortDir: 'desc',
    });

    // desc order is D1, C1, B1, B2, A1, A2
    expect(result.transactions.map((t) => t.id)).toEqual(['D1', 'C1']);

    expect(result.nextCursor).toBeNull();

    expect(result.prevCursor).not.toBeNull();
    const decoded = decodeTransactionCursor(result.prevCursor!);
    const expected: TransactionCursor = {
      v: 1,
      date: day3,
      id: 'C1',
      direction: 'prev',
    };

    expect(decoded).toEqual(expected);
  });

  it("asc: cursor.direction='next' at middle key returns items strictly greater (date,id)", () => {
    // Cursor at (day2, B1) with direction 'next' should return keys > (day2,B1)
    // In asc order, keys after B1: B2, C1, D1. With limit=2 => B2, C1
    const cursor: TransactionCursor = {
      v: 1,
      date: day2,
      id: 'B1',
      direction: 'next',
    };

    const result = paginateTransactionsByCursor(transactions, {
      cursor,
      limit,
      sortDir: 'asc',
    });

    expect(result.transactions.map((t) => t.id)).toEqual(['B2', 'C1']);

    expect(result.prevCursor).not.toBeNull();
    expect(decodeTransactionCursor(result.prevCursor!).direction).toBe('prev');

    expect(result.nextCursor).not.toBeNull();
    const decodedNext = decodeTransactionCursor(result.nextCursor!);
    expect(decodedNext).toEqual({ v: 1, date: day3, id: 'C1', direction: 'next' });
  });

  it("asc: cursor.direction='next' at last key returns empty page and null cursors", () => {
    const cursor: TransactionCursor = {
      v: 1,
      date: day4,
      id: 'D1',
      direction: 'next',
    };

    const result = paginateTransactionsByCursor(transactions, {
      cursor,
      limit,
      sortDir: 'asc',
    });

    expect(result.transactions).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(result.prevCursor).toBeNull();
  });

  it("asc: cursor.direction='prev' at middle key returns items strictly less (and uses 'last limit')", () => {
    // Cursor at (day2, B2) with direction 'prev' should return keys < (day2,B2)
    // i.e. A1, A2, B1. With limit=2, take the last 2 => A2, B1
    const cursor: TransactionCursor = {
      v: 1,
      date: day2,
      id: 'B2',
      direction: 'prev',
    };

    const result = paginateTransactionsByCursor(transactions, {
      cursor,
      limit,
      sortDir: 'asc',
    });

    expect(result.transactions.map((t) => t.id)).toEqual(['A2', 'B1']);

    const decodedPrev = decodeTransactionCursor(result.prevCursor!);
    expect(decodedPrev).toEqual({ v: 1, date: day1, id: 'A2', direction: 'prev' });

    const decodedNext = decodeTransactionCursor(result.nextCursor!);
    expect(decodedNext).toEqual({ v: 1, date: day2, id: 'B1', direction: 'next' });
  });

  it("asc: cursor.direction='prev' at first key returns empty page and null cursors", () => {
    const cursor: TransactionCursor = {
      v: 1,
      date: day1,
      id: 'A1',
      direction: 'prev',
    };

    const result = paginateTransactionsByCursor(transactions, {
      cursor,
      limit,
      sortDir: 'asc',
    });

    expect(result.transactions).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(result.prevCursor).toBeNull();
  });

  it('same date tie-breaking: cursor at (same date, id="b") with next is strictly after by id', () => {
    // Same date: 2025-01-10
    const d = '2025-01-10T00:00:00.000Z';
    const tied: Tx[] = [tx('a', d), tx('b', d), tx('c', d), tx('aa', d)];
    // Asc order by id: 'a', 'aa', 'b', 'c'

    const cursor: TransactionCursor = {
      v: 1,
      date: d,
      id: 'b',
      direction: 'next',
    };

    const result = paginateTransactionsByCursor(tied, {
      cursor,
      limit: 10,
      sortDir: 'asc',
    });

    // strictly greater => ('c') only (since 'aa' < 'b', 'b' itself excluded)
    expect(result.transactions.map((t) => t.id)).toEqual(['c']);

    const decodedNext = decodeTransactionCursor(result.nextCursor!);
    expect(decodedNext).toEqual({ v: 1, date: d, id: 'c', direction: 'next' });
  });
});

