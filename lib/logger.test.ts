import { describe, expect, it } from 'vitest';
import { formatLog, redactSensitiveData } from '@/lib/logger';

describe('logger redaction', () => {
  it('redacts sensitive keys and nested values', () => {
    const input = {
      authorization: 'Bearer secret-token',
      password: 'super-secret',
      profile: {
        apiKey: '12345',
        nested: {
          refresh_token: 'refresh-me',
        },
      },
    };

    const output = redactSensitiveData(input);

    expect(output).toEqual({
      authorization: '[REDACTED]',
      password: '[REDACTED]',
      profile: {
        apiKey: '[REDACTED]',
        nested: {
          refresh_token: '[REDACTED]',
        },
      },
    });
  });

  it('redacts Stellar public and secret keys inside strings', () => {
    const input = {
      address: `G${'A'.repeat(55)}`,
      secret: `S${'B'.repeat(55)}`,
      message: 'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9',
    };

    const output = redactSensitiveData(input) as Record<string, string>;

    expect(output.address).not.toContain(input.address);
    expect(output.address).toContain('[REDACTED_ADDRESS]');
    expect(output.secret).not.toContain(input.secret);
    expect(output.secret).toContain('[REDACTED_SECRET]');
    expect(output.message).not.toContain('Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(output.message).toContain('[REDACTED_TOKEN]');
  });
});

describe('formatLog', () => {
  it('returns valid JSON with structured log fields', () => {
    const entry = {
      level: 'info' as const,
      route: '/api/test',
      message: 'Test event',
      status: 200,
      durationMs: 75,
      context: {
        data: 'value',
        authorization: 'Bearer secret',
      },
    };

    const result = formatLog(entry);
    const parsed = JSON.parse(result);

    expect(parsed).toEqual({
      timestamp: parsed.timestamp,
      level: 'info',
      route: '/api/test',
      message: 'Test event',
      status: 200,
      durationMs: 75,
      context: {
        data: 'value',
        authorization: '[REDACTED]',
      },
    });
    expect(typeof parsed.timestamp).toBe('string');
  });
});
