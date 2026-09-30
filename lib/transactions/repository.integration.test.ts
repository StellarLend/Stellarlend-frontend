import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { inArray } from 'drizzle-orm';

vi.mock('server-only', () => ({}));
import { db, client } from '../db/client';
import { transactions as transactionsTable } from '../db/schema/transactions';
import { fetchTransactions } from './repository';

/**
 * Exercises lib/transactions/repository.ts against a real Postgres connection
 * (no mocking of the DB layer), guarding against the SQLite/Postgres dialect
 * mismatch this repository previously had: the SQLite `db` from `../db` was
 * being queried with a pg-core table, which either throws a dialect error or
 * "no such table: transactions" since no SQLite migration ever created it.
 *
 * Requires a reachable Postgres instance with migrations applied (see
 * `drizzle/0000_init.sql`, `drizzle/0001_transactions_date_id_idx.sql`).
 * Skips itself when no such database is available, e.g. in sandboxes without
 * a running Postgres/DATABASE_URL.
 */

const SEEDED_IDS = ['TXN12345', 'TXN12346', 'TXN12347', 'TXN12348', 'TXN12349', 'TXN12350'];

async function isTransactionsTableReachable(): Promise<boolean> {
  try {
    await client`select 1 from transactions limit 1`;
    return true;
  } catch {
    return false;
  }
}

const dbAvailable = await isTransactionsTableReachable();

describe.skipIf(!dbAvailable)('fetchTransactions (real Postgres integration)', () => {
  beforeEach(async () => {
    await db.delete(transactionsTable);
  });

  afterAll(async () => {
    await db.delete(transactionsTable);
    await client.end({ timeout: 5 });
  });

  it('seeds the mock dataset into the real transactions table when empty', async () => {
    const txns = await fetchTransactions();
    expect(txns.length).toBeGreaterThan(0);

    const rows = await db
      .select()
      .from(transactionsTable)
      .where(inArray(transactionsTable.id, SEEDED_IDS));
    expect(rows).toHaveLength(SEEDED_IDS.length);
  });

  it('reads back previously seeded rows instead of re-seeding', async () => {
    await fetchTransactions();

    const firstRun = await db
      .select()
      .from(transactionsTable)
      .where(inArray(transactionsTable.id, SEEDED_IDS));
    expect(firstRun).toHaveLength(SEEDED_IDS.length);

    const txns = await fetchTransactions();
    expect(txns.map((t) => t.id).sort()).toEqual([...SEEDED_IDS].sort());

    const secondRun = await db
      .select()
      .from(transactionsTable)
      .where(inArray(transactionsTable.id, SEEDED_IDS));
    expect(secondRun).toHaveLength(SEEDED_IDS.length);
  });
});

if (!dbAvailable) {
  it.skip('fetchTransactions (real Postgres integration) — no reachable Postgres database (set DATABASE_URL and apply drizzle/ migrations to run)', () => {});
}
