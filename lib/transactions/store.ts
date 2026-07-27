import type { Transaction } from "@/types/Transaction";
import { isAssetSymbol, isTransactionStatus } from "@/types/enums";
import { db } from "../db/client";
import { transactions as transactionsTable } from "../db/schema/transactions";
import { eq } from "drizzle-orm";

interface TransactionRow {
  id: string;
  type: string;
  amount: number;
  asset: string;
  date: string;
  time: string;
  status: string;
}

const MOCK_TRANSACTIONS: TransactionRow[] = [
  { id: 'TXN12345', type: 'Deposit',      amount: 2000,    asset: 'XLM',  date: '2025-04-12', time: '09:32AM', status: 'Completed'  },
  { id: 'TXN12346', type: 'Loan Payment', amount:  -250,    asset: 'BTC',  date: '2025-03-10', time: '11:15AM', status: 'Processing' },
  { id: 'TXN12347', type: 'Withdrawal',   amount:  -7500,   asset: 'STRK', date: '2025-02-28', time: '04:45PM', status: 'Completed'  },
  { id: 'TXN12348', type: 'Lend Funds',   amount:  -1500,   asset: 'XLM',  date: '2025-01-05', time: '08:00AM', status: 'Completed'  },
  { id: 'TXN12349', type: 'Lend Funds',   amount:  -607.87, asset: 'BTC',  date: '2024-12-20', time: '10:20PM', status: 'Failed'     },
  { id: 'TXN12350', type: 'Deposit',      amount: 20000,   asset: 'STRK', date: '2024-11-15', time: '01:05PM', status: 'Completed'  },
];

async function fetchMockTransactions() {
  for (const txn of MOCK_TRANSACTIONS) {
    await db.insert(transactionsTable).values(txn).onConflictDoNothing();
  }
}

export function mapTransactionRow(row: TransactionRow): Transaction {
  if (!isAssetSymbol(row.asset)) {
    throw new Error(`Invalid transaction asset: ${String(row.asset)}`);
  }

  if (!isTransactionStatus(row.status)) {
    throw new Error(`Invalid transaction status: ${String(row.status)}`);
  }

  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    asset: row.asset,
    date: row.date,
    time: row.time,
    status: row.status,
  };
}

async function ensureSeeded() {
  const rows = await db.select().from(transactionsTable);
  if (rows.length === 0) {
    await fetchMockTransactions(); // Seeds the database
  }
}

/** Retrieve a single transaction by ID. */
export async function getTransaction(
  id: string,
): Promise<Transaction | undefined> {
  await ensureSeeded();
  const [row] = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.id, id))
    .limit(1);

  if (!row) return undefined;

  return mapTransactionRow(row);
}

/**
 * Update the status of a transaction.
 *
 * @returns The updated transaction, or `null` if the ID was not found.
 */
export async function updateTransactionStatus(
  id: string,
  status: TransactionStatus,
): Promise<Transaction | null> {
  await ensureSeeded();
  const [row] = await db
    .update(transactionsTable)
    .set({ status })
    .where(eq(transactionsTable.id, id))
    .returning();

  if (!row) return null;

  return mapTransactionRow(row);
}

/**
 * Reset the store (useful for tests).
 */
export async function resetStore(): Promise<void> {
  await db.delete(transactionsTable);
}
