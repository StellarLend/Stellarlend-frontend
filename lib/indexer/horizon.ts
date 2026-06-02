import config from '@/lib/config';
import { logger } from '@/lib/logger';
import { enqueue } from '@/lib/queue';
import type { HorizonOperation, HorizonPage, IndexerOptions } from './types';

export interface HorizonOperation {
  id: string;
  paging_token: string;
  type: string;
  transaction_successful: boolean;
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
    const totalProcessed = operations.length;
    
    // 4. Capture the last entry's paging token as the next safe restart boundary
    const nextCursor = operations[operations.length - 1].paging_token;
    
    // 5. Persist after batch completion
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
