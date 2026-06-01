import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

describe('Config Modules', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Clear relevant env vars
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

    delete process.env.PRICE_ORACLE_API_KEY;
    delete process.env.AUTH_SIGNING_SECRET;
    delete process.env.SERVER_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('public config loads defaults when no env vars are defined', async () => {
    const configModule = await import('./config');
    const config = configModule.default;
    
    expect(config.app.name).toBe('Stellarlend');
    expect(config.app.version).toBe('1.0.0');
    expect(config.app.environment).toBe('development');
    expect(config.api.baseUrl).toBe('http://localhost:3001');
    expect(config.stellar.network).toBe('testnet');
    expect(config.stellar.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(config.stellar.sorobanRpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(config.stellar.sorobanContractId).toBe('');
    expect(config.analytics.googleAnalyticsId).toBeUndefined();
    expect(config.analytics.mixpanelToken).toBeUndefined();
  });

  it('public config loads values from environment variables', async () => {
    process.env.NEXT_PUBLIC_APP_NAME = 'TestApp';
    process.env.NEXT_PUBLIC_APP_VERSION = '2.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.test.com';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.test.com';
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = 'https://rpc.test.com';
    process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ID = 'GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    process.env.NEXT_PUBLIC_GA_TRACKING_ID = 'UA-TEST-1';
    process.env.NEXT_PUBLIC_MIXPANEL_TOKEN = 'MP-TEST-1';

    const configModule = await import('./config');
    const config = configModule.default;

    expect(config.app.name).toBe('TestApp');
    expect(config.app.version).toBe('2.0.0');
    expect(config.app.environment).toBe('production');
    expect(config.api.baseUrl).toBe('https://api.test.com');
    expect(config.stellar.network).toBe('public');
    expect(config.stellar.horizonUrl).toBe('https://horizon.test.com');
    expect(config.stellar.sorobanRpcUrl).toBe('https://rpc.test.com');
    expect(config.stellar.sorobanContractId).toBe('GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    expect(config.analytics.googleAnalyticsId).toBe('UA-TEST-1');
    expect(config.analytics.mixpanelToken).toBe('MP-TEST-1');
  });

  it('server config loads secrets from environment variables', async () => {
    process.env.PRICE_ORACLE_API_KEY = 'oracle-key-123';
    process.env.AUTH_SIGNING_SECRET = 'signing-secret-456';
    process.env.SERVER_TOKEN = 'server-token-789';

    const serverConfigModule = await import('./server-config');
    const serverConfig = serverConfigModule.default;

    expect(serverConfig.oracle.apiKey).toBe('oracle-key-123');
    expect(serverConfig.auth.signingSecret).toBe('signing-secret-456');
    expect(serverConfig.server.token).toBe('server-token-789');
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
});
