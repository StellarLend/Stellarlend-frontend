import { NextRequest, NextResponse } from 'next/server';
import {
  ASSET_SYMBOLS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  isAssetSymbol,
  isTransactionType,
  isTransactionStatus,
} from '@/types/enums';
import type { Transaction } from '@/types/Transaction';
import { withRequestLogging } from '@/lib/api/handler';
import { decodeTransactionCursor, parseCursorLimit } from '@/lib/api/cursor';
import { withIdempotency } from '@/lib/api/idempotency';
import { fetchTransactionRecords, filterTransactions, paginateTransactionsByCursor } from '@/lib/transactions/repository';

export const runtime = 'nodejs';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 100;

function parsePageParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSizeParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function parseSortBy(value: string | null): 'date' | 'amount' {
  return value === 'amount' ? 'amount' : 'date';
}

function parseSortDir(value: string | null): 'asc' | 'desc' {
  return value === 'asc' ? 'asc' : 'desc';
}

function sortTransactions(transactions: Transaction[], sortBy: 'date' | 'amount', sortDir: 'asc' | 'desc') {
  return [...transactions].sort((a, b) => {
    if (sortBy === 'amount') {
      return sortDir === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }

    return sortDir === 'asc'
      ? new Date(a.date).getTime() - new Date(b.date).getTime()
      : new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

/** GET /api/transactions
 *  Optional query params: page, pageSize, asset, type, status, search, dateFrom, dateTo,
 *  sortBy, sortDir
 *  Returns typed transaction pages with total count.
 */
async function handleGetTransactions(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const asset = searchParams.get('asset');
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const sortBy = parseSortBy(searchParams.get('sortBy'));
  const sortDir = parseSortDir(searchParams.get('sortDir'));
  const page = parsePageParam(searchParams.get('page'), DEFAULT_PAGE);
  const pageSize = parsePageSizeParam(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  if (asset !== null && !isAssetSymbol(asset)) {
    return NextResponse.json(
      { error: `Unknown asset "${asset}". Supported: ${ASSET_SYMBOLS.join(', ')}` },
      { status: 400 },
    );
  }

  if (type !== null && !isTransactionType(type)) {
    return NextResponse.json(
      { error: `Unknown type "${type}". Supported: ${TRANSACTION_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  if (status !== null && !isTransactionStatus(status)) {
    return NextResponse.json(
      { error: `Unknown status "${status}". Supported: ${TRANSACTION_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  const rawCursor = searchParams.get('cursor');
  const hasCursor = rawCursor !== null;
  const hasLimit = searchParams.has('limit');

  if ((hasCursor || hasLimit) && sortBy === 'amount') {
    return NextResponse.json(
      { error: 'Cursor pagination requires sortBy=date' },
      { status: 400 },
    );
  }

  const allTransactions = await fetchTransactionRecords();
  let transactions = filterTransactions(allTransactions as Transaction[], {
    search: search ?? undefined,
    status: status ?? undefined,
    dateFrom: dateFrom ?? undefined,
    dateTo: dateTo ?? undefined,
  });

  if (asset) {
    transactions = transactions.filter((transaction) => transaction.asset === asset);
  }

  if (type) {
    transactions = transactions.filter((transaction) => transaction.type === type);
  }

  if (status) {
    transactions = transactions.filter((transaction) => transaction.status === status);
  }

  if (hasCursor || hasLimit) {
    let cursor: { v: 1; date: string; id: string; direction: 'next' | 'prev' } | null = null;

    if (rawCursor !== null) {
      try {
        cursor = decodeTransactionCursor(rawCursor);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid cursor' },
          { status: 400 },
        );
      }
    }

    const limit = parseCursorLimit(searchParams.get('limit'));
    const paginated = paginateTransactionsByCursor(transactions, { cursor, limit, sortDir });

    return NextResponse.json({
      transactions: paginated.transactions,
      total: transactions.length,
      nextCursor: paginated.nextCursor,
      prevCursor: paginated.prevCursor,
    });
  }

  const total = transactions.length;
  const sorted = sortTransactions(transactions, sortBy, sortDir);
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  return NextResponse.json({ transactions: paginated, total });
}

/** POST /api/transactions
 *  Body: Partial<Transaction> (id is generated server-side)
 *  Validates asset, type, and status against canonical enums.
 */
async function handlePostTransactions(req: NextRequest) {
  let body: Partial<Transaction>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { asset, type, status, amount, date, time } = body;

  if (!isAssetSymbol(asset)) {
    return NextResponse.json(
      { error: `Unknown asset "${asset}". Supported: ${ASSET_SYMBOLS.join(', ')}` },
      { status: 400 },
    );
  }

  if (!isTransactionType(type)) {
    return NextResponse.json(
      { error: `Unknown type "${type}". Supported: ${TRANSACTION_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  if (!isTransactionStatus(status)) {
    return NextResponse.json(
      { error: `Unknown status "${status}". Supported: ${TRANSACTION_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  if (typeof amount !== 'number') {
    return NextResponse.json({ error: 'amount must be a number' }, { status: 400 });
  }

  if (!date || !time) {
    return NextResponse.json({ error: 'date and time are required' }, { status: 400 });
  }

  const transaction: Transaction = {
    id: `TXN${Date.now()}`,
    asset,
    type,
    status,
    amount,
    date,
    time,
  };

  return NextResponse.json({ transaction }, { status: 201 });
}

export const GET = withRequestLogging('/api/transactions', handleGetTransactions);
export const POST = withRequestLogging('/api/transactions', (req: NextRequest) => withIdempotency(req, handlePostTransactions));
