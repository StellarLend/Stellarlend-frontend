import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveDbSslConfig } from './pool-config';

describe('resolveDbSslConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps local non-production connections unchanged', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveDbSslConfig({ NODE_ENV: 'development' })).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('verifies production database certificates by default', () => {
    expect(resolveDbSslConfig({ NODE_ENV: 'production' })).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('requires an explicit insecure flag before disabling certificate verification', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveDbSslConfig({
      DATABASE_SSL_INSECURE: 'true',
      NODE_ENV: 'production',
    })).toEqual({
      rejectUnauthorized: false,
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DATABASE_SSL_INSECURE=true'));
  });

  it('uses a provided CA certificate while keeping verification enabled', () => {
    expect(resolveDbSslConfig({
      DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\\nabc123\\n-----END CERTIFICATE-----',
      NODE_ENV: 'production',
    })).toEqual({
      ca: '-----BEGIN CERTIFICATE-----\nabc123\n-----END CERTIFICATE-----',
      rejectUnauthorized: true,
    });
  });

  it('does not treat false-like insecure flag values as opt-in', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveDbSslConfig({
      DATABASE_SSL_INSECURE: 'false',
      NODE_ENV: 'production',
    })).toEqual({
      rejectUnauthorized: true,
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
