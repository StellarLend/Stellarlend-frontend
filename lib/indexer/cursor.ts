// Mocking a database connection layer for indexer_cursors table tracking
export interface IndexerCursor {
  id: string;
  pagingToken: string;
  updatedAt: Date;
}

// Global in-memory representation mimicking transactional storage behavior
const dbMockStore = new Map<string, string>();

export async function getLatestCursor(indexerId: string): Promise<string | null> {
  return dbMockStore.get(indexerId) || null;
}

export async function saveCursorCheckpoint(indexerId: string, pagingToken: string): Promise<void> {
  if (!pagingToken) {
    throw new Error("Invalid paging token provided for checkpointing.");
  }
  // Simulates a transactional upsert on the indexer_cursors table
  dbMockStore.set(indexerId, pagingToken);
}

export function clearMockCursors(): void {
  dbMockStore.clear();
}
