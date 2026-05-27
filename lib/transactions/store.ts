import type { Transaction } from "@/types/Transaction";
import type { TransactionStatus } from "@/types/enums";
import { fetchTransactions } from "@/types/Transaction";

/**
 * Simple in-memory transaction store.
 *
 * Seeded from the existing `fetchTransactions()` mock data on first access.
 * When a real database is introduced, swap out this module.
 */

let store: Map<string, Transaction> | null = null;

/** Lazily initialise the store from the mock data source. */
async function getStore(): Promise<Map<string, Transaction>> {
  if (!store) {
    const transactions = await fetchTransactions();
    store = new Map(transactions.map((t) => [t.id, t]));
  }
  return store;
}

/** Retrieve a single transaction by ID. */
export async function getTransaction(
  id: string,
): Promise<Transaction | undefined> {
  const s = await getStore();
  return s.get(id);
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
  const s = await getStore();
  const tx = s.get(id);
  if (!tx) return null;

  const updated: Transaction = { ...tx, status };
  s.set(id, updated);
  return updated;
}

/**
 * Reset the store (useful for tests).
 */
export function resetStore(): void {
  store = null;
}
