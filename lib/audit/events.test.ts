import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  emitAuditEvent,
  getAuditEvents,
  clearAuditLog,
  type AuditEventType,
} from './events';

/**
 * `lib/audit/events.ts` is the legacy-facing surface for the *account* audit
 * trail (auth challenges, deletion, anonymisation, cleanup jobs). It is a thin
 * re-export wrapper over the canonical `@/lib/audit`, so these tests assert
 * both that the wrapper delegates faithfully and that the stored event is
 * shaped the way incident response and DSAR tooling expect.
 *
 * See `docs/audit-events.md`.
 */

/** Every account event type the union admits. */
const ALL_TYPES: AuditEventType[] = [
  'account.deleted',
  'account.anonymized',
  'sessions.revoked',
  'data.cleanup.enqueued',
  'data.cleanup.completed',
  'data.cleanup.failed',
  'auth.challenge.issued',
  'auth.challenge.verified',
  'auth.challenge.rate_limited',
];

describe('lib/audit/events', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  afterEach(() => {
    clearAuditLog();
  });

  describe('event shaping', () => {
    it('returns an event carrying kind, id, type, actor, timestamp, and metadata', () => {
      const event = emitAuditEvent('account.deleted', 'user-1', { reason: 'dsar' });

      expect(Object.keys(event).sort()).toEqual(
        ['id', 'kind', 'metadata', 'timestamp', 'type', 'userId'].sort(),
      );
      expect(event.kind).toBe('account');
      expect(event.type).toBe('account.deleted');
      expect(event.userId).toBe('user-1');
      expect(event.metadata).toEqual({ reason: 'dsar' });
    });

    it('stamps an ISO-8601 timestamp', () => {
      const event = emitAuditEvent('sessions.revoked', 'user-2');

      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
    });

    it('defaults metadata to an empty object when omitted', () => {
      // Consumers can index into metadata without a null check.
      expect(emitAuditEvent('sessions.revoked', 'user-3').metadata).toEqual({});
    });

    it.each(ALL_TYPES)('accepts and preserves the %s event type', (type) => {
      expect(emitAuditEvent(type, 'user-4').type).toBe(type);
    });

    it('assigns a unique, ordered id to each event', () => {
      const ids = [
        emitAuditEvent('sessions.revoked', 'user-5').id,
        emitAuditEvent('sessions.revoked', 'user-5').id,
        emitAuditEvent('sessions.revoked', 'user-5').id,
      ];

      expect(new Set(ids).size).toBe(3);
      for (const id of ids) {
        expect(id).toMatch(/^audit-\d+-\d+$/);
      }
    });

    it('records an empty actor rather than dropping the event', () => {
      // A pre-authentication failure still has to be auditable.
      const event = emitAuditEvent('auth.challenge.rate_limited', '');

      expect(event.userId).toBe('');
      expect(getAuditEvents()).toHaveLength(1);
    });

    it('preserves nested and non-string metadata verbatim', () => {
      const metadata = { attempt: 3, ok: false, ctx: { ip: 'hashed', tags: ['a', 'b'] } };

      expect(emitAuditEvent('auth.challenge.issued', 'user-6', metadata).metadata).toEqual(
        metadata,
      );
    });
  });

  describe('storage and retrieval', () => {
    it('stores the emitted event so it can be read back', () => {
      emitAuditEvent('account.deleted', 'user-7');

      const events = getAuditEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('account.deleted');
    });

    it('returns events in emission order', () => {
      emitAuditEvent('auth.challenge.issued', 'user-8');
      emitAuditEvent('auth.challenge.verified', 'user-8');
      emitAuditEvent('sessions.revoked', 'user-8');

      expect(getAuditEvents().map((e) => e.type)).toEqual([
        'auth.challenge.issued',
        'auth.challenge.verified',
        'sessions.revoked',
      ]);
    });

    it('returns an empty array when nothing has been emitted', () => {
      expect(getAuditEvents()).toEqual([]);
    });

    it('returns only account events, not transaction events', () => {
      emitAuditEvent('account.deleted', 'user-9');

      for (const event of getAuditEvents()) {
        expect(event.kind).toBe('account');
      }
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      emitAuditEvent('account.deleted', 'alice', { seq: 1 });
      emitAuditEvent('sessions.revoked', 'alice', { seq: 2 });
      emitAuditEvent('account.deleted', 'bob', { seq: 3 });
    });

    it('filters by userId', () => {
      const events = getAuditEvents({ userId: 'alice' });

      expect(events).toHaveLength(2);
      expect(events.every((e) => e.userId === 'alice')).toBe(true);
    });

    it('filters by type', () => {
      const events = getAuditEvents({ type: 'account.deleted' });

      expect(events).toHaveLength(2);
      expect(events.every((e) => e.type === 'account.deleted')).toBe(true);
    });

    it('combines userId and type filters', () => {
      const events = getAuditEvents({ userId: 'alice', type: 'account.deleted' });

      expect(events).toHaveLength(1);
      expect(events[0].metadata).toEqual({ seq: 1 });
    });

    it('returns everything when no filters are supplied', () => {
      expect(getAuditEvents()).toHaveLength(3);
      expect(getAuditEvents({})).toHaveLength(3);
    });

    it('returns an empty array when no event matches', () => {
      expect(getAuditEvents({ userId: 'nobody' })).toEqual([]);
    });

    it('includes events at or after the since timestamp', () => {
      const all = getAuditEvents();
      const cutoff = all[0].timestamp;

      // `since` is inclusive (>=), so the boundary event is retained.
      expect(getAuditEvents({ since: cutoff }).length).toBe(all.length);
    });

    it('excludes events before the since timestamp', () => {
      const future = new Date(Date.now() + 60_000).toISOString();

      expect(getAuditEvents({ since: future })).toEqual([]);
    });
  });

  describe('oversized metadata', () => {
    it('truncates metadata beyond the 4KB cap', () => {
      const event = emitAuditEvent('data.cleanup.failed', 'user-10', {
        blob: 'x'.repeat(8 * 1024),
      });

      expect(event.metadata.__truncated).toBe(true);
      expect(event.metadata.__reason).toBe('audit payload exceeded maximum size');
      expect(event.metadata.__originalSizeBytes).toBeGreaterThan(4 * 1024);
    });

    it('keeps a 1KB preview of the truncated payload', () => {
      const event = emitAuditEvent('data.cleanup.failed', 'user-11', {
        blob: 'y'.repeat(8 * 1024),
      });

      // Enough context to triage, bounded enough not to blow up the log.
      expect((event.metadata.preview as string).length).toBe(1024);
    });

    it('leaves metadata under the cap untouched', () => {
      const metadata = { blob: 'z'.repeat(100) };

      expect(emitAuditEvent('data.cleanup.completed', 'user-12', metadata).metadata).toEqual(
        metadata,
      );
    });

    it('records a marker instead of throwing when metadata cannot be serialised', () => {
      const circular: Record<string, unknown> = { step: 'cleanup' };
      circular.self = circular;

      // Auditing must never break the operation it is recording.
      let event!: ReturnType<typeof emitAuditEvent>;
      expect(() => {
        event = emitAuditEvent('data.cleanup.failed', 'user-13', circular);
      }).not.toThrow();

      expect(event.metadata).toEqual({
        __truncated: true,
        __reason: 'audit payload could not be serialized',
      });
    });
  });

  describe('clearAuditLog', () => {
    it('empties the log', () => {
      emitAuditEvent('account.deleted', 'user-14');
      expect(getAuditEvents()).toHaveLength(1);

      clearAuditLog();

      expect(getAuditEvents()).toEqual([]);
    });

    it('is safe to call on an already-empty log', () => {
      expect(() => clearAuditLog()).not.toThrow();
      expect(getAuditEvents()).toEqual([]);
    });
  });
});
