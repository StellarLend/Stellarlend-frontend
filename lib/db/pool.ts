import { Pool, type PoolConfig } from 'pg';
import { logger } from '@/lib/logger';

export function buildSslConfig(): PoolConfig['ssl'] {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    return false;
  }

  if (process.env.DATABASE_SSL_INSECURE === 'true') {
    logger.warn('DATABASE_SSL_INSECURE is enabled — TLS certificate verification is disabled. Do not use in production without explicit sign-off.');
    return { rejectUnauthorized: false };
  }

  const ca = process.env.DATABASE_CA_CERT;
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSslConfig(),
});

export default pool;
