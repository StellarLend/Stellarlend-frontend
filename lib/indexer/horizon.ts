import serverConfig from '@/lib/server-config';
import { httpGet } from '@/lib/http/client';
import {
  HttpError,
  NetworkError,
  RetryExhaustedError,
  TimeoutError,
  UpstreamHttpError,
} from '@/lib/http/errors';
import { HorizonSelector } from '@/lib/http/horizon-selector';
import type { HorizonOperation as RawHorizonOperation, IndexerOptions } from './types';
import { getLatestCursor, saveCursorCheckpoint } from './cursor';
import { enqueue } from '@/lib/queue';

export interface HorizonOperation extends RawHorizonOperation {
  paging_token: string;
}

interface HorizonPage {
  _embedded: {
    records: HorizonOperation[];
  };
  _links: {
    next?: { href: string };
    prev?: { href: string };
    self: { href: string };
  };
}

const horizonSelector = new HorizonSelector(serverConfig.horizon.urls);

export class HorizonIndexer {
  private indexerId: string;
  private horizonUrl: string;

  constructor(indexerId: string, horizonUrl: string = 'https://horizon-testnet.stellar.org') {
    this.indexerId = indexerId;
    this.horizonUrl = horizonUrl;
  }

  async fetchAndProcessBatch(mockPageFetcher: (cursor: string | null) => Promise<HorizonOperation[]>): Promise<number> {
    const lastCursor = await getLatestCursor(this.indexerId);
    const operations = await mockPageFetcher(lastCursor);
    if (operations.length === 0) {
      return 0;
    }

    const totalProcessed = operations.length;
    const nextCursor = operations[operations.length - 1].paging_token;
    await saveCursorCheckpoint(this.indexerId, nextCursor);

    return totalProcessed;
  }
}

export class HorizonError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'HorizonError';
  }
}

function buildOperationsUrl(
  baseUrl: string,
  accountId: string,
  options: IndexerOptions,
  cursor: string | null,
): string {
  const url = new URL(`${baseUrl}/accounts/${accountId}/operations`);
  url.searchParams.set('limit', String(Math.min(Math.max(1, options.limit ?? 200), 200)));
  url.searchParams.set('order', options.order ?? 'desc');
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }
  return url.toString();
}

function rebaseUrl(originalUrl: string, baseUrl: string): string {
  const parsed = new URL(originalUrl);
  const base = new URL(baseUrl);
  parsed.protocol = base.protocol;
  parsed.host = base.host;
  return parsed.toString();
}

async function fetchPage(url: string, timeoutMs: number): Promise<HorizonPage> {
  try {
    return await httpGet<HorizonPage>(url, { timeoutMs, retries: 1, backoffMs: 100 });
  } catch (err) {
    if (err instanceof HttpError) {
      throw new HorizonError(`Horizon failed for ${url}`, err);
    }

    throw new HorizonError(`Horizon failed for ${url}`, err);
  }
}

async function fetchPageWithFailover(url: string, timeoutMs: number): Promise<HorizonPage> {
  const attempted = new Set<string>();
  let lastError: unknown;

  while (attempted.size < horizonSelector.getUrls().length) {
    const endpoint = horizonSelector.selectEndpoint();
    if (attempted.has(endpoint.url)) {
      continue;
    }

    attempted.add(endpoint.url);
    const targetUrl = rebaseUrl(url, endpoint.url);

    try {
      const response = await fetchPage(targetUrl, timeoutMs);
      horizonSelector.recordSuccess(endpoint.url);
      return response;
    } catch (err) {
      horizonSelector.recordFailure(endpoint.url);
      lastError = err;

      if (err instanceof TimeoutError || err instanceof UpstreamHttpError || err instanceof NetworkError || err instanceof RetryExhaustedError) {
        continue;
      }

      throw err;
    }
  }

  throw new HorizonError(
    `All Horizon endpoints failed after ${attempted.size} attempts`,
    lastError,
  );
}

export async function fetchAccountOperations(
  accountId: string,
  options: IndexerOptions = {},
): Promise<HorizonOperation[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 200), 200);
  const maxPages = options.maxPages ?? 5;
  const timeoutMs = options.timeoutMs ?? 8000;
  let cursor = options.cursor ?? null;
  let pageCount = 0;
  const records: HorizonOperation[] = [];

  while (pageCount < maxPages) {
    const requestUrl = buildOperationsUrl(serverConfig.horizon.primaryUrl, accountId, {
      ...options,
      limit,
    },
    cursor);

    const page = await fetchPageWithFailover(requestUrl, timeoutMs);
    const pageRecords = page._embedded?.records ?? [];

    if (!pageRecords.length) {
      break;
    }

    records.push(...pageRecords);
    pageCount += 1;

    if (!page._links.next || pageRecords.length < limit) {
      break;
    }

    cursor = new URL(page._links.next.href).searchParams.get('cursor');
    if (!cursor) {
      break;
    }
  }

  return records;
}

/**
 * Schedules an asynchronous account indexing job.
 */
export async function enqueueAccountIndex(accountId: string): Promise<void> {
  await enqueue('indexer', { accountId });
}
