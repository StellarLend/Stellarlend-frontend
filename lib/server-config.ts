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
  sentry: {
    dsn: string;
  };
}

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
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },
};

export const AUDIT_RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS ?? '30');
export const SESSION_RETENTION_DAYS = Number(process.env.SESSION_RETENTION_DAYS ?? '30');
export const SNAPSHOT_RETENTION_DAYS = Number(process.env.SNAPSHOT_RETENTION_DAYS ?? '30');

export default serverConfig;
export const ENABLE_CHAOS_INJECTION = process.env.ENABLE_CHAOS_INJECTION === 'true';