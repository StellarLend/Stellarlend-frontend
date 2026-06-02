import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const ORIGINAL_ENV = { ...process.env };

function resetRelevantEnv() {
  delete process.env.NEXT_PUBLIC_APP_NAME;
  delete process.env.NEXT_PUBLIC_APP_VERSION;
  delete process.env.NEXT_PUBLIC_APP_ENV;
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  delete process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL;
  delete process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ID;
  delete process.env.NEXT_PUBLIC_GA_TRACKING_ID;
  delete process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  delete process.env.PRICE_ORACLE_API_KEY;
  delete process.env.AUTH_SIGNING_SECRET;
  delete process.env.SERVER_TOKEN;
  delete process.env.SOROBAN_RPC_URL;
}

describe('config modules', () => {
  beforeEach(() => {
    vi.resetModules();

    // Clear public env vars
    delete process.env.NEXT_PUBLIC_APP_NAME;
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    delete process.env.NEXT_PUBLIC_APP_ENV;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    delete process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL;
    delete process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
    delete process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ID;
    delete process.env.NEXT_PUBLIC_GA_TRACKING_ID;
    delete process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

    // Clear server env vars
    delete process.env.PRICE_ORACLE_API_KEY;
    delete process.env.AUTH_SIGNING_SECRET;
    delete process.env.SERVER_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it('accepts production public config without NEXT_PUBLIC_SOROBAN_RPC_URL', async () => {
    process.env.NEXT_PUBLIC_APP_NAME = 'Stellarlend Prod';
    process.env.NEXT_PUBLIC_APP_VERSION = '2.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.stellarlend.com';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.stellar.org';

    const { envSchema } = await import('./configValidation');
    const result = envSchema.safeParse(process.env);

    if (!res1.success) {
      expect(res1.error.issues[0].message).toContain(
        'APP_NAME is required'
      );
    }

    const badEnv2 = {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL: 'not-a-url',
    };

    const res2 = envSchema.safeParse(badEnv2);

    expect(res2.success).toBe(false);

    if (!res2.success) {
      expect(res2.error.issues[0].message).toContain(
        'API_BASE_URL must be a valid URL'
      );
    }
  });

  it('rejects invalid production public config', async () => {
    process.env.NEXT_PUBLIC_APP_NAME = '';
    process.env.NEXT_PUBLIC_APP_VERSION = '2.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'not-a-url';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.stellar.org';

    await expect(import('./configValidation')).rejects.toThrow();
  });

  it('keeps public config sanitized for client use', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';

    const configModule = await import('./config');

  it('throws an error if imported without any environment configuration', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'invalid-env';
    await expect(import('./configValidation')).rejects.toThrow();
  });

  it('public config loads defaults when no env vars are defined', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    const configModule = await import('./config');
    const config = configModule.default;

    expect(config.app.name).toBe('Stellarlend');
    expect(config.app.version).toBe('1.0.0');
    expect(config.app.environment).toBe('development');
    expect(config.api.baseUrl).toBe('http://localhost:3001');
    expect(config.stellar.network).toBe('testnet');
    expect(config.stellar.horizonUrl).toBe(
      'https://horizon-testnet.stellar.org'
    );
    expect(config.stellar.sorobanRpcUrl).toBe(
      'https://soroban-testnet.stellar.org'
    );
    expect(config.stellar.sorobanContractId).toBe('');
    expect(config.analytics.googleAnalyticsId).toBeUndefined();
    expect(config.analytics.mixpanelToken).toBeUndefined();
  });

  it('loads public config values from environment variables', async () => {
    process.env.NEXT_PUBLIC_APP_NAME = 'TestApp';
    process.env.NEXT_PUBLIC_APP_VERSION = '2.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.test.com';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.test.com';
    process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ID =
      'GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    process.env.NEXT_PUBLIC_GA_TRACKING_ID = 'UA-TEST-1';
    process.env.NEXT_PUBLIC_MIXPANEL_TOKEN = 'MP-TEST-1';

    const configModule = await import('./config');

    expect(configModule.default.app.name).toBe('TestApp');
    expect(configModule.default.api.baseUrl).toBe('https://api.test.com');
    expect(configModule.default.stellar.network).toBe('public');
    expect(configModule.default.stellar.horizonUrl).toBe('https://horizon.test.com');
    expect(configModule.default.stellar.sorobanContractId).toBe(
      'GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    );
    expect(configModule.publicConfig.stellar).toEqual({
      network: 'public',
      horizonUrl: 'https://horizon.test.com',
    });
  });

  it('loads server config values from environment variables', async () => {
    process.env.PRICE_ORACLE_API_KEY = 'oracle-key-123';
    process.env.AUTH_SIGNING_SECRET = 'signing-secret-456';
    process.env.SERVER_TOKEN = 'server-token-789';
    process.env.SOROBAN_RPC_URL = 'https://rpc.stellarlend.example';

    const serverConfigModule = await import('./server-config');

    expect(serverConfig.oracle.apiKey).toBe('oracle-key-123');
    expect(serverConfig.auth.signingSecret).toBe('signing-secret-456');
    expect(serverConfig.server.token).toBe('server-token-789');
  });

  it('server config loads horizon URLs from STELLAR_HORIZON_URLS', async () => {
    vi.resetModules();
    process.env.STELLAR_HORIZON_URLS = 'https://primary.example.com,https://secondary.example.com/';

    const serverConfigModule = await import('./server-config');
    const serverConfig = serverConfigModule.default;

    expect(serverConfig.horizon.urls).toEqual([
      'https://primary.example.com',
      'https://secondary.example.com',
    ]);
    expect(serverConfig.horizon.primaryUrl).toBe('https://primary.example.com');

    delete process.env.STELLAR_HORIZON_URLS;
  });

  it('server config falls back to empty strings when env vars are missing', async () => {
    const serverConfigModule = await import('./server-config');
    const serverConfig = serverConfigModule.default;

    expect(serverConfig.oracle.apiKey).toBe('');
    expect(serverConfig.auth.signingSecret).toBe('');
    expect(serverConfig.server.token).toBe('');
  });

  it('server config throws an error if window is defined (browser environment)', async () => {
    vi.stubGlobal('window', {});

    await expect(import('./server-config')).rejects.toThrow(
      'Internal Error: server-config.ts cannot be imported on the client side.'
    );
  });

  it('falls back to the testnet Soroban RPC URL outside production', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';

    const serverConfigModule = await import('./server-config');

    expect(serverConfigModule.default.stellar.sorobanRpcUrl).toBe(
      'https://soroban-testnet.stellar.org',
    );
  });

  it('requires SOROBAN_RPC_URL in production', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production';

    await expect(import('./server-config')).rejects.toThrow(
      'SOROBAN_RPC_URL is required in production.',
    );
  });

  it('rejects invalid SOROBAN_RPC_URL values', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    process.env.SOROBAN_RPC_URL = 'not-a-url';

    await expect(import('./server-config')).rejects.toThrow(
      'SOROBAN_RPC_URL must be a valid URL.',
    );
  });

  it('blocks server-config from browser environments', async () => {
    vi.stubGlobal('window', {});
    process.env.SOROBAN_RPC_URL = 'https://rpc.stellarlend.example';

    await expect(import('./server-config')).rejects.toThrow(
      'Internal Error: server-config.ts cannot be imported on the client side.',
    );
  });
});
