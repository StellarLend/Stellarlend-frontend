import config from '@/lib/config';
import { logger } from '@/lib/logger';
import { enqueue } from '@/lib/queue';
import type { HorizonOperation, HorizonPage, IndexerOptions } from './types';

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

/**
 * Schedules an asynchronous account indexing job.
 */
export async function enqueueAccountIndex(accountId: string): Promise<void> {
  await enqueue('indexer', { accountId });
}
