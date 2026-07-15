import crypto from 'crypto';
import {
  hashIp,
  redactAuditPayload,
  appendAuditEvent,
  getAuditEvents,
  clearAuditEventsForTests,
  emitAuditEvent,
  type AuditEvent,
  type AuditAction,
} from '../logger';

describe('hashIp', () => {
  it('returns null for null/undefined/empty', () => {
    expect(hashIp(null)).toBeNull();
    expect(hashIp(undefined)).toBeNull();
    expect(hashIp('')).toBeNull();
  });

  it('returns a 64-char hex string (sha256)', () => {
    const h = hashIp('192.0.2.1');
    expect(h).not.toBeNull();
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(hashIp('10.0.0.1')).toBe(hashIp('10.0.0.1'));
  });

  it('produces a different hash for a different input', () => {
    expect(hashIp('10.0.0.1')).not.toBe(hashIp('10.0.0.2'));
  });

  it('matches an equivalent crypto.sha256 call', () => {
    const ip = '198.51.100.7';
    const expected = crypto.createHash('sha256').update(ip).digest('hex');
    expect(hashIp(ip)).toBe(expected);
  });
});

describe('redactAuditPayload', () => {
  it('drops blocked keys: password, token, secret, transaction, signedEnvelopeXdr', () => {
    const out = redactAuditPayload({
      actor: 'shinzo',
      password: 'p4ss',
      token: 'tk',
      secret: 's',
      transaction: 'tx',
      signedEnvelopeXdr: 'xdr',
      keep: 'yes',
    });
    expect(out).toEqual({ actor: 'shinzo', keep: 'yes' });
  });

  it('keeps all keys when none are blocked', () => {
    const out = redactAuditPayload({ a: 1, b: 'two', c: [3] });
    expect(out).toEqual({ a: 1, b: 'two', c: [3] });
  });

  it('returns an empty object when every key is blocked', () => {
    expect(redactAuditPayload({ password: 'x', token: 'y' })).toEqual({});
  });

  it('handles an empty input object', () => {
    expect(redactAuditPayload({})).toEqual({});
  });
});

describe('appendAuditEvent / getAuditEvents / clearAuditEventsForTests', () => {
  beforeEach(() => clearAuditEventsForTests());
  afterAll(() => clearAuditEventsForTests());

  it('stores and returns the appended event with a createdAt ISO timestamp', async () => {
    const before = new Date().toISOString();
    const row = await appendAuditEvent({
      action: 'admin.user.view',
      resource: 'user:abc',
      status: 'success',
      actorWallet: 'GABC',
    });
    const after = new Date().toISOString();
    expect(row.createdAt).toMatch(/T/);
    expect(row.createdAt >= before && row.createdAt <= after).toBe(true);
    expect(getAuditEvents()).toHaveLength(1);
    expect(getAuditEvents()[0].action).toBe('admin.user.view');
  });

  it('returns a defensive copy from getAuditEvents (mutating result does not affect internal store)', async () => {
    await appendAuditEvent({ action: 'x', resource: 'r', status: 'success' });
    const events = getAuditEvents();
    events.push({ action: 'mutated', resource: 'r', status: 'success', createdAt: '' } as AuditEvent);
    expect(getAuditEvents()).toHaveLength(1);
  });

  it('clears the store via clearAuditEventsForTests', async () => {
    await appendAuditEvent({ action: 'x', resource: 'r', status: 'success' });
    expect(getAuditEvents()).toHaveLength(1);
    clearAuditEventsForTests();
    expect(getAuditEvents()).toHaveLength(0);
  });
});

describe('emitAuditEvent', () => {
  it('writes a JSON line to stdout with the expected shape', () => {
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation((() => true) as never);
    try {
      const action: AuditAction = 'admin.users.read';
      emitAuditEvent(action, 'actor-1', { q: 'x' });
      expect(writeSpy).toHaveBeenCalledTimes(1);
      const written = String(writeSpy.mock.calls[0][0]);
      expect(written.endsWith('\n')).toBe(true);
      const parsed = JSON.parse(written.trim());
      expect(parsed).toMatchObject({
        type: 'AUDIT',
        action: 'admin.users.read',
        actorId: 'actor-1',
        context: { q: 'x' },
      });
      expect(parsed.timestamp).toMatch(/T/);
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('omits context when not provided', () => {
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation((() => true) as never);
    try {
      emitAuditEvent('admin.users.export', 'actor-2');
      const written = String(writeSpy.mock.calls[0][0]);
      const parsed = JSON.parse(written.trim());
      expect(parsed.context).toBeUndefined();
    } finally {
      writeSpy.mockRestore();
    }
  });
});
