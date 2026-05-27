import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { fetchTransactions, parseTransactionFilter } from '@/lib/transactions';

export const runtime = 'nodejs';

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
  return NextResponse.json({ data: transactions });
}
