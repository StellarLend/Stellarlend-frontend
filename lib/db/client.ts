import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

const isTest = process.env.NODE_ENV === 'test' || typeof vi !== 'undefined' || typeof describe !== 'undefined';
const dbPath = isTest ? ':memory:' : path.resolve(process.cwd(), 'sqlite.db');

// `next build` imports every route module (including this one, transitively)
// from several parallel workers purely to collect metadata -- it never
// actually calls the handlers. Those workers can all reach this same
// on-disk sqlite.db file at once, and schema-changing statements (WAL mode,
// CREATE TABLE) need an exclusive lock, so racing them here reliably throws
// SQLITE_BUSY and fails the build. Skip schema setup during that phase; the
// real dev/production server process still runs it exactly once below.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

export const sqlite = new Database(dbPath);

// Wait (rather than immediately throwing SQLITE_BUSY) when another process
// holds the write lock.
sqlite.pragma('busy_timeout = 15000');

// Enable WAL mode for concurrency outside tests
if (!isTest && !isBuildPhase) {
  sqlite.pragma('journal_mode = WAL');
}

export const db = drizzle(sqlite, { schema });

/**
 * Ensures the database tables exist.
 * Using direct SQL execution makes initialization bulletproof across different
 * runtimes (Next.js server-side, Jest/Vitest test runner) without depending on
 * relative file system paths for migration scripts.
 *
 * Retries on SQLITE_BUSY: multiple Next.js build workers can import this
 * module concurrently against the same on-disk database file, and the
 * `busy_timeout` pragma above doesn't cover the brief window before the very
 * first connection has finished creating the file/journal.
 */
export function initDb() {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      initDbUnsafe();
      return;
    } catch (error) {
      const isBusy =
        error instanceof Error &&
        (error as NodeJS.ErrnoException & { code?: string }).code === 'SQLITE_BUSY';
      if (!isBusy || attempt === maxAttempts) {
        throw error;
      }
      // Brief synchronous backoff before retrying (better-sqlite3 is sync).
      const waitUntil = Date.now() + attempt * 100;
      while (Date.now() < waitUntil) {
        /* busy-wait */
      }
    }
  }
}

function initDbUnsafe() {
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

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      subscribed_at INTEGER NOT NULL
    );
  `);
}

// Initialize tables immediately (skipped during `next build`'s page-data
// collection -- see isBuildPhase above).
if (!isBuildPhase) {
  initDb();
}
