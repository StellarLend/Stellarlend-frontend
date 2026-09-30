import { describe, it, expect, vi, afterEach } from 'vitest';
import { clientLog } from './client-log';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_DISABLE_CLIENT_LOGS;
});

describe('clientLog', () => {
  it('masks Stellar addresses and sensitive numeric fields', () => {
    const payload = {
      address: 'GABCDEF1234567890ABCDEFGH1234567890ABCDEFGH1234567890',
      amount: 1234.56,
      nested: {
        recipient: 'GXYZ1234567890ABCDEFGH1234567890ABCDEFGH1234567890',
        fee: 3.25,
      },
      safe: 'visible',
    };

    const redacted = clientLog.redact(payload);

    expect(redacted.amount).toBe('[REDACTED]');
    expect(redacted.safe).toBe('visible');
    expect(redacted.nested.fee).toBe('[REDACTED]');
    expect(redacted.address).toMatch(/^[A-Z2-7]{4}\.\.\.[A-Z2-7]{4}$/);
    expect(redacted.nested.recipient).toMatch(/^[A-Z2-7]{4}\.\.\.[A-Z2-7]{4}$/);
  });

  it('redacts known sensitive keys even when the values are not strings', () => {
    const redacted = clientLog.redact({
      walletAddress: 'GABCDEF1234567890ABCDEFGH1234567890ABCDEFGH1234567890',
      balance: 42,
      publicKey: 'GXYZ1234567890ABCDEFGH1234567890ABCDEFGH1234567890',
      status: 'ok',
    });

    expect(redacted.walletAddress).toBe('[REDACTED_ADDRESS]');
    expect(redacted.balance).toBe('[REDACTED]');
    expect(redacted.publicKey).toBe('[REDACTED_ADDRESS]');
    expect(redacted.status).toBe('ok');
  });

  it('does not log in production mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    clientLog.warn('hello', { address: 'GABCDEF1234567890ABCDEFGH1234567890ABCDEFGH1234567890' });

    expect(consoleSpy).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('preserves non-string values and arrays', () => {
    const redacted = clientLog.redact({
      count: 2,
      tags: ['alpha', 'beta'],
      nested: [{ amount: 100 }, { safe: 'value' }],
    });

    expect(redacted).toEqual({
      count: 2,
      tags: ['alpha', 'beta'],
      nested: [{ amount: '[REDACTED]' }, { safe: 'value' }],
    });
  });
});
