import type { Transaction, TransactionFilters } from './types';
import type { Transaction as IndexerTransaction } from '@/types/Transaction';
import { indexAccountTransactions } from '@/lib/indexer';
import { logger } from '@/lib/logger';

const ROUTE = 'lib/transactions/repository';

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'TXN12345', type: 'Deposit',      amount:  2000,    asset: 'XLM',  date: '2025-04-12', time: '09:32AM', status: 'Completed'  },
  { id: 'TXN12346', type: 'Loan Payment', amount:  -250,    asset: 'BTC',  date: '2025-03-10', time: '11:15AM', status: 'Processing' },
  { id: 'TXN12347', type: 'Withdrawal',   amount:  -7500,   asset: 'STRK', date: '2025-02-28', time: '04:45PM', status: 'Completed'  },
  { id: 'TXN12348', type: 'Lend Funds',   amount:  -1500,   asset: 'XLM',  date: '2025-01-05', time: '08:00AM', status: 'Completed'  },
  { id: 'TXN12349', type: 'Lend Funds',   amount:  -607.87, asset: 'BTC',  date: '2024-12-20', time: '10:20PM', status: 'Failed'     },
  { id: 'TXN12350', type: 'Deposit',      amount:  20000,   asset: 'STRK', date: '2024-11-15', time: '01:05PM', status: 'Completed'  },
];

export async function fetchTransactions(): Promise<Transaction[]> {
  return MOCK_TRANSACTIONS;
}

/**
 * Primary data source for the /api/transactions route.
 *
 * When the `STELLAR_INDEXER_ACCOUNT` environment variable is set, live
 * on-chain operations are fetched from Horizon and normalized into the
 * Transaction shape.  Falls back to the mock dataset when no account is
 * configured or when Horizon is unavailable, ensuring the API remains
 * functional in all environments.
 */
export async function fetchTransactionRecords(
  accountId?: string,
): Promise<IndexerTransaction[]> {
  const account = accountId ?? process.env.STELLAR_INDEXER_ACCOUNT;

  if (account) {
    try {
      return await indexAccountTransactions(account);
    } catch (err) {
      logger.warn(
        'Horizon indexer failed; falling back to mock data',
        ROUTE,
        { error: String(err) },
      );
    }
  }

  return MOCK_TRANSACTIONS as unknown as IndexerTransaction[];
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const { search = '', status = 'All', dateFrom, dateTo } = filters;

  return transactions.filter((txn) => {
    if (search) {
      const q = search.toLowerCase();
      const matches =
        txn.type.toLowerCase().includes(q) ||
        txn.id.toLowerCase().includes(q) ||
        txn.asset.toLowerCase().includes(q) ||
        txn.amount.toString().includes(q);
      if (!matches) return false;
    }

    if (status && status !== 'All' && txn.status !== status) return false;

    if (dateFrom && new Date(txn.date) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(txn.date) > new Date(dateTo))   return false;

    return true;
  });
}
