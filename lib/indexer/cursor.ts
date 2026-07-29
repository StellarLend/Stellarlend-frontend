import { client } from '../db/index';

// Ensures the table exists without relying on external migration scripts.
const initDb = async () => {
  await client`
    CREATE TABLE IF NOT EXISTS indexer_cursors (
      id TEXT PRIMARY KEY,
      paging_token TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
};
initDb().catch(console.error);

export interface IndexerCursor {
  id: string;
  pagingToken: string;
  updatedAt: Date;
}

export async function getLatestCursor(indexerId: string): Promise<string | null> {
  const result = await client`
    SELECT paging_token FROM indexer_cursors WHERE id = ${indexerId}
  `;
  return result.length > 0 ? result[0].paging_token : null;
}

export async function saveCursorCheckpoint(indexerId: string, pagingToken: string): Promise<void> {
  if (!pagingToken) {
    throw new Error("Invalid paging token provided for checkpointing.");
  }
  
  await client`
    INSERT INTO indexer_cursors (id, paging_token, updated_at)
    VALUES (${indexerId}, ${pagingToken}, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE 
    SET paging_token = EXCLUDED.paging_token, 
        updated_at = CURRENT_TIMESTAMP;
  `;
}

export async function clearMockCursors(): Promise<void> {
  if (process.env.NODE_ENV === 'test' || typeof process.env.VITEST !== 'undefined') {
    await client`TRUNCATE TABLE indexer_cursors;`;
  }
}
