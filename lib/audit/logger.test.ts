import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  hashIp,
  redactAuditPayload,
  appendAuditEvent,
  getAuditEvents,
  clearAuditEventsForTests,
  emitAuditEvent,
  auditAdminUsersRead,
} from './logger';

/**
 * `lib/audit/logger.ts` is the legacy-facing surface for the transaction and
 * admin audit trail. It is a thin re-export wrapper over the canonical
 * `@/lib/audit`, so these tests assert two things at once: that the wrapper
 * delegates faithfully, and that the underlying redaction / hashing / write
 * behaviour is what incident response can rely on.
 *
 * See `docs/audit-events.md`.
 */

/** A representative Stellar public key. */
const WALLET = 'GBVHELLD2JE235Y2NGTDT3MWI3T65ON6SY4N6FBHYVDAQ5FZC2CP5QXH';

describe('lib/audit/logger', () => {
  beforeEach(() => {
    clearAuditEventsForTests();
  });

  afterEach(() => {
    clearAuditEventsForTests();
    vi.restoreAllMocks();
  });

  describe('hashIp', () => {
    it('returns the sha256 hex digest of an IP', () => {
      // Precomputed: sha256('192.168.1.1')
      expect(hashIp('192.168.1.1')).toBe(
        'c5eb5a4cc76a5cdb16e79864b9ccd26c3553f0c396d0a21bafb7be71c1efcd8c',
      );
    });

    it('produces a 64-character lowercase hex string', () => {
      expect(hashIp('10.0.0.1')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same input', () => {
      expect(hashIp('203.0.113.7')).toBe(hashIp('203.0.113.7'));
    });

    it('maps different IPs to different digests', () => {
      expect(hashIp('203.0.113.7')).not.toBe(hashIp('203.0.113.8'));
    });

    it('never returns the raw IP', () => {
      // The whole point: the stored value must not be reversible by eye.
      expect(hashIp('192.168.1.1')).not.toContain('192.168');
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['an empty string', ''],
    ])('returns null for %s rather than hashing a placeholder', (_label, input) => {
      // Hashing '' would produce a real-looking digest that silently collides
      // across every request with no IP, so null is the correct signal.
      expect(hashIp(input)).toBeNull();
    });

    it('hashes IPv6 addresses too', () => {
      expect(hashIp('2001:db8::1')).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('redactAuditPayload', () => {
    it.each(['password', 'token', 'secret', 'transaction', 'signedEnvelopeXdr'])(
      'strips the %s key',
      (key) => {
        const redacted = redactAuditPayload({ [key]: 'sensitive', keep: 'yes' });

        expect(redacted).not.toHaveProperty(key);
        expect(redacted).toEqual({ keep: 'yes' });
      },
    );

    it('strips several sensitive keys in one pass', () => {
      const redacted = redactAuditPayload({
        password: 'hunter2',
        token: 'eyJhbGciOi',
        secret: 's3cr3t',
        transaction: 'AAAAA',
        signedEnvelopeXdr: 'AAAAAgAA',
        action: 'tx.submit',
        resource: 'transaction',
      });

      expect(redacted).toEqual({ action: 'tx.submit', resource: 'transaction' });
    });

    it('keeps non-sensitive fields untouched', () => {
      const payload = { action: 'tx.submit', status: 'success', requestId: 'req-1' };

      expect(redactAuditPayload(payload)).toEqual(payload);
    });

    it('returns an empty object for an empty payload', () => {
      expect(redactAuditPayload({})).toEqual({});
    });

    it('does not mutate the caller-supplied payload', () => {
      const payload = { password: 'hunter2', action: 'login' };
      redactAuditPayload(payload);

      // The caller may still need the original for the actual operation.
      expect(payload).toEqual({ password: 'hunter2', action: 'login' });
    });

    it('preserves falsy non-sensitive values instead of dropping them', () => {
      const redacted = redactAuditPayload({ count: 0, ok: false, note: '' });

      expect(redacted).toEqual({ count: 0, ok: false, note: '' });
    });

    it('matches keys exactly and case-sensitively', () => {
      // Documents a real limitation: `Token` and `accessToken` are NOT stripped.
      // Callers must use the exact blocked key names for redaction to apply.
      const redacted = redactAuditPayload({
        Token: 'abc',
        accessToken: 'def',
        token: 'ghi',
      });

      expect(redacted).toEqual({ Token: 'abc', accessToken: 'def' });
    });

    it('is shallow — nested sensitive keys survive', () => {
      // Documents a real limitation: redaction only inspects top-level keys, so
      // a nested secret is NOT removed. Flatten before redacting.
      const redacted = redactAuditPayload({
        outer: { password: 'hunter2' },
        token: 'stripped',
      });

      expect(redacted).toEqual({ outer: { password: 'hunter2' } });
    });

    it('does not redact wallet addresses', () => {
      // Documents intent: the wallet is the actor identity for the audit trail,
      // so it is deliberately retained. It is a public key, not a credential.
      const redacted = redactAuditPayload({ actorWallet: WALLET });

      expect(redacted).toEqual({ actorWallet: WALLET });
    });
  });

  describe('appendAuditEvent', () => {
    it('stamps kind and createdAt onto the stored row', async () => {
      const row = await appendAuditEvent({
        actorWallet: WALLET,
        action: 'tx.submit',
        resource: 'transaction',
        status: 'success',
        requestId: 'req-1',
        ipHash: hashIp('192.168.1.1'),
      });

      expect(row.kind).toBe('transaction');
      expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(Number.isNaN(Date.parse(row.createdAt))).toBe(false);
    });

    it('preserves every caller-supplied field', async () => {
      const row = await appendAuditEvent({
        actorWallet: WALLET,
        action: 'tx.submit',
        resource: 'transaction',
        status: 'failure',
        requestId: 'req-42',
        ipHash: 'deadbeef',
      });

      expect(row).toMatchObject({
        actorWallet: WALLET,
        action: 'tx.submit',
        resource: 'transaction',
        status: 'failure',
        requestId: 'req-42',
        ipHash: 'deadbeef',
      });
    });

    it('makes the event retrievable through getAuditEvents', async () => {
      await appendAuditEvent({
        actorWallet: WALLET,
        action: 'tx.submit',
        resource: 'transaction',
        status: 'success',
      });

      const events = getAuditEvents();
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('tx.submit');
    });

    it('accepts a missing actor and a missing request id', async () => {
      // An unauthenticated or pre-session failure must still be auditable.
      const row = await appendAuditEvent({
        actorWallet: null,
        action: 'auth.challenge.issued',
        resource: 'session',
        status: 'failure',
        requestId: null,
        ipHash: null,
      });

      expect(row.actorWallet).toBeNull();
      expect(row.requestId).toBeNull();
      expect(row.kind).toBe('transaction');
      expect(getAuditEvents()).toHaveLength(1);
    });

    it('appends in call order', async () => {
      for (const action of ['a', 'b', 'c']) {
        await appendAuditEvent({
          actorWallet: WALLET,
          action,
          resource: 'transaction',
          status: 'success',
        });
      }

      expect(getAuditEvents().map((e) => e.action)).toEqual(['a', 'b', 'c']);
    });

    it('records both success and failure outcomes', async () => {
      await appendAuditEvent({
        actorWallet: WALLET, action: 'tx.submit', resource: 'transaction', status: 'success',
      });
      await appendAuditEvent({
        actorWallet: WALLET, action: 'tx.submit', resource: 'transaction', status: 'failure',
      });

      expect(getAuditEvents().map((e) => e.status)).toEqual(['success', 'failure']);
    });
  });

  describe('emitAdminAuditEvent (via emitAuditEvent)', () => {
    it('writes a single JSON line to the stdout sink', () => {
      const sink = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      emitAuditEvent('admin.users.read', 'admin-1', { page: 2 });

      expect(sink).toHaveBeenCalledTimes(1);
      const written = sink.mock.calls[0][0] as string;
      expect(written.endsWith('\n')).toBe(true);
      expect(written.slice(0, -1)).not.toContain('\n');
    });

    it('shapes the record with type, action, actor, timestamp, and context', () => {
      const sink = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      emitAuditEvent('admin.user.update', 'admin-7', { userId: 'u-9' });

      const event = JSON.parse((sink.mock.calls[0][0] as string).trim());
      expect(event).toMatchObject({
        type: 'AUDIT',
        action: 'admin.user.update',
        actorId: 'admin-7',
        context: { userId: 'u-9' },
      });
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('emits an empty context when none is supplied', () => {
      const sink = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      emitAuditEvent('admin.users.export', 'admin-2');

      const event = JSON.parse((sink.mock.calls[0][0] as string).trim());
      expect(event.context).toEqual({});
    });

    it('truncates an oversized context instead of writing an unbounded line', () => {
      const sink = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      emitAuditEvent('admin.users.export', 'admin-3', { blob: 'x'.repeat(8 * 1024) });

      const event = JSON.parse((sink.mock.calls[0][0] as string).trim());
      expect(event.context.__truncated).toBe(true);
      expect(event.context.__reason).toBe('audit payload exceeded maximum size');
      expect(event.context.__originalSizeBytes).toBeGreaterThan(4 * 1024);
      expect(event.context.preview.length).toBe(1024);
    });

    it('falls back to a truncation marker when the context cannot be serialised', () => {
      const sink = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      const circular: Record<string, unknown> = { action: 'x' };
      circular.self = circular;

      expect(() => emitAuditEvent('admin.user.view', 'admin-4', circular)).not.toThrow();

      const event = JSON.parse((sink.mock.calls[0][0] as string).trim());
      expect(event.context).toEqual({
        __truncated: true,
        __reason: 'audit payload could not be serialized',
      });
    });

    it('does not store admin events in the in-memory ring', () => {
      vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      emitAuditEvent('admin.users.read', 'admin-5');

      // Admin audit is write-only to stdout; it is not queryable in-process.
      expect(getAuditEvents()).toHaveLength(0);
    });
  });

  describe('auditAdminUsersRead', () => {
    it('emits admin.users.read with the query params nested under queryParams', () => {
      const sink = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      auditAdminUsersRead('admin-8', { page: 1, q: 'alice' });

      const event = JSON.parse((sink.mock.calls[0][0] as string).trim());
      expect(event).toMatchObject({
        type: 'AUDIT',
        action: 'admin.users.read',
        actorId: 'admin-8',
        context: { queryParams: { page: 1, q: 'alice' } },
      });
    });

    it('emits an empty queryParams object when no filters were applied', () => {
      const sink = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      auditAdminUsersRead('admin-9', {});

      const event = JSON.parse((sink.mock.calls[0][0] as string).trim());
      expect(event.context).toEqual({ queryParams: {} });
    });
  });

  describe('clearAuditEventsForTests', () => {
    it('empties the transaction audit log', async () => {
      await appendAuditEvent({
        actorWallet: WALLET, action: 'tx.submit', resource: 'transaction', status: 'success',
      });
      expect(getAuditEvents()).toHaveLength(1);

      clearAuditEventsForTests();

      expect(getAuditEvents()).toHaveLength(0);
    });
  });
});
