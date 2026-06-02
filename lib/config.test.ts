import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const ORIGINAL_ENV = { ...process.env };

describe('Config Modules', () => {
  beforeEach(() => {
    vi.resetModules();

    // Clear relevant env vars to ensure a clean state
    Object.keys(process.env).forEach((key) => {
      if (
        key.startsWith('NEXT_PUBLIC_') ||
        key.startsWith('CONFIG_')
      ) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });
});
    delete process.env.NEXT_PUBLIC_APP_NAME;
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    delete process.env.NEXT_PUBLIC_APP_ENV;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    delete process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL;
    delete process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const ORIGINAL_ENV = { ...process.env };

describe('Config Modules', () => {
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
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it('production mode: passes with all required vars and allows testing schema validation rules', async () => {
    process.env.NEXT_PUBLIC_APP_NAME = 'Stellarlend Prod';
    process.env.NEXT_PUBLIC_APP_VERSION = '2.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.stellarlend.com';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.stellar.org';
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = 'https://soroban.stellar.org';

    const { envSchema } = await import('./configValidation');

    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(true);

    // Test validation rules
    const badEnv1 = { ...process.env, NEXT_PUBLIC_APP_NAME: '' };
    const res1 = envSchema.safeParse(badEnv1);

    expect(res1.success).toBe(false);

    if (!res1.success) {
      expect(res1.error.errors[0].message).toContain(
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
      expect(res2.error.errors[0].message).toContain(
        'API_BASE_URL must be a valid URL'
      );
    }
  });

  it('production mode: fails/rejects during import when missing a required var', async () => {
    process.env.NEXT_PUBLIC_APP_NAME = '';
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.stellar.org';
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = 'https://soroban.stellar.org';

    await expect(import('./configValidation')).rejects.toThrow();
  });

  it('production mode: config builds properly with valid production values', async () => {
    process.env.NEXT_PUBLIC_APP_NAME = 'Stellarlend Prod';
    process.env.NEXT_PUBLIC_APP_VERSION = '2.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.stellarlend.com';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.stellar.org';
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = 'https://soroban.stellar.org';

    const configModule = await import('./config');
    const config = configModule.default;
    const publicConfig = configModule.publicConfig;

    expect(config.app.environment).toBe('production');
    expect(config.app.name).toBe('Stellarlend Prod');
    expect(publicConfig.app.name).toBe('Stellarlend Prod');
    expect(config.stellar.network).toBe('public');
  });

  it('development mode: config falls back to default values when required vars are missing', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';

    const configModule = await import('./config');
    const config = configModule.default;

    expect(config.app.environment).toBe('development');
    expect(config.app.name).toBe('Stellarlend');
    expect(config.app.version).toBe('1.0.0');
    expect(config.api.baseUrl).toBe('http://localhost:3001');
    expect(config.stellar.network).toBe('testnet');
    expect(config.stellar.horizonUrl).toBe(
      'https://horizon-testnet.stellar.org'
    );
    expect(config.stellar.sorobanRpcUrl).toBe(
      'https://soroban-testnet.stellar.org'
    );
  });

  it('throws an error if imported without any environment configuration', async () => {
    await expect(import('./configValidation')).rejects.toThrow();
  });

  it('public config loads defaults when no env vars are defined', async () => {
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

  it('public config loads values from environment variables', async () => {
    process.env.NEXT_PUBLIC_APP_NAME = 'TestApp';
    process.env.NEXT_PUBLIC_APP_VERSION = '2.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.test.com';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.test.com';
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = 'https://rpc.test.com';
    process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ID =
      'GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
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
    expect(config.stellar.sorobanContractId).toBe(
      'GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    );
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
});