import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

const isTest = process.env.NODE_ENV === 'test' || typeof vi !== 'undefined' || typeof describe !== 'undefined';
const dbPath = isTest ? ':memory:' : path.resolve(process.cwd(), 'sqlite.db');

export const sqlite = new Database(dbPath);

// Enable WAL mode for concurrency outside tests
if (!isTest) {
  sqlite.pragma('journal_mode = WAL');
}

export const db = drizzle(sqlite, { schema });

/**
 * Ensures the database tables exist.
 * Using direct SQL execution makes initialization bulletproof across different
 * runtimes (Next.js server-side, Jest/Vitest test runner) without depending on
 * relative file system paths for migration scripts.
 */
export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      userId TEXT PRIMARY KEY,
      displayName TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      timezone TEXT NOT NULL DEFAULT 'UTC',
      updatedAt INTEGER NOT NULL
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS outbox_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      attempts INTEGER NOT NULL DEFAULT 0,
      lastError TEXT,
      createdAt INTEGER NOT NULL,
      processedAt INTEGER
    );
  `);
}

// Initialize tables immediately
initDb();
