import { NextRequest, NextResponse } from 'next/server';
import type { Transaction } from '@/types/Transaction';
import { withRequestLogging } from '@/lib/api/handler';
import { decodeTransactionCursor, parseCursorLimit } from '@/lib/api/cursor';
import { withIdempotency } from '@/lib/api/idempotency';
import { fetchTransactionRecords, filterTransactions, paginateTransactionsByCursor } from '@/lib/transactions/repository';
import { transactionQuerySchema, transactionBodySchema } from '@/lib/validation/schemas/transactions';

export const runtime = 'nodejs';

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

function firstSchemaError(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Invalid request';
}

/** GET /api/transactions
 *  Optional query params: page, pageSize, asset, type, status, search, dateFrom, dateTo,
 *  sortBy, sortDir
 *  Returns typed transaction pages with total count.
 */
async function handleGetTransactions(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const parsed = transactionQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: firstSchemaError(parsed.error) }, { status: 400 });
  }

  const {
    asset,
    type,
    status,
    search,
    dateFrom,
    dateTo,
    sortBy,
    sortDir,
    page,
    pageSize,
    cursor: rawCursor,
    limit: rawLimit,
  } = parsed.data;

  const hasCursor = rawCursor !== undefined;
  const hasLimit = rawLimit !== undefined;

  if ((hasCursor || hasLimit) && sortBy === 'amount') {
    return NextResponse.json(
      { error: 'Cursor pagination requires sortBy=date' },
      { status: 400 },
    );
  }

  const allTransactions = await fetchTransactionRecords();
  let transactions = filterTransactions(allTransactions as any, {
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

    if (rawCursor !== undefined) {
      try {
        cursor = decodeTransactionCursor(rawCursor);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid cursor' },
          { status: 400 },
        );
      }
    }

    const limit = parseCursorLimit(rawLimit ?? null);
    const paginated = paginateTransactionsByCursor(transactions, { cursor, limit, sortDir });

    return NextResponse.json({
      transactions: paginated.transactions,
      total: transactions.length,
      nextCursor: paginated.nextCursor,
      prevCursor: paginated.prevCursor,
    });
  }

  const total = transactions.length;
  const sorted = sortTransactions(transactions as any, sortBy, sortDir);
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  return NextResponse.json({ transactions: paginated, total });
}

/** POST /api/transactions
 *  Body: Partial<Transaction> (id is generated server-side)
 *  Validates asset, type, and status against canonical enums.
 */
async function handlePostTransactions(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = transactionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstSchemaError(parsed.error) }, { status: 400 });
  }

  const { asset, type, status, amount, date, time } = parsed.data;

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
export const POST = withRequestLogging('/api/transactions', async (req: NextRequest) => (await withIdempotency(req, handlePostTransactions)) as NextResponse);
