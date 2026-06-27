import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock pg so no real DB connection is needed
vi.mock('pg', () => {
  const Pool = vi.fn().mockImplementation(() => ({}));
  return { Pool };
});

// Mock logger to capture warnings
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn() },
}));

describe('buildSslConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns false in non-production', async () => {
    process.env.NODE_ENV = 'development';
    const { buildSslConfig } = await import('@/lib/db/pool');
    expect(buildSslConfig()).toBe(false);
  });

  it('returns { rejectUnauthorized: true } in production by default', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_SSL_INSECURE;
    delete process.env.DATABASE_CA_CERT;
    const { buildSslConfig } = await import('@/lib/db/pool');
    expect(buildSslConfig()).toEqual({ rejectUnauthorized: true });
  });

  it('includes ca when DATABASE_CA_CERT is set in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_CA_CERT = '-----BEGIN CERTIFICATE-----\nMIIBxxx\n-----END CERTIFICATE-----';
    delete process.env.DATABASE_SSL_INSECURE;
    const { buildSslConfig } = await import('@/lib/db/pool');
    expect(buildSslConfig()).toEqual({
      rejectUnauthorized: true,
      ca: process.env.DATABASE_CA_CERT,
    });
  });

  it('disables verification when DATABASE_SSL_INSECURE=true and emits a warning', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_SSL_INSECURE = 'true';
    delete process.env.DATABASE_CA_CERT;
    const { buildSslConfig } = await import('@/lib/db/pool');
    const { logger } = await import('@/lib/logger');
    expect(buildSslConfig()).toEqual({ rejectUnauthorized: false });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('ignores DATABASE_SSL_INSECURE=true in non-production (returns false)', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_SSL_INSECURE = 'true';
    const { buildSslConfig } = await import('@/lib/db/pool');
    expect(buildSslConfig()).toBe(false);
  });
});
