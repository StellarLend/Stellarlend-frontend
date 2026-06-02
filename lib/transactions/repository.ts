import type { Transaction, TransactionFilters } from './types';
import type { Transaction as IndexerTransaction } from '@/types/Transaction';
import { indexAccountTransactions } from '@/lib/indexer';
import { logger } from '@/lib/logger';
import { db } from '../db';
import { transactions as transactionsTable } from '../db/schema/transactions';
import { getTransaction } from './store';
import config from '@/lib/config';

const ROUTE = 'lib/transactions/repository';

export interface DetailedTransaction extends Transaction {
  fee: string;
  explorerUrl: string;
  operations: Array<{
    id: string;
    type: string;
    source: string;
    destination: string;
    amount: string;
    asset: string;
  }>;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'TXN12345', type: 'Deposit',      amount:  2000,    asset: 'XLM',  date: '2025-04-12', time: '09:32AM', status: 'Completed'  },
  { id: 'TXN12346', type: 'Loan Payment', amount:  -250,    asset: 'BTC',  date: '2025-03-10', time: '11:15AM', status: 'Processing' },
  { id: 'TXN12347', type: 'Withdrawal',   amount:  -7500,   asset: 'STRK', date: '2025-02-28', time: '04:45PM', status: 'Completed'  },
  { id: 'TXN12348', type: 'Lend Funds',   amount:  -1500,   asset: 'XLM',  date: '2025-01-05', time: '08:00AM', status: 'Completed'  },
  { id: 'TXN12349', type: 'Lend Funds',   amount:  -607.87, asset: 'BTC',  date: '2024-12-20', time: '10:20PM', status: 'Failed'     },
  { id: 'TXN12350', type: 'Deposit',      amount:  20000,   asset: 'STRK', date: '2024-11-15', time: '01:05PM', status: 'Completed'  },
];

async function seedTransactions() {
  for (const txn of MOCK_TRANSACTIONS) {
    await db.insert(transactionsTable).values({
      id: txn.id,
      type: txn.type,
      amount: txn.amount,
      asset: txn.asset,
      date: txn.date,
      time: txn.time,
      status: txn.status,
    }).onConflictDoNothing();
  }
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const rows = await db.select().from(transactionsTable);
  if (rows.length === 0) {
    await seedTransactions();
    return MOCK_TRANSACTIONS;
  }
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: r.amount,
    asset: r.asset as any,
    date: r.date,
    time: r.time,
    status: r.status as any,
  }));
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

  const txs = await fetchTransactions();
  return txs as unknown as IndexerTransaction[];
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

/**
 * Retrieves a detailed transaction record by its ID,
 * complete with mock/on-chain operation histories, transaction fees, and network explorer link.
 */
export async function getTransactionDetail(id: string): Promise<DetailedTransaction | null> {
  const tx = await getTransaction(id);
  if (!tx) return null;

  // Compile network sub-path
  const net = config.stellar.network.toLowerCase() === 'public' || config.stellar.network.toLowerCase() === 'mainnet' ? 'public' : 'testnet';
  const explorerUrl = `https://stellar.expert/explorer/${net}/tx/${id}`;

  const fee = tx.type === 'Deposit' ? '0.0001000 XLM' : '0.0001500 XLM';
  const operations = [
    {
      id: `op_${tx.id}_1`,
      type: tx.type.toLowerCase() === 'deposit' ? 'payment' : 'invoke_host_function',
      source: 'GA2C5RFPE6GCKMY3AA3H6AOF5Q4G5S4GX6TQCGEAAS624JBZ2G2UQHGD',
      destination: 'GBXQ2P5Z5U67G6Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66Z66',
      amount: Math.abs(tx.amount).toFixed(7),
      asset: tx.asset,
    }
  ];

  return {
    ...tx,
    fee,
    explorerUrl,
    operations,
  };
}
