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
import {
  fetchTransactionRecords,
  filterTransactions,
  paginateTransactionsByCursor,
} from '@/lib/transactions/repository';
import { withRequestLogging } from '@/lib/api/handler';
import { parseCursorParams } from '@/lib/api/cursor';
import { withIdempotency } from '@/lib/api';

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

function parseSortBy(value: string | null): "date" | "amount" {
  return value === "amount" ? "amount" : "date";
}

function parseSortDir(value: string | null): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

/** GET /api/transactions
 *  Optional query params: page, pageSize, cursor, limit, asset, type, status, search, dateFrom, dateTo,
 *  sortBy, sortDir
 *  Returns typed transaction pages with total count and cursor links when cursor pagination is used.
 */
async function handleGetTransactions(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const asset = searchParams.get('asset');
  const type = searchParams.get('type');
  const status = searchParams.get('status');

  const page = parsePageParam(searchParams.get('page'), DEFAULT_PAGE);
  const pageSize = parsePageSizeParam(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);
  const useCursorPagination = searchParams.has('cursor') || searchParams.has('limit');
  const search = searchParams.get('search');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const sortBy = parseSortBy(searchParams.get('sortBy'));
  const sortDir = parseSortDir(searchParams.get('sortDir'));

  if (asset !== null && !isAssetSymbol(asset)) {
    return NextResponse.json(
      { error: `Unknown asset "${asset}". Supported: ${ASSET_SYMBOLS.join(', ')}` },
      { status: 400 }
    );
  }

  if (type !== null && !isTransactionType(type)) {
    return NextResponse.json(
      { error: `Unknown type "${type}". Supported: ${TRANSACTION_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  if (status !== null && !isTransactionStatus(status)) {
    return NextResponse.json(
      { error: `Unknown status "${status}". Supported: ${TRANSACTION_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const allTransactions = await fetchTransactionRecords();
  let transactions = filterTransactions(allTransactions, {
    search: search ?? undefined,
    status: status ?? undefined,
    dateFrom: dateFrom ?? undefined,
    dateTo: dateTo ?? undefined,
  });

  if (asset) transactions = transactions.filter((t) => t.asset === asset);
  if (type) transactions = transactions.filter((t) => t.type === type);
  if (status) transactions = transactions.filter((t) => t.status === status);

  const total = transactions.length;
  transactions = transactions.sort((a, b) => {
    if (sortBy === "amount") {
      return sortDir === "asc" ? a.amount - b.amount : b.amount - a.amount;
    }

    return sortDir === "asc"
      ? new Date(a.date).getTime() - new Date(b.date).getTime()
      : new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  if (useCursorPagination) {
    if (sortBy !== 'date') {
      return NextResponse.json(
        { error: 'Cursor pagination only supports sortBy=date because it uses (date, id) as the stable keyset.' },
        { status: 400 },
      );
    }

    try {
      const cursorParams = parseCursorParams(searchParams);
      const pageByCursor = paginateTransactionsByCursor(transactions, {
        ...cursorParams,
        sortDir,
      });

      return NextResponse.json({
        transactions: pageByCursor.transactions,
        total,
        nextCursor: pageByCursor.nextCursor,
        prevCursor: pageByCursor.prevCursor,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid cursor pagination parameters' },
        { status: 400 },
      );
    }
  }

  const paginated = transactions.slice((page - 1) * pageSize, page * pageSize);
  return NextResponse.json({ transactions: paginated, total, nextCursor: null, prevCursor: null });
}

/** POST /api/transactions
 *  Body: Partial<Transaction> (id is generated server-side)
 *  Validates asset, type, and status against canonical enums.
 */
async function handlePostTransactions(req: NextRequest) {
  return withIdempotency(req, async (request) => createTransaction(request));
}

async function createTransaction(req: NextRequest) {
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
      { status: 400 }
    );
  }

  if (!isTransactionType(type)) {
    return NextResponse.json(
      { error: `Unknown type "${type}". Supported: ${TRANSACTION_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  if (!isTransactionStatus(status)) {
    return NextResponse.json(
      { error: `Unknown status "${status}". Supported: ${TRANSACTION_STATUSES.join(', ')}` },
      { status: 400 }
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
export const POST = withRequestLogging('/api/transactions', (req: NextRequest) =>
  withIdempotency(req, handlePostTransactions)
);
