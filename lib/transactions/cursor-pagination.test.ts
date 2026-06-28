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
      limit: 10,
      sortDir: 'asc',
    });

    // With limit bigger than dataset, we are effectively on the last page.
    expect(ascLastPage.transactions).toHaveLength(txs.length);
    expect(ascLastPage.nextCursor).toBeNull();
    expect(ascLastPage.prevCursor).toBeNull();
  });
});

