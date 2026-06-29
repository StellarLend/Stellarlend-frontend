import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import {
  fetchTransactions,
  filterTransactions,
  serializeTransactionsToCSV,
} from '@/lib/transactions';
import type { TransactionFilters, TransactionStatus } from '@/lib/transactions';
import { parseTransactionFilter } from '@/lib/transactions/filters';
import { withRequestLogging } from '@/lib/api/handler';

export const runtime = 'nodejs';

function parseFilters(searchParams: URLSearchParams): TransactionFilters {
  const parsed = parseTransactionFilter(searchParams);
  if (!parsed.valid) {
    return {};
  }

  const status = parsed.filter.status ?? (searchParams.get('status') ?? 'All');
  const normalizedStatus = status && status !== 'All' ? (status as TransactionStatus) : 'All';

  return {
    search: searchParams.get('search') ?? undefined,
    status: normalizedStatus,
    dateFrom: parsed.filter.fromDate,
    dateTo: parsed.filter.toDate,
  };
}

async function handleExportTransactions(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const filters = parseFilters(request.nextUrl.searchParams);
  const all = await fetchTransactions();
  let filtered = filterTransactions(all, filters);

  const asset = request.nextUrl.searchParams.get('asset');
  const type = request.nextUrl.searchParams.get('type');

  if (asset) {
    filtered = filtered.filter((transaction) => transaction.asset.toLowerCase() === asset.toLowerCase());
  }

  if (type) {
    filtered = filtered.filter((transaction) => transaction.type.toLowerCase().includes(type.toLowerCase()));
  }

  const csv = serializeTransactionsToCSV(filtered);
  const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export const GET = withRequestLogging('/api/transactions/export', handleExportTransactions);
