import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { generateETag, isNotModified, cacheHeaders, notModifiedResponse } from '@/lib/api/etag';

export const runtime = 'nodejs';

export type TransactionStatus = 'Completed' | 'Processing' | 'Failed';

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  asset: 'XLM' | 'BTC' | 'STRK';
  date: string;
  time: string;
  status: TransactionStatus;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'TXN12345', type: 'Deposit',      amount:  2000,    asset: 'XLM',  date: '2025-04-12', time: '09:32AM', status: 'Completed'  },
  { id: 'TXN12346', type: 'Loan Payment', amount:  -250,    asset: 'BTC',  date: '2025-03-10', time: '11:15AM', status: 'Processing' },
  { id: 'TXN12347', type: 'Withdrawal',   amount:  -7500,   asset: 'STRK', date: '2025-02-28', time: '04:45PM', status: 'Completed'  },
  { id: 'TXN12348', type: 'Lend Funds',   amount:  -1500,   asset: 'XLM',  date: '2025-01-05', time: '08:00AM', status: 'Completed'  },
  { id: 'TXN12349', type: 'Lend Funds',   amount:  -607.87, asset: 'BTC',  date: '2024-12-20', time: '10:20PM', status: 'Failed'     },
  { id: 'TXN12350', type: 'Deposit',      amount:  20000,   asset: 'STRK', date: '2024-11-15', time: '01:05PM', status: 'Completed'  },
];

const VALID_STATUSES = new Set<string>(['All', 'Completed', 'Processing', 'Failed']);

function applyFilters(
  transactions: Transaction[],
  params: URLSearchParams,
): Transaction[] {
  const search = (params.get('search') ?? '').toLowerCase();
  const status = params.get('status') ?? 'All';
  const dateFrom = params.get('dateFrom');
  const dateTo = params.get('dateTo');
  const safeStatus = VALID_STATUSES.has(status) ? status : 'All';

  return transactions.filter((txn) => {
    if (search) {
      const hit =
        txn.type.toLowerCase().includes(search) ||
        txn.id.toLowerCase().includes(search) ||
        txn.asset.toLowerCase().includes(search) ||
        txn.amount.toString().includes(search);
      if (!hit) return false;
    }
    if (safeStatus !== 'All' && txn.status !== safeStatus) return false;
    if (dateFrom && new Date(txn.date) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(txn.date) > new Date(dateTo))   return false;
    return true;
  });
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const filtered = applyFilters(MOCK_TRANSACTIONS, request.nextUrl.searchParams);

  // Transaction data is user-specific — always private, never cached by intermediaries.
  const etag = generateETag(filtered);

  if (isNotModified(request, etag)) {
    return new NextResponse(null, notModifiedResponse(etag, 'private'));
  }

  return NextResponse.json(filtered, {
    status: 200,
    headers: cacheHeaders(etag, 0, 'private'),
  });
}
