import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import {
  fetchTransactions,
  filterTransactions,
  serializeTransactionsToCSV,
} from '@/lib/transactions';
import type { TransactionFilters, TransactionStatus } from '@/lib/transactions';
import { withRequestLogging } from '@/lib/api/handler';

export const runtime = 'nodejs';

const VALID_STATUSES = new Set<string>(['All', 'Completed', 'Processing', 'Failed']);

function parseFilters(searchParams: URLSearchParams): TransactionFilters {
  const status = searchParams.get('status') ?? 'All';
  return {
    search:   searchParams.get('search')   ?? undefined,
    status:   VALID_STATUSES.has(status) ? (status as TransactionStatus | 'All') : 'All',
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo:   searchParams.get('dateTo')   ?? undefined,
  };
}

async function handleExportTransactions(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const filters = parseFilters(request.nextUrl.searchParams);
  const all = await fetchTransactions();
  const filtered = filterTransactions(all, filters);

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
