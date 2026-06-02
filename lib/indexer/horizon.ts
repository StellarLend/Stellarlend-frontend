import config from '@/lib/config';
import { logger } from '@/lib/logger';
import { enqueue } from '@/lib/queue';
import type { HorizonOperation, HorizonPage, IndexerOptions } from './types';

const ROUTE = 'lib/indexer/horizon';
const DEFAULT_LIMIT = 200;
const DEFAULT_MAX_PAGES = 5;
const DEFAULT_TIMEOUT_MS = 8_000;

export class HorizonError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly accountId?: string,
  ) {
    super(message);
    this.name = 'HorizonError';
  }
}

async function fetchPage(url: string, timeoutMs: number): Promise<HorizonPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new HorizonError(
        `Horizon responded with ${response.status}: ${response.statusText}`,
        response.status,
      );
    }

    return (await response.json()) as HorizonPage;
  } catch (err) {
    if (err instanceof HorizonError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new HorizonError(`Horizon request timed out after ${timeoutMs}ms`);
    }
    throw new HorizonError(`Horizon fetch failed: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches all relevant operations for a Stellar account from Horizon.
 *
 * Paginates automatically up to `maxPages` pages (default 5 × 200 = 1 000
 * operations per call). Stops early when Horizon returns fewer records than
 * `limit`, indicating the last page has been reached.
 *
 * Throws `HorizonError` on non-2xx responses or network timeouts.
 */
export async function fetchAccountOperations(
  accountId: string,
  options: IndexerOptions = {},
): Promise<HorizonOperation[]> {
  const {
    limit = DEFAULT_LIMIT,
    order = 'desc',
    cursor,
    maxPages = DEFAULT_MAX_PAGES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const base = `${config.stellar.horizonUrl}/accounts/${encodeURIComponent(accountId)}/operations`;
  const params = new URLSearchParams({ limit: String(Math.min(limit, 200)), order });
  if (cursor) params.set('cursor', cursor);

  let url: string = `${base}?${params.toString()}`;
  const operations: HorizonOperation[] = [];
  let page = 0;

  while (url && page < maxPages) {
    logger.debug(`Fetching Horizon page ${page + 1} for account`, ROUTE, { accountId });

    const data = await fetchPage(url, timeoutMs);
    const records = data._embedded?.records ?? [];
    operations.push(...records);
    page++;

    // Stop paginating when the response is a partial page (last page).
    const nextHref = data._links?.next?.href;
    url = nextHref && records.length >= limit ? nextHref : '';
  }

  logger.info(`Fetched ${operations.length} Horizon operations`, ROUTE, {
    accountId,
    pages: page,
  });

  return operations;
}

/**
 * Schedules an asynchronous account indexing job.
 */
export async function enqueueAccountIndex(accountId: string): Promise<void> {
  await enqueue('indexer', { accountId });
}
