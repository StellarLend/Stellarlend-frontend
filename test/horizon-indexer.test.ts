import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMockCursors, getLatestCursor, saveCursorCheckpoint } from '../lib/indexer/cursor';
import { HorizonIndexer, HorizonOperation } from '../lib/indexer/horizon';

describe('Horizon Indexer Cursor Checkpointing & Resumability', () => {
  // Await the now-asynchronous database truncation
  beforeEach(async () => {
    await clearMockCursors();
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

    const finalCursor = await getLatestCursor('lending-operations-indexer');
    expect(finalCursor).toBe('1002');
  });

  it('should resume from the last saved cursor checkpoint state', async () => {
    const indexer = new HorizonIndexer('lending-operations-indexer');

    const mockBatch: HorizonOperation[] = [
      { id: 'op_3', paging_token: '2005', type: 'deposit', transaction_successful: true }
    ];

    const mockFetcherFirst = async () => mockBatch;
    await indexer.fetchAndProcessBatch(mockFetcherFirst);

    const mockFetcherSecond = async (cursor: string | null) => {
      expect(cursor).toBe('2005');
      return [];
    };

    const count = await indexer.fetchAndProcessBatch(mockFetcherSecond);
    expect(count).toBe(0);
  });

  it('should survive a simulated process restart (Issue #1121)', async () => {
    // 1. Write the cursor to the real database
    await saveCursorCheckpoint('restart-test-indexer', 'token-9999');

    // 2. Wipe the Vitest module cache (Simulates Node.js server restart and RAM flush)
    vi.resetModules();

    // 3. Dynamically re-import the module (like starting the server fresh)
    const newCursorModule = await import('../lib/indexer/cursor');

    // 4. Assert the cursor was read from Postgres, not RAM
    const cursor = await newCursorModule.getLatestCursor('restart-test-indexer');
    expect(cursor).toBe('token-9999');
  });
});
