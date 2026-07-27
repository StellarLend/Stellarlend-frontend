import { describe, it, expect, beforeEach } from 'vitest';
import { clearMockCursors, getLatestCursor } from '../lib/indexer/cursor';
import { HorizonIndexer, HorizonOperation } from '../lib/indexer/horizon';

describe('Horizon Indexer Cursor Checkpointing & Resumability', () => {
  beforeEach(() => {
    clearMockCursors();
  });

  it('should start with a null cursor and save the last paging token after ingestion', async () => {
    const indexer = new HorizonIndexer('lending-operations-indexer');
    
    const mockBatch: HorizonOperation[] = [
      { id: 'op_1', paging_token: '1001', type: 'payment', transaction_successful: true },
      { id: 'op_2', paging_token: '1002', type: 'borrow', transaction_successful: true }
    ];

    const mockFetcher = async (cursor: string | null) => {
      expect(cursor).toBeNull();
      return mockBatch;
    };

    const processedCount = await indexer.fetchAndProcessBatch(mockFetcher);
    expect(processedCount).toBe(2);

    // Verify checkpoint state update
    const finalCursor = await getLatestCursor('lending-operations-indexer');
    expect(finalCursor).toBe('1002');
  });

  it('should resume from the last saved cursor checkpoint state', async () => {
    const indexer = new HorizonIndexer('lending-operations-indexer');
    
    // Pre-seed the cursor store
    const mockBatch: HorizonOperation[] = [
      { id: 'op_3', paging_token: '2005', type: 'deposit', transaction_successful: true }
    ];

    const mockFetcherFirst = async () => mockBatch;
    await indexer.fetchAndProcessBatch(mockFetcherFirst);

    // Execute second batch tracking from the verified state
    const mockFetcherSecond = async (cursor: string | null) => {
      expect(cursor).toBe('2005');
      return [];
    };

    const count = await indexer.fetchAndProcessBatch(mockFetcherSecond);
    expect(count).toBe(0);
  });
});
