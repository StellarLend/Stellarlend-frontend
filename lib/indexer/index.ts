import type { Transaction } from '@/types/Transaction';
import { logger } from '@/lib/logger';
import type { IndexerOptions } from './types';
import { fetchAccountOperations } from './horizon';
import { normalizeOperations } from './normalizer';
import { IndexerCache, DEFAULT_TTL_MS } from './cache';

const ROUTE = 'lib/indexer';

const cache = new IndexerCache<Transaction[]>();

export interface IndexAccountOptions extends IndexerOptions {
  /** TTL for cached results in milliseconds (default 60 000). */
  cacheTtlMs?: number;
  /** Skip the cache and force a fresh Horizon fetch. */
  bypassCache?: boolean;
}

/**
 * Fetches and normalizes on-chain operations for a Stellar account.
 *
 * Results are cached per account for `cacheTtlMs` milliseconds (default 60 s)
 * so that repeated calls within the same window do not hammer Horizon.
 *
 * Errors from Horizon propagate as `HorizonError` instances; callers are
 * responsible for deciding whether to surface them or fall back to stale data.
 */
export async function indexAccountTransactions(
  accountId: string,
  options: IndexAccountOptions = {},
): Promise<Transaction[]> {
  const { cacheTtlMs = DEFAULT_TTL_MS, bypassCache = false, ...fetchOptions } = options;

  if (!bypassCache) {
    const hit = cache.get(accountId);
    if (hit) {
      logger.debug('Returning cached transactions for account', ROUTE, { accountId });
      return hit;
    }
  }

  const operations = await fetchAccountOperations(accountId, fetchOptions);
  const transactions = normalizeOperations(operations, accountId);

  cache.set(accountId, transactions, cacheTtlMs);
  logger.info(`Indexed ${transactions.length} transactions for account`, ROUTE, { accountId });

  return transactions;
}

/** Removes cached results for the given account (e.g. after a new transaction is posted). */
export function invalidateAccountCache(accountId: string): void {
  cache.invalidate(accountId);
  logger.debug('Cache invalidated for account', ROUTE, { accountId });
}

export type { IndexerOptions, IndexAccountOptions };
export { HorizonError } from './horizon';
export { normalizeOperation, normalizeOperations } from './normalizer';
export { IndexerCache } from './cache';
