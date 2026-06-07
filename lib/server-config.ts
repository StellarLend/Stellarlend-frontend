import 'server-only';

// Runtime guard to prevent client-side imports
if (typeof window !== 'undefined') {
  throw new Error('Internal Error: server-config.ts cannot be imported on the client side.');
}

interface ServerConfig {
  oracle: {
    apiKey: string;
  };
  auth: {
    signingSecret: string;
  };
  server: {
    token: string;
  };
  db: {
    connectionString: string;
    max: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
  };
}

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const serverConfig: ServerConfig = {
  oracle: {
    apiKey: process.env.PRICE_ORACLE_API_KEY || '',
  },
  auth: {
    signingSecret: process.env.AUTH_SIGNING_SECRET || '',
  },
  server: {
    token: process.env.SERVER_TOKEN || '',
  },
  db: {
    connectionString: process.env.DATABASE_URL || '',
    max: parseNumber(process.env.DB_POOL_MAX, 20),
    idleTimeoutMs: parseNumber(process.env.DB_POOL_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMs: parseNumber(process.env.DB_POOL_CONNECTION_TIMEOUT_MS, 5000),
  },
};

export default serverConfig;
