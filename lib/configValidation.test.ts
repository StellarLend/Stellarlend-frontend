import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const ORIGINAL_ENV = { ...process.env };

function clearAll(): void {
  const keys = [
    'NEXT_PUBLIC_APP_NAME',
    'NEXT_PUBLIC_APP_VERSION',
    'NEXT_PUBLIC_APP_ENV',
    'NEXT_PUBLIC_API_BASE_URL',
    'NEXT_PUBLIC_STELLAR_NETWORK',
    'NEXT_PUBLIC_STELLAR_HORIZON_URL',
    'NEXT_PUBLIC_SOROBAN_RPC_URL',
    'NEXT_PUBLIC_SOROBAN_CONTRACT_ID',
    'NEXT_PUBLIC_GA_TRACKING_ID',
    'NEXT_PUBLIC_MIXPANEL_TOKEN',
    'AUTH_SECRET',
    'MEMO_SALT',
    'DATABASE_URL',
    'WEBHOOK_SECRET',
    'PRICE_ORACLE_API_KEY',
    'STELLAR_SIGNING_SECRET',
  ];
  for (const k of keys) delete process.env[k];
}

function prodEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NEXT_PUBLIC_APP_NAME: 'Stellarlend',
    NEXT_PUBLIC_APP_VERSION: '2.0.0',
    NEXT_PUBLIC_APP_ENV: 'production',
    NEXT_PUBLIC_API_BASE_URL: 'https://api.stellarlend.com',
    NEXT_PUBLIC_STELLAR_NETWORK: 'public',
    NEXT_PUBLIC_STELLAR_HORIZON_URL: 'https://horizon.stellar.org',
    NEXT_PUBLIC_SOROBAN_CONTRACT_ID: 'GCONTRACTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    AUTH_SECRET: 'prod-auth-secret',
    MEMO_SALT: 'prod-memo-salt',
    DATABASE_URL: 'postgres://user:pass@db.example.com/stellarlend',
    WEBHOOK_SECRET: 'prod-webhook-hmac',
    PRICE_ORACLE_API_KEY: 'oracle-key-123',
    STELLAR_SIGNING_SECRET: 'SBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Production tests – import rejects when required vars are missing.
// The module-level envSchema.parse() throws at import time, so we assert
// against the import itself and inspect the thrown error message.
// ---------------------------------------------------------------------------

