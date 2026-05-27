import { NextRequest, NextResponse } from 'next/server';
import {
  ASSET_SYMBOLS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  isAssetSymbol,
  isTransactionType,
  isTransactionStatus,
} from '@/types/enums';
import { fetchTransactions } from '@/types/Transaction';
import type { Transaction } from '@/types/Transaction';
import { withRequestLogging } from '@/lib/api/handler';

export const runtime = 'nodejs';

/** GET /api/transactions
 *  Optional query params: asset, type, status
 *  Returns 400 with a descriptive error for any unknown vocabulary value.
 */
async function handleGetTransactions(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const asset = searchParams.get('asset');
  const type = searchParams.get('type');
  const status = searchParams.get('status');

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

  let transactions = await fetchTransactions();

  if (asset) transactions = transactions.filter((t) => t.asset === asset);
  if (type) transactions = transactions.filter((t) => t.type === type);
  if (status) transactions = transactions.filter((t) => t.status === status);

  return NextResponse.json({ transactions });
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
export const POST = withRequestLogging('/api/transactions', handlePostTransactions);
