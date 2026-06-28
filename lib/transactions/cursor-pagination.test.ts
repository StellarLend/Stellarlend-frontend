<<<<<<< HEAD
import { describe, expect, it } from 'vitest';
import { paginateTransactionsByCursor } from './cursor-pagination';
import { encodeTransactionCursor, type TransactionCursor } from '@/lib/api/cursor';

type Tx = { date: string; id: string };

function cursor(partial: Omit<TransactionCursor, 'v'>): string {
  return encodeTransactionCursor({ v: 1, ...partial });
}

describe('paginateTransactionsByCursor - keyset paging boundaries', () => {
  const txs: Tx[] = [
    { date: '2025-01-01', id: 'B' },
    { date: '2025-01-01', id: 'A' },
    { date: '2025-01-02', id: 'A' },
    { date: '2025-01-02', id: 'B' },
    { date: '2025-01-03', id: 'A' },
  ];

  it('no cursor: returns first page in sortDir order + sets only nextCursor when more pages exist', () => {
    const result = paginateTransactionsByCursor(txs, {
      cursor: null,
      limit: 2,
      sortDir: 'asc',
    });

    // asc order by (date,id):
    // 2025-01-01 A, 2025-01-01 B, 2025-01-02 A, 2025-01-02 B, 2025-01-03 A
    expect(result.transactions.map((t) => t.id)).toEqual(['A', 'B']);
    expect(result.nextCursor).not.toBeNull();
    expect(result.prevCursor).toBeNull();
  });

  it('next cursor is exclusive (direction=next does not include cursor-key)', () => {
    const orderedPage1 = paginateTransactionsByCursor(txs, {
      cursor: null,
      limit: 2,
      sortDir: 'asc',
    });

    // cursor at the LAST element of page1: (2025-01-01,B)
    const lastOfPage1 = orderedPage1.transactions.at(-1)!;
    const nextPageCursor = cursor({
      date: lastOfPage1.date,
      id: lastOfPage1.id,
      direction: 'next',
    });

    const result = paginateTransactionsByCursor(txs, {
      cursor: encodeTransactionCursor({
        v: 1,
        date: lastOfPage1.date,
        id: lastOfPage1.id,
        direction: 'next',
      }) as any,
      // (above cast is unnecessary logically; kept to ensure shape)
      limit: 2,
      sortDir: 'asc',
    });

    // Items strictly greater than (2025-01-01,B):
    // 2025-01-02 A, 2025-01-02 B
    expect(result.transactions.map((t) => t.id)).toEqual(['A', 'B']);
    expect(result.prevCursor).not.toBeNull();

    // Ensure cursor-key element is excluded
    expect(result.transactions.some((t) => t.date === lastOfPage1.date && t.id === lastOfPage1.id)).toBe(false);

    // Also ensure nextCursor is present because there is still one later item
    expect(result.nextCursor).not.toBeNull();
  });

  it('prev cursor is exclusive (direction=prev does not include cursor-key)', () => {
    // Page1 (asc, limit=3) => 2025-01-01 A, 2025-01-01 B, 2025-01-02 A
    const page1 = paginateTransactionsByCursor(txs, {
      cursor: null,
      limit: 3,
      sortDir: 'asc',
    });

    // Make cursor at the FIRST element of page1: (2025-01-01,A)
    // prev page should include items strictly less than that key.
    const firstOfPage1 = page1.transactions[0]!;
    const prevCursorStr = cursor({
      date: firstOfPage1.date,
      id: firstOfPage1.id,
      direction: 'prev',
    });

    const result = paginateTransactionsByCursor(txs, {
      cursor: (encodeTransactionCursor({
        v: 1,
        date: firstOfPage1.date,
        id: firstOfPage1.id,
        direction: 'prev',
      }) as unknown) as any,
      limit: 2,
      sortDir: 'asc',
    });

    // Since (2025-01-01,A) is the very first in asc order, prev page should be empty.
    expect(result.transactions).toHaveLength(0);
    expect(result.prevCursor).toBeNull();
    expect(result.nextCursor).toBeNull();

    // Sanity: cursor-string must be decodable (compile-time only)
    expect(prevCursorStr).toEqual(expect.any(String));
  });

  it('equal-date tie-break by id: splits correctly when ids differ but dates match', () => {
    // asc order for date 2025-01-01: A then B
    const resultAThenB = paginateTransactionsByCursor(txs, {
      cursor: null,
      limit: 2,
      sortDir: 'asc',
    });
    expect(resultAThenB.transactions.map((t) => t.id)).toEqual(['A', 'B']);

    // Cursor at (2025-01-01,A) for next should start after A i.e. include B as first
    const c = cursor({ date: '2025-01-01', id: 'A', direction: 'next' });
    const cursorObj = JSON.parse(Buffer.from(c, 'base64url').toString('utf8')) as TransactionCursor;

    const nextFromA = paginateTransactionsByCursor(txs, {
      cursor: cursorObj,
      limit: 2,
      sortDir: 'asc',
    });

    expect(nextFromA.transactions[0]).toMatchObject({ date: '2025-01-01', id: 'B' });
  });

  it('boundary cursor nullability: nextCursor null when on final page; prevCursor null when on first page', () => {
    const ascLastPage = paginateTransactionsByCursor(txs, {
      cursor: null,
=======
import { describe, it, expect } from 'vitest';

<<<<<<< HEAD
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
>>>>>>> 5edde4e6367006c4e7e831ed931c0c85e413f173
      limit: 10,
      sortDir: 'asc',
    });

<<<<<<< HEAD
    // With limit bigger than dataset, we are effectively on the last page.
    expect(ascLastPage.transactions).toHaveLength(txs.length);
    expect(ascLastPage.nextCursor).toBeNull();
    expect(ascLastPage.prevCursor).toBeNull();
=======
    // strictly greater => ('c') only (since 'aa' < 'b', 'b' itself excluded)
    expect(result.transactions.map((t) => t.id)).toEqual(['c']);

    const decodedNext = decodeTransactionCursor(result.nextCursor!);
    expect(decodedNext).toEqual({ v: 1, date: d, id: 'c', direction: 'next' });
=======
import { encodeTransactionCursor } from '../api/cursor';

import { paginateTransactionsByCursor } from './cursor-pagination';

type T = { date: string; id: string };

function c(date: string, id: string, direction: 'next' | 'prev') {
  return encodeTransactionCursor({ v: 1, date, id, direction });
}

describe('paginateTransactionsByCursor - keyset boundary behavior', () => {
  const txs: Array<T & { date: string; id: string }> = [
    { id: 'A', date: '2025-01-01' },
    { id: 'B', date: '2025-01-01' }, // same date, tie-break by id
    { id: 'C', date: '2025-01-02' },
    { id: 'D', date: '2025-01-03' },
    { id: 'E', date: '2025-01-04' },
  ];

  it('ASC: no cursor returns first page and cursors are consistent (no prev on first page)', () => {
    const res = paginateTransactionsByCursor(txs, { cursor: null, limit: 2, sortDir: 'asc' });

    expect(res.transactions.map((t) => t.id)).toEqual(['A', 'B']);
    expect(res.prevCursor).toBeNull();

    // next cursor should point to the last item in page (strictly after it for next request)
    const next = res.nextCursor;
    expect(next).not.toBeNull();
    expect(next).toEqual(c('2025-01-01', 'B', 'next'));
  });

  it('ASC + next cursor: does NOT include the cursor key itself (strictly greater)', () => {
    // Cursor is the 2nd item of the first page
    const cursor = c('2025-01-01', 'B', 'next');
    const res = paginateTransactionsByCursor(txs, { cursor, limit: 2, sortDir: 'asc' });

    expect(res.transactions.map((t) => t.id)).toEqual(['C', 'D']);
    expect(res.prevCursor).toEqual(c('2025-01-02', 'C', 'prev'));
    expect(res.nextCursor).toEqual(c('2025-01-03', 'D', 'next'));
  });

  it('ASC + prev cursor boundary: returns items strictly before cursor key', () => {
    const cursor = c('2025-01-03', 'D', 'prev');
    const res = paginateTransactionsByCursor(txs, { cursor, limit: 2, sortDir: 'asc' });

    // strictly before (D): C,B
    expect(res.transactions.map((t) => t.id)).toEqual(['B', 'C']);
    expect(res.nextCursor).toEqual(c('2025-01-02', 'C', 'next'));
    expect(res.prevCursor).toEqual(c('2025-01-01', 'B', 'prev'));
  });

  it('ASC + prev cursor at start edge: prevCursor should be null when there is nothing before first item in page', () => {
    // Pick the first key; requesting prev from it should still produce an empty page
    // but function returns last(limit) of items < cursor, which is empty.
    const cursor = c('2025-01-01', 'A', 'prev');
    const res = paginateTransactionsByCursor(txs, { cursor, limit: 2, sortDir: 'asc' });

    expect(res.transactions).toEqual([]);
    expect(res.nextCursor).toBeNull();
    expect(res.prevCursor).toBeNull();
  });

  it('DESC: no cursor returns last page keys and cursors are consistent (no next on last page)', () => {
    const res = paginateTransactionsByCursor(txs, { cursor: null, limit: 2, sortDir: 'desc' });

    // desc order by (date desc, id asc tie-break via localeCompare in compareTransactionKey then inverted)
    // Ordered desc should be E, D, C, B, A (with same date tie-break)
    expect(res.transactions.map((t) => t.id)).toEqual(['E', 'D']);
    expect(res.nextCursor).toBeNull();
    expect(res.prevCursor).toEqual(c('2025-01-03', 'D', 'prev'));
  });

  it('DESC + next cursor boundary: next must be strictly greater in DESC ordering (i.e., cursor.key should be excluded)', () => {
    // For DESC, the first page is E,D. The cursor should exclude D when paging next.
    const cursor = c('2025-01-03', 'D', 'next');
    const res = paginateTransactionsByCursor(txs, { cursor, limit: 2, sortDir: 'desc' });

    expect(res.transactions.map((t) => t.id)).toEqual(['C', 'B']);
    expect(res.nextCursor).toEqual(c('2025-01-01', 'B', 'next'));
    expect(res.prevCursor).toEqual(c('2025-01-02', 'C', 'prev'));
>>>>>>> 0d0096679209a40ff880b05e62816d02444affce
>>>>>>> 5edde4e6367006c4e7e831ed931c0c85e413f173
  });
});