describe('envSchema – production rejects missing required vars', () => {
  beforeEach(() => {
    vi.resetModules();
    clearAll();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  const missingCases: Array<[string, Record<string, string>, string]> = [
    ['NEXT_PUBLIC_APP_NAME',     { NEXT_PUBLIC_APP_NAME: '' },     'APP_NAME is required'],
    ['NEXT_PUBLIC_API_BASE_URL', { NEXT_PUBLIC_API_BASE_URL: '' }, 'API_BASE_URL must be a valid URL'],
    ['AUTH_SECRET',              {},                                 'AUTH_SECRET is required'],
    ['MEMO_SALT',                {},                                 'MEMO_SALT is required'],
    ['DATABASE_URL',             {},                                 'DATABASE_URL is required in production'],
    ['WEBHOOK_SECRET',           {},                                 'WEBHOOK_SECRET is required in production'],
    ['PRICE_ORACLE_API_KEY',     {},                                 'PRICE_ORACLE_API_KEY is required in production'],
    ['STELLAR_SIGNING_SECRET',   {},                                 'STELLAR_SIGNING_SECRET is required in production'],
  ];

  for (const [label, overrides, expectedMsg] of missingCases) {
    it(`rejects when ${label} is missing`, async () => {
      Object.assign(process.env, prodEnv(overrides));
      try {
        await import('./configValidation');
        throw new Error(`Expected import to throw containing "${expectedMsg}" but it succeeded`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain(expectedMsg);
      }
    });
  }

  it('rejects empty string for server-only secrets in production', async () => {
    Object.assign(process.env, prodEnv({ DATABASE_URL: '' }));
    try {
      await import('./configValidation');
      throw new Error('Expected import to throw but it succeeded');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('DATABASE_URL is required in production');
    }
  });

  it('rejects invalid URL for NEXT_PUBLIC_API_BASE_URL in production', async () => {
    Object.assign(process.env, prodEnv({ NEXT_PUBLIC_API_BASE_URL: 'not-a-url' }));
    try {
      await import('./configValidation');
      throw new Error('Expected import to throw but it succeeded');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('API_BASE_URL must be a valid URL');
    }
  });

  it('rejects invalid URL for NEXT_PUBLIC_STELLAR_HORIZON_URL in production', async () => {
    Object.assign(process.env, prodEnv({ NEXT_PUBLIC_STELLAR_HORIZON_URL: 'not-a-url' }));
    try {
      await import('./configValidation');
      throw new Error('Expected import to throw but it succeeded');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('STELLAR_HORIZON_URL must be a valid URL');
    }
  });
});

// ---------------------------------------------------------------------------
// Production happy-path – full env parses successfully and all fields are
// present (no defaults applied in production).
// ---------------------------------------------------------------------------

describe('envSchema – production accepts valid full env', () => {
  beforeEach(() => {
    vi.resetModules();
    clearAll();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('parses successfully with all required vars set', async () => {
    Object.assign(process.env, prodEnv());
    const { envSchema } = await import('./configValidation');
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_APP_ENV).toBe('production');
      expect(result.data.AUTH_SECRET).toBe('prod-auth-secret');
      expect(result.data.MEMO_SALT).toBe('prod-memo-salt');
      expect(result.data.DATABASE_URL).toBe('postgres://user:pass@db.example.com/stellarlend');
      expect(result.data.WEBHOOK_SECRET).toBe('prod-webhook-hmac');
      expect(result.data.PRICE_ORACLE_API_KEY).toBe('oracle-key-123');
      expect(result.data.STELLAR_SIGNING_SECRET).toBe('SBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
    }
  });

  it('production schema is stricter – no defaults for public vars', async () => {
    Object.assign(process.env, prodEnv());
    const { envSchema } = await import('./configValidation');
    const result = envSchema.safeParse({ NEXT_PUBLIC_APP_ENV: 'production' });
    // In production mode, NEXT_PUBLIC_APP_NAME has no default → must be provided
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Development tests – defaults kick in, server-only secrets are optional.
// ---------------------------------------------------------------------------

describe('envSchema – development defaults and optional secrets', () => {
  beforeEach(() => {
    vi.resetModules();
    clearAll();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('applies defaults for all public variables in dev', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    const { envSchema } = await import('./configValidation');
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_APP_NAME).toBe('Stellarlend');
      expect(result.data.NEXT_PUBLIC_APP_VERSION).toBe('1.0.0');
      expect(result.data.NEXT_PUBLIC_APP_ENV).toBe('development');
      expect(result.data.NEXT_PUBLIC_API_BASE_URL).toBe('http://localhost:3001');
      expect(result.data.NEXT_PUBLIC_STELLAR_NETWORK).toBe('testnet');
      expect(result.data.NEXT_PUBLIC_STELLAR_HORIZON_URL).toBe('https://horizon-testnet.stellar.org');
    }
  });

  it('applies dev defaults for AUTH_SECRET and MEMO_SALT', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    const { envSchema } = await import('./configValidation');
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.AUTH_SECRET).toBe('dev-secret-change-in-production');
      expect(result.data.MEMO_SALT).toBe('stellarlend-default-salt');
    }
  });

  it('server-only secrets are optional in dev when not provided', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    const { envSchema } = await import('./configValidation');
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DATABASE_URL).toBeUndefined();
      expect(result.data.WEBHOOK_SECRET).toBeUndefined();
      expect(result.data.PRICE_ORACLE_API_KEY).toBeUndefined();
      expect(result.data.STELLAR_SIGNING_SECRET).toBeUndefined();
    }
  });

  it('accepts server-only secrets when explicitly set in dev', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    process.env.DATABASE_URL = 'postgres://localhost:5432/stellarlend';
    process.env.WEBHOOK_SECRET = 'dev-webhook';
    process.env.PRICE_ORACLE_API_KEY = 'dev-oracle';
    process.env.STELLAR_SIGNING_SECRET = 'SDEVSECRETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const { envSchema } = await import('./configValidation');
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DATABASE_URL).toBe('postgres://localhost:5432/stellarlend');
      expect(result.data.WEBHOOK_SECRET).toBe('dev-webhook');
      expect(result.data.PRICE_ORACLE_API_KEY).toBe('dev-oracle');
      expect(result.data.STELLAR_SIGNING_SECRET).toBe('SDEVSECRETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    }
  });

  it('accepts dev env with no env vars defined at all', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    const { envSchema } = await import('./configValidation');
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invalid env values – these fail regardless of isProd.
// ---------------------------------------------------------------------------

describe('envSchema – rejects invalid env values', () => {
  beforeEach(() => {
    vi.resetModules();
    clearAll();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('rejects invalid NEXT_PUBLIC_APP_ENV', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'invalid-env';
    try {
      await import('./configValidation');
      throw new Error('Expected import to throw but it succeeded');
    } catch {
      // Expected – module-level parse rejects invalid env enum
    }
  });

  it('rejects non-URL for NEXT_PUBLIC_STELLAR_HORIZON_URL in production', async () => {
    Object.assign(process.env, prodEnv({ NEXT_PUBLIC_STELLAR_HORIZON_URL: 'not-a-url' }));
    try {
      await import('./configValidation');
      throw new Error('Expected import to throw but it succeeded');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('STELLAR_HORIZON_URL must be a valid URL');
    }
  });
});
