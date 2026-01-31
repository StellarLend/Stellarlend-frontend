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

const config: Config = {
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Stellarlend',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: (process.env.NEXT_PUBLIC_APP_ENV as Config['app']['environment']) || 'development',
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
    timeout: 10000,
  },
  stellar: {
    network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet',
    horizonUrl: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  },
  analytics: {
    googleAnalyticsId: process.env.NEXT_PUBLIC_GA_TRACKING_ID,
    mixpanelToken: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
  },
};

export default config;