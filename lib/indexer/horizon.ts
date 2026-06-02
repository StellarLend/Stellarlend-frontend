import config from '@/lib/config';
import { logger } from '@/lib/logger';
import { getLatestCursor, saveCursorCheckpoint } from './cursor';
import { validateMemo, resolveAccountByMemo, isStrictModeEnabled } from '../stellar/memo';
import type { HorizonOperation, HorizonPage, IndexerOptions } from './types';

export { HorizonOperation, IndexerOptions };

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

export class HorizonIndexer {
  private indexerId: string;
  private horizonUrl: string;

  constructor(indexerId: string, horizonUrl: string = "https://horizon-testnet.stellar.org") {
    this.indexerId = indexerId;
    this.horizonUrl = horizonUrl;
  }

  async fetchAndProcessBatch(mockPageFetcher: (cursor: string | null) => Promise<HorizonOperation[]>): Promise<number> {
    // 1. Start at the saved cursor state checkpoint
    const lastCursor = await getLatestCursor(this.indexerId);
    
    // 2. Fetch records batch
    const operations = await mockPageFetcher(lastCursor);
    if (operations.length === 0) {
      return 0;
    }

    // 3. Process records (Idempotency mapping check should run internally here)
    const strictMode = isStrictModeEnabled();
    const validOperations: HorizonOperation[] = [];

    for (const op of operations) {
      if (op.memo || op.memo_type) {
        const type = (op.memo_type || 'MEMO_TEXT') as any;
        const value = op.memo || '';

        // Validate memo format
        if (!validateMemo(value, type)) {
          if (strictMode) {
            throw new Error(`Strict Mode Rejection: Operation ${op.id} has invalid memo "${value}" of type "${type}"`);
          }
          continue; // Skip processing in non-strict mode
        }

        // Validate memo association
        const accountId = resolveAccountByMemo(value, type);
        if (!accountId) {
          if (strictMode) {
            throw new Error(`Strict Mode Rejection: Operation ${op.id} has unknown memo "${value}"`);
          }
          continue; // Skip processing in non-strict mode
        }
      } else if (strictMode) {
        // In strict mode, incoming deposits/payments must have a memo.
        if (op.type === 'payment' || op.type === 'create_account' || op.type === 'path_payment_strict_send' || op.type === 'path_payment_strict_receive') {
          throw new Error(`Strict Mode Rejection: Inbound operation ${op.id} has no memo`);
        }
      }
      validOperations.push(op);
    }

    const totalProcessed = validOperations.length;
    
    // 4. Capture the last entry's paging token as the next safe restart boundary
    const nextCursor = operations[operations.length - 1].paging_token;
    
    // 5. Persist after batch completion
    await saveCursorCheckpoint(this.indexerId, nextCursor);

    return totalProcessed;
  }
}
