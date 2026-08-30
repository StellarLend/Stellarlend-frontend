import { describe, it, expect } from 'vitest';
import {
  parseOutboxPayload,
  OutboxPayloadValidationError,
  MAX_OUTBOX_PAYLOAD_BYTES,
} from '@/lib/validation/outbox';

const validNotification = {
  userId: 'user-1',
  title: 'Deposit Confirmed',
  message: 'Your deposit has been confirmed on-chain.',
  type: 'success',
};

const validAudit = {
  userId: 'user-1',
  action: 'profile_update',
  details: { displayName: 'Alice' },
  timestamp: new Date().toISOString(),
};

describe('parseOutboxPayload', () => {
  it('accepts a valid notification payload', () => {
    const payload = parseOutboxPayload('notification', JSON.stringify(validNotification));
    expect(payload).toEqual(validNotification);
  });

  it('accepts a valid audit payload', () => {
    const payload = parseOutboxPayload('audit', JSON.stringify(validAudit));
    expect(payload).toMatchObject({ userId: 'user-1', action: 'profile_update' });
  });

  it('accepts an optional notification id', () => {
    const withId = { ...validNotification, id: 'notif-123' };
    const payload = parseOutboxPayload('notification', JSON.stringify(withId));
    expect(payload).toMatchObject({ id: 'notif-123' });
  });

  it('rejects payloads that are not valid JSON', () => {
    expect(() => parseOutboxPayload('notification', '{not json')).toThrow(
      OutboxPayloadValidationError
    );
    expect(() => parseOutboxPayload('notification', '{not json')).toThrow('not valid JSON');
  });

  it('rejects empty and non-string payloads', () => {
    expect(() => parseOutboxPayload('notification', '')).toThrow(/payload/i);
    expect(() => parseOutboxPayload('notification', '' as any)).toThrow(/payload/i);
  });

  it('rejects payloads exceeding the size budget', () => {
    const huge = JSON.stringify({
      ...validNotification,
      message: 'x'.repeat(MAX_OUTBOX_PAYLOAD_BYTES),
    });
    expect(() => parseOutboxPayload('notification', huge)).toThrow(/exceeds/);
  });

  it('rejects unknown event types', () => {
    expect(() => parseOutboxPayload('unknown_type', '{}')).toThrow(
      'Unknown event type: unknown_type'
    );
  });

  it('rejects tampered payloads with unknown fields', () => {
    const tampered = { ...validNotification, network: 'mainnet', chainId: 999 };
    expect(() => parseOutboxPayload('notification', JSON.stringify(tampered))).toThrow(
      /Unrecognized keys/
    );
  });

  it('rejects invalid notification type values', () => {
    const bad = { ...validNotification, type: 'malicious' };
    expect(() => parseOutboxPayload('notification', JSON.stringify(bad))).toThrow(
      /invalid notification payload/
    );
  });

  it('rejects payloads missing required identity/content fields', () => {
    expect(() => parseOutboxPayload('notification', JSON.stringify({ title: 'no user' }))).toThrow(
      /invalid notification payload/
    );
  });

  it('rejects over-length content', () => {
    const bad = { ...validNotification, message: 'x'.repeat(2001) };
    expect(() => parseOutboxPayload('notification', JSON.stringify(bad))).toThrow(/exceeds/);
  });

  it('rejects audit payloads with too many detail keys', () => {
    const details: Record<string, unknown> = {};
    for (let i = 0; i < 21; i++) {
      details[`key${i}`] = i;
    }
    const bad = { ...validAudit, details };
    expect(() => parseOutboxPayload('audit', JSON.stringify(bad))).toThrow(/invalid audit payload/);
  });

  it('rejects audit payloads with invalid timestamps', () => {
    const bad = { ...validAudit, timestamp: 'not-a-date' };
    expect(() => parseOutboxPayload('audit', JSON.stringify(bad))).toThrow(/invalid audit payload/);
  });

  it('rejects audit payloads with unknown fields', () => {
    const bad = { ...validAudit, role: 'admin' };
    expect(() => parseOutboxPayload('audit', JSON.stringify(bad))).toThrow(/Unrecognized key/i);
  });

  it('does not mutate the raw payload on success', () => {
    const raw = JSON.stringify(validNotification);
    parseOutboxPayload('notification', raw);
    expect(raw).toBe(JSON.stringify(validNotification));
  });
});
