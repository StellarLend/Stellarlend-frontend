import type { Transaction, TransactionFilters, TransactionAsset, TransactionStatus } from './types';
import type { Transaction as IndexerTransaction } from '@/types/Transaction';
export { paginateTransactionsByCursor } from './cursor-pagination';
export type { CursorPaginatedTransactions, CursorPaginationOptions } from './cursor-pagination';
import { indexAccountTransactions } from '@/lib/indexer';
import { logger } from '@/lib/logger';
import { db } from '../db';
import { transactions as transactionsTable } from '../db/schema/transactions';
import { getTransaction } from './store';
import config from '@/lib/config';

import { isAssetSymbol } from '@/types/enums';

const ROUTE = 'lib/transactions/repository';

export interface DetailedTransaction extends Transaction {
  fee: string;
  explorerUrl: string;
  memo?: string;
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
  { id: 'TXN12347', type: 'Withdrawal',   amount:  -7500,   asset: 'USDC', date: '2025-02-28', time: '04:45PM', status: 'Completed'  },
  { id: 'TXN12348', type: 'Lend Funds',   amount:  -1500,   asset: 'XLM',  date: '2025-01-05', time: '08:00AM', status: 'Completed'  },
  { id: 'TXN12349', type: 'Lend Funds',   amount:  -607.87, asset: 'BTC',  date: '2024-12-20', time: '10:20PM', status: 'Failed'     },
  { id: 'TXN12350', type: 'Deposit',      amount:  20000,   asset: 'ETH',  date: '2024-11-15', time: '01:05PM', status: 'Completed'  },
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

/**
 * Internal filter type that extends TransactionFilters with additional fields
 * used by the repository layer
 */
interface InternalTransactionFilters extends TransactionFilters {
  userId?: string;
  type?: string;
}

/**
 * Helper function to validate and narrow asset type from database text field
 */
function isValidTransactionAsset(asset: string): asset is TransactionAsset {
  return isAssetSymbol(asset);
}

/**
 * Helper function to validate and narrow status type from database text field
 */
function isValidTransactionStatus(status: string): status is TransactionStatus {
  return status === 'Completed' || status === 'Processing' || status === 'Failed';
}

/**
 * Internal transaction type with userId field
 */
interface InternalTransaction extends Transaction {
  userId: string;
}

export async function fetchTransactions(filters?: InternalTransactionFilters): Promise<Transaction[]> {
  const rows = await db.select().from(transactionsTable);
  let txs: InternalTransaction[] = [];
  if (rows.length === 0) {
    await seedTransactions();
    txs = MOCK_TRANSACTIONS.map(t => ({ ...t, userId: 'user-1' }));
  } else {
    txs = rows.map((r) => {
      // Validate and narrow asset type
      const asset: TransactionAsset = isValidTransactionAsset(r.asset) 
        ? r.asset 
        : 'XLM'; // Default fallback for invalid assets

      // Validate and narrow status type
      const status: TransactionStatus = isValidTransactionStatus(r.status)
        ? r.status
        : 'Failed'; // Default fallback for invalid statuses

      return {
        id: r.id,
        type: r.type,
        amount: r.amount,
        asset,
        date: r.date,
        time: r.time,
        status,
        userId: 'user-1',
      };
    });
  }

  if (filters) {
    if (filters.userId) {
      const userId = filters.userId;
      txs = txs.filter((t) => t.userId === userId);
    }
    if (filters.type) {
      const typeFilter = filters.type;
      txs = txs.filter((t) => t.type.toLowerCase().includes(typeFilter.toLowerCase()));
      txs = txs.map((t) => ({ ...t, type: typeFilter }));
    }
    if (filters.status && filters.status !== 'All') {
      const statusFilter = filters.status;
      txs = txs.filter((t) => t.status.toLowerCase() === statusFilter.toLowerCase());
      txs = txs.map((t) => ({ ...t, status: statusFilter }));
    }
  }

  return txs;
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

  // Normalize asset to TransactionAsset (local type) with fallback for unknown values
  const asset: TransactionAsset = isValidTransactionAsset(tx.asset) ? tx.asset : 'XLM';

  // Normalize status to TransactionStatus (local type) with fallback for unknown values
  const status: TransactionStatus = isValidTransactionStatus(tx.status) ? tx.status : 'Failed';

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

  // Extract memo if it exists on the transaction object
  const memo = 'memo' in tx ? (tx as typeof tx & { memo?: string }).memo : undefined;
  const finalMemo = memo || (tx.type === 'Deposit' ? 'Welcome to Stellarlend' : undefined);

  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    asset,
    date: tx.date,
    time: tx.time,
    status,
    fee,
    explorerUrl,
    memo: finalMemo,
    operations,
  };
}
