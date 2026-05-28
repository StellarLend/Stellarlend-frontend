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
    sorobanRpcUrl: string;
  };
  analytics: {
    googleAnalyticsId?: string;
    mixpanelToken?: string;
  };
}

// Determine if we are in a production build. NEXT_PUBLIC_APP_ENV is validated to be one of the allowed values.
const isProd = validatedEnv.NEXT_PUBLIC_APP_ENV === 'production';

const config: Config = {
  app: {
    name: isProd ? validatedEnv.NEXT_PUBLIC_APP_NAME : (process.env.NEXT_PUBLIC_APP_NAME || 'Stellarlend'),
    version: isProd ? validatedEnv.NEXT_PUBLIC_APP_VERSION : (process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'),
    environment: validatedEnv.NEXT_PUBLIC_APP_ENV,
  },
  api: {
    baseUrl: isProd ? validatedEnv.NEXT_PUBLIC_API_BASE_URL : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'),
    timeout: 10000,
  },
  stellar: {
    network: isProd ? validatedEnv.NEXT_PUBLIC_STELLAR_NETWORK : (process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet'),
    horizonUrl: isProd ? validatedEnv.NEXT_PUBLIC_STELLAR_HORIZON_URL : (process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'),
    sorobanRpcUrl: isProd ? validatedEnv.NEXT_PUBLIC_SOROBAN_RPC_URL : (process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'),
  },
  analytics: {
    googleAnalyticsId: process.env.NEXT_PUBLIC_GA_TRACKING_ID,
    mixpanelToken: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
  },
};


export default config;