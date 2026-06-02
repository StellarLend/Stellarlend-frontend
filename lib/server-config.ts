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
  stellar: {
    sorobanRpcUrl: string;
  };
}

const DEFAULT_SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';

function readSorobanRpcUrl(): string {
  const isProd = process.env.NEXT_PUBLIC_APP_ENV === 'production';
  const rawValue = process.env.SOROBAN_RPC_URL?.trim();

  if (!rawValue) {
    if (isProd) {
      throw new Error('SOROBAN_RPC_URL is required in production.');
    }

    return DEFAULT_SOROBAN_RPC_URL;
  }

  try {
    return new URL(rawValue).toString();
  } catch {
    throw new Error('SOROBAN_RPC_URL must be a valid URL.');
  }
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
  stellar: {
    sorobanRpcUrl: readSorobanRpcUrl(),
  },
};

export default serverConfig;
export const ENABLE_CHAOS_INJECTION = process.env.ENABLE_CHAOS_INJECTION === 'true';
