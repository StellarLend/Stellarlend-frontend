import { validatedEnv } from './configValidation';

/**
 * Application configuration. Values are sourced from environment variables.
 * In production we enforce explicit values via validation; in development we keep
 * existing fallbacks for convenience.
 */
interface Config {
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
  stellar: {
    network: string;
    horizonUrl: string;
    sorobanContractId: string;
  };
  rateLimit: {
    max: number;
    window: number;
    account: {
      limit: number;
      windowMs: number;
      burst: number;
    };
  };
  analytics: {
    googleAnalyticsId?: string;
    mixpanelToken?: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

const config: Config = {
  app: {
    name: validatedEnv.NEXT_PUBLIC_APP_NAME,
    version: validatedEnv.NEXT_PUBLIC_APP_VERSION,
    environment: validatedEnv.NEXT_PUBLIC_APP_ENV,
  },
  api: {
    baseUrl: validatedEnv.NEXT_PUBLIC_API_BASE_URL,
    timeout: 10000,
  },
  stellar: {
    network:
      validatedEnv.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet',
    horizonUrl:
      validatedEnv.NEXT_PUBLIC_STELLAR_HORIZON_URL ||
      'https://horizon-testnet.stellar.org',
    sorobanContractId:
      process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ID || '',
  },
  analytics: {
    googleAnalyticsId: validatedEnv.NEXT_PUBLIC_GA_TRACKING_ID,
    mixpanelToken: validatedEnv.NEXT_PUBLIC_MIXPANEL_TOKEN,
  },
  logging: {
    level: (process.env.SERVER_LOG_LEVEL as Config['logging']['level']) || 'info',
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    window: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    account: {
      limit: parseInt(process.env.TX_ACCOUNT_RATE_LIMIT_MAX || '30', 10),
      windowMs: parseInt(process.env.TX_ACCOUNT_RATE_LIMIT_WINDOW_MS || '60000', 10),
      burst: parseInt(process.env.TX_ACCOUNT_RATE_LIMIT_BURST || '60', 10),
    },
  },
};

// Shared config that is safe to import from both the server and the client.
export default config;

/**
 * Public config that will be serialized and sent to the client. It contains only
 * the NEXT_PUBLIC_* variables; any server‑only secrets should NOT be added here.
 */
export const publicConfig = {
  app: {
    name: config.app.name,
    version: config.app.version,
    environment: config.app.environment,
  },
  api: {
    baseUrl: config.api.baseUrl,
  },
  stellar: {
    network: config.stellar.network,
    horizonUrl: config.stellar.horizonUrl,
  },
  analytics: {
    googleAnalyticsId: config.analytics.googleAnalyticsId,
    mixpanelToken: config.analytics.mixpanelToken,
  },
} as const;
