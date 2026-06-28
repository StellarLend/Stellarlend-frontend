import 'server-only';

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
    cacheInvalidateAllowedOrigins: string[];
  };
  redisUrl: string;
  horizon: {
    urls: string[];
    primaryUrl: string;
  };
  db: {
    url: string;
  };
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function parseCsvList(rawValue?: string): string[] {
  return Array.from(
    new Set(
      (rawValue || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function parseHorizonUrls(rawValue?: string): string[] {
  const urls = parseCsvList(rawValue).map(normalizeUrl);

  return urls.length ? Array.from(new Set(urls)) : ['https://horizon-testnet.stellar.org'];
}

const horizonUrls = parseHorizonUrls(
  process.env.STELLAR_HORIZON_URLS || process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL,
);

const serverConfig: ServerConfig = {
  oracle: {
    apiKey: process.env.PRICE_ORACLE_API_KEY || '',
  },
  auth: {
    signingSecret: process.env.AUTH_SIGNING_SECRET || '',
  },
  server: {
    token: process.env.SERVER_TOKEN || '',
    cacheInvalidateAllowedOrigins: parseCsvList(process.env.CACHE_INVALIDATE_ALLOWED_ORIGINS).map(normalizeUrl),
  },
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  horizon: {
    urls: horizonUrls,
    primaryUrl: horizonUrls[0] || 'https://horizon-testnet.stellar.org',
  },
  db: {
    url: process.env.DATABASE_URL || 'postgres://localhost:5432/stellarlend',
  },
};

export const AUDIT_RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS ?? '30');
export const SESSION_RETENTION_DAYS = Number(process.env.SESSION_RETENTION_DAYS ?? '30');
export const SNAPSHOT_RETENTION_DAYS = Number(process.env.SNAPSHOT_RETENTION_DAYS ?? '30');

export default serverConfig;
export const CIRCUIT_FAILURE_RATE = Number(process.env.CIRCUIT_FAILURE_RATE ?? '0.5');
export const CIRCUIT_MIN_CALLS = Number(process.env.CIRCUIT_MIN_CALLS ?? '20');
export const CIRCUIT_COOLDOWN_MS = Number(process.env.CIRCUIT_COOLDOWN_MS ?? '60000'); // 60 seconds
export const ENABLE_CHAOS_INJECTION = process.env.ENABLE_CHAOS_INJECTION === 'true';
