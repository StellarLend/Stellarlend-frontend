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
  };
  redisUrl: string;
}

function parseHorizonUrls(rawValue?: string): string[] {
  const rawList = rawValue?.trim() || '';
  const urls = rawList
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeUrl);

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
  },
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};

export const AUDIT_RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS ?? '30');
export const SESSION_RETENTION_DAYS = Number(process.env.SESSION_RETENTION_DAYS ?? '30');
export const SNAPSHOT_RETENTION_DAYS = Number(process.env.SNAPSHOT_RETENTION_DAYS ?? '30');

export default serverConfig;
export const ENABLE_CHAOS_INJECTION = process.env.ENABLE_CHAOS_INJECTION === 'true';