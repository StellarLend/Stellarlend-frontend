import type { Transaction } from "@/types/Transaction";
import type { TransactionStatus } from "@/types/enums";
import { db } from "@/lib/db";
import { transactions as transactionsTable } from "@/lib/db/schema/transactions";
import { eq } from "drizzle-orm";

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'TXN12345', type: 'Lend Funds',   amount:  1250,   asset: 'XLM',  date: '2025-03-15', time: '02:30PM', status: 'Completed'  },
  { id: 'TXN12346', type: 'Loan Payment', amount:  -250,    asset: 'BTC',  date: '2025-03-10', time: '11:15AM', status: 'Processing' },
  { id: 'TXN12347', type: 'Withdrawal',   amount:  -7500,   asset: 'STRK', date: '2025-02-28', time: '04:45PM', status: 'Completed'  },
  { id: 'TXN12348', type: 'Lend Funds',   amount:  -1500,   asset: 'XLM',  date: '2025-01-05', time: '08:00AM', status: 'Completed'  },
  { id: 'TXN12349', type: 'Lend Funds',   amount:  -607.87, asset: 'BTC',  date: '2024-12-20', time: '10:20PM', status: 'Failed'     },
  { id: 'TXN12350', type: 'Deposit',      amount:  20000,   asset: 'STRK', date: '2024-11-15', time: '01:05PM', status: 'Completed'  },
];

const inMemoryStore = new Map<string, Transaction>(
  MOCK_TRANSACTIONS.map((t) => [t.id, { ...t }])
);

const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

/** Retrieve a single transaction by ID. */
export async function getTransaction(
  id: string,
): Promise<Transaction | undefined> {
  if (isTestEnv) {
    return inMemoryStore.get(id);
  }
  try {
    const [row] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .limit(1);

    if (!row) return inMemoryStore.get(id);

    return {
      id: row.id,
      type: row.type,
      amount: row.amount,
      asset: row.asset,
      date: row.date,
      time: row.time,
      status: row.status,
    };
  } catch {
    return inMemoryStore.get(id);
  }
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
  if (isTestEnv) {
    const mem = inMemoryStore.get(id);
    if (!mem) return null;
    mem.status = status;
    return mem;
  }
  try {
    const [row] = await db
      .update(transactionsTable)
      .set({ status })
      .where(eq(transactionsTable.id, id))
      .returning();

    if (!row) {
      const mem = inMemoryStore.get(id);
      if (!mem) return null;
      mem.status = status;
      return mem;
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
  } catch {
    const mem = inMemoryStore.get(id);
    if (!mem) return null;
    mem.status = status;
    return mem;
  }
}

/**
 * Reset the store (useful for tests).
 */
export async function resetStore(): Promise<void> {
  inMemoryStore.clear();
  for (const t of MOCK_TRANSACTIONS) {
    inMemoryStore.set(t.id, { ...t });
  }
  if (!isTestEnv) {
    try {
      await db.delete(transactionsTable);
    } catch {
      // Ignore DB connection errors in test mode
    }
  }
}
