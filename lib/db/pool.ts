import { Pool } from 'pg';

import { resolveDbSslConfig } from './pool-config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveDbSslConfig(),
});

export default pool;
