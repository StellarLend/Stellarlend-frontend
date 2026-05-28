import { describe, expect, test, vi } from 'vitest';
import { envSchema, validatedEnv } from './configValidation';

const ORIGINAL_ENV = process.env;

describe('Config validation', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('passes with all required vars', () => {
    process.env.NEXT_PUBLIC_APP_NAME = 'Stellarlend';
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.stellar.org';
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = 'https://soroban.stellar.org';

    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(true);
  });

  test('fails when missing required var', () => {
    process.env.NEXT_PUBLIC_APP_NAME = '';
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.stellar.org';
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = 'https://soroban.stellar.org';

    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('APP_NAME is required');
    }
  });

  test('fails on invalid URL', () => {
    process.env.NEXT_PUBLIC_APP_NAME = 'Stellarlend';
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0';
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'not-a-url';
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://horizon.stellar.org';
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = 'https://soroban.stellar.org';

    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('API_BASE_URL must be a valid URL');
    }
  });
});
