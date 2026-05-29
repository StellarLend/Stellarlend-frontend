import { describe, expect, test, vi, beforeEach, afterAll } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('Config validation', () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear out target env vars from process.env to ensure a clean state
    delete process.env.NEXT_PUBLIC_APP_NAME;
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    delete process.env.NEXT_PUBLIC_APP_ENV;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    delete process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL;
    delete process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
    delete process.env.NEXT_PUBLIC_GA_TRACKING_ID;
    delete process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('production mode: passes with all required vars and allows testing schema validation rules', async () => {
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

    // Test production schema validation rules (should NOT use defaults for missing vars)
    const badEnv1 = { ...process.env, NEXT_PUBLIC_APP_NAME: '' };
    const res1 = envSchema.safeParse(badEnv1);
    expect(res1.success).toBe(false);
    if (!res1.success) {
      expect(res1.error.errors[0].message).toContain('APP_NAME is required');
    }

    const badEnv2 = { ...process.env, NEXT_PUBLIC_API_BASE_URL: 'not-a-url' };
    const res2 = envSchema.safeParse(badEnv2);
    expect(res2.success).toBe(false);
    if (!res2.success) {
      expect(res2.error.errors[0].message).toContain('API_BASE_URL must be a valid URL');
    }
  });

  test('production mode: fails/rejects during import when missing a required var', async () => {
    process.env.NEXT_PUBLIC_APP_NAME = ''; // missing/empty
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.stellar.org';
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = 'https://soroban.stellar.org';

    await expect(import('./configValidation')).rejects.toThrow();
  });

  test('production mode: config builds properly with valid production values', async () => {
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

  test('development mode: config falls back to default values when required vars are missing', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    // Omit NEXT_PUBLIC_APP_NAME, NEXT_PUBLIC_APP_VERSION, etc.

    const configModule = await import('./config');
    const config = configModule.default;

    expect(config.app.environment).toBe('development');
    expect(config.app.name).toBe('Stellarlend'); // Default
    expect(config.app.version).toBe('1.0.0'); // Default
    expect(config.api.baseUrl).toBe('http://localhost:3001'); // Default
    expect(config.stellar.network).toBe('testnet'); // Default
    expect(config.stellar.horizonUrl).toBe('https://horizon-testnet.stellar.org'); // Default
    expect(config.stellar.sorobanRpcUrl).toBe('https://soroban-testnet.stellar.org'); // Default
  });

  test('throws an error if imported without any environment configuration', async () => {
    // Leave all env vars undefined, which triggers validation failure on import
    await expect(import('./configValidation')).rejects.toThrow();
  });
});
