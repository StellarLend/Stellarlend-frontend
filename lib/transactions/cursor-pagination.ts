import { encodeTransactionCursor, type TransactionCursor } from '@/lib/api/cursor';

export interface CursorPaginationOptions {
  cursor: TransactionCursor | null;
  limit: number;
  sortDir: 'asc' | 'desc';
}

export interface CursorPaginatedTransactions<T extends { date: string; id: string }> {
  transactions: T[];
  nextCursor: string | null;
  prevCursor: string | null;
}

function compareTransactionKey<T extends { date: string; id: string }>(
  a: T | Pick<TransactionCursor, 'date' | 'id'>,
  b: T | Pick<TransactionCursor, 'date' | 'id'>,
  sortDir: 'asc' | 'desc',
): number {
  const aTime = new Date(a.date).getTime();
  const bTime = new Date(b.date).getTime();
  const dateComparison = aTime === bTime ? 0 : aTime < bTime ? -1 : 1;
  const idComparison = a.id.localeCompare(b.id);
  const comparison = dateComparison || idComparison;

  return sortDir === 'asc' ? comparison : -comparison;
}

export function paginateTransactionsByCursor<T extends { date: string; id: string }>(
  transactions: T[],
  { cursor, limit, sortDir }: CursorPaginationOptions,
): CursorPaginatedTransactions<T> {
  const ordered = [...transactions].sort((a, b) => compareTransactionKey(a, b, sortDir));
  let page: T[];

  if (!cursor) {
    page = ordered.slice(0, limit);
  } else if (cursor.direction === 'next') {
    page = ordered
      .filter((transaction) => compareTransactionKey(transaction, cursor, sortDir) > 0)
      .slice(0, limit);
  } else {
    const beforeCursor = ordered.filter(
      (transaction) => compareTransactionKey(transaction, cursor, sortDir) < 0,
    );
    page = beforeCursor.slice(Math.max(beforeCursor.length - limit, 0));
  }

  const first = page[0];
  const last = page.at(-1);
  const hasPrevious = first
    ? ordered.some((transaction) => compareTransactionKey(transaction, first, sortDir) < 0)
    : false;
  const hasNext = last
    ? ordered.some((transaction) => compareTransactionKey(transaction, last, sortDir) > 0)
    : false;

  return {
    transactions: page,
    nextCursor: hasNext && last
      ? encodeTransactionCursor({ v: 1, date: last.date, id: last.id, direction: 'next' })
      : null,
    prevCursor: hasPrevious && first
      ? encodeTransactionCursor({ v: 1, date: first.date, id: first.id, direction: 'prev' })
      : null,
  };
}
