import { logger } from '@/lib/logger';

export function buildSslConfig(): boolean | Record<string, unknown> {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    return false;
  }

  if (process.env.DATABASE_SSL_INSECURE === 'true') {
    logger.warn('DATABASE_SSL_INSECURE is enabled — TLS certificate verification is disabled. Do not use in production without explicit sign-off.', 'lib/db/pool');
    return { rejectUnauthorized: false };
  }

  const ca = process.env.DATABASE_CA_CERT;
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
}

export interface PgPoolLike {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

function createPool(): PgPoolLike {
  try {
    const pg = require('pg');
    const PoolClass = pg.Pool || pg.default?.Pool;
    if (PoolClass) {
      return new PoolClass({
        connectionString: process.env.DATABASE_URL,
        ssl: buildSslConfig(),
      });
    }
  } catch {
    // pg not available in runtime
  }

  try {
    const postgres = require('postgres');
    const sql = postgres(process.env.DATABASE_URL || 'postgres://localhost:5432/stellarlend', {
      ssl: buildSslConfig(),
    });
    return {
      query: async (queryText: string) => {
        const rows = await sql.unsafe(queryText);
        return { rows: Array.from(rows) };
      },
    };
  } catch {
    return {
      query: async () => {
        throw new Error('No database driver available (pg or postgres)');
      },
    };
  }
}

const pool: PgPoolLike = createPool();

export default pool;
