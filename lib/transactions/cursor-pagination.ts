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

function isSorted<T extends { date: string; id: string }>(
  arr: T[],
  sortDir: 'asc' | 'desc',
): boolean {
  for (let i = 1; i < arr.length; i++) {
    if (compareTransactionKey(arr[i - 1], arr[i], sortDir) > 0) {
      return false;
    }
  }
  return true;
}

function findFirstGreaterThan<T extends { date: string; id: string }>(
  arr: T[],
  cursor: Pick<TransactionCursor, 'date' | 'id'>,
  sortDir: 'asc' | 'desc',
): number {
  let low = 0;
  let high = arr.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compareTransactionKey(arr[mid], cursor, sortDir) > 0) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

function findFirstGreaterOrEqual<T extends { date: string; id: string }>(
  arr: T[],
  cursor: Pick<TransactionCursor, 'date' | 'id'>,
  sortDir: 'asc' | 'desc',
): number {
  let low = 0;
  let high = arr.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compareTransactionKey(arr[mid], cursor, sortDir) >= 0) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

export function paginateTransactionsByCursor<T extends { date: string; id: string }>(
  transactions: T[],
  { cursor, limit, sortDir }: CursorPaginationOptions,
): CursorPaginatedTransactions<T> {
  const ordered = isSorted(transactions, sortDir)
    ? transactions
    : [...transactions].sort((a, b) => compareTransactionKey(a, b, sortDir));

  let startIndex: number;
  let endIndex: number;

  if (!cursor) {
    startIndex = 0;
    endIndex = Math.min(ordered.length, limit);
  } else if (cursor.direction === 'next') {
    startIndex = findFirstGreaterThan(ordered, cursor, sortDir);
    endIndex = Math.min(ordered.length, startIndex + limit);
  } else {
    const afterCursorIndex = findFirstGreaterOrEqual(ordered, cursor, sortDir);
    startIndex = Math.max(0, afterCursorIndex - limit);
    endIndex = afterCursorIndex;
  }

  const page = ordered.slice(startIndex, endIndex);
  const first = page[0];
  const last = page.at(-1);

  const hasPrevious = page.length > 0 && startIndex > 0;
  const hasNext = page.length > 0 && endIndex < ordered.length;

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
