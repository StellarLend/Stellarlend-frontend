import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { fetchTransactions, parseTransactionFilter, transactionsToCsv } from '@/lib/transactions';

export const runtime = 'nodejs';

function buildFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `transactions-${date}.csv`;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { valid, filter, error } = parseTransactionFilter(searchParams);
  if (!valid) {
    return NextResponse.json({ error }, { status: 400 });
  }

  filter.userId = (user as { id?: string }).id ?? undefined;

  const transactions = await fetchTransactions(filter);
  const csv = transactionsToCsv(transactions);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${buildFilename()}"`,
      'Cache-Control': 'no-store',
    },
  });
}
