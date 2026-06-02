import type { Transaction } from "@/types/Transaction";
import type { TransactionStatus } from "@/types/enums";
import { fetchTransactions } from "@/lib/transactions/repository";

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

  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    asset: row.asset as any,
    date: row.date,
    time: row.time,
    status: row.status as any,
  };
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

  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    asset: row.asset as any,
    date: row.date,
    time: row.time,
    status: row.status as any,
  };
}

/**
 * Reset the store (useful for tests).
 */
export async function resetStore(): Promise<void> {
  await db.delete(transactionsTable);
}
