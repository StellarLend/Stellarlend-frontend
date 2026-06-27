import { describe, it, expect } from 'vitest';

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
  });
});

