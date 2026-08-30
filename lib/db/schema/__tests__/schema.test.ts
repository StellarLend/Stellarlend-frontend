import { describe, it, expect } from 'vitest';
import { db } from '../../index';
import { accounts } from '../accounts';
import { sessions } from '../sessions';
import { notifications } from '../notifications';
import { transactions } from '../transactions';
import { auditEvents } from '../audit_events';
import { eq, and } from 'drizzle-orm';
import type { ProfileRecord } from '../../../account/repository';

describe('Drizzle Schemas - SQL Compilation Verification', () => {
  describe('accounts schema', () => {
    it('compiles select queries correctly', () => {
      const query = db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, 'user-123'));

      const compiled = query.toSQL();
      expect(compiled.sql).toContain('select');
      expect(compiled.sql).toContain('from "accounts"');
      expect(compiled.sql).toContain('where "accounts"."user_id" = $1');
      expect(compiled.params).toEqual(['user-123']);
    });

    it('compiles insert queries correctly', () => {
      const query = db.insert(accounts).values({
        userId: 'user-123',
        displayName: 'Test User',
        bio: 'Hello bio',
        website: 'https://test.com',
        timezone: 'EST',
      });

      const compiled = query.toSQL();
      expect(compiled.sql).toContain('insert into "accounts"');
      expect(compiled.sql).toContain('"user_id"');
      expect(compiled.sql).toContain('"display_name"');
      expect(compiled.sql).toContain('"bio"');
      expect(compiled.sql).toContain('"website"');
      expect(compiled.sql).toContain('"timezone"');
    });
  });

  describe('sessions schema', () => {
    it('compiles select queries correctly', () => {
      const date = new Date('2026-06-02T12:00:00Z');
      const query = db
        .select()
        .from(sessions)
        .where(eq(sessions.id, 'session-abc'));

      const compiled = query.toSQL();
      expect(compiled.sql).toContain('select');
      expect(compiled.sql).toContain('from "sessions"');
      expect(compiled.sql).toContain('where "sessions"."id" = $1');
      expect(compiled.params).toEqual(['session-abc']);
    });
  });

  describe('notifications schema', () => {
    it('compiles select and update queries correctly', () => {
      const query = db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, 'notif-1'), eq(notifications.userId, 'user-1')));

      const compiled = query.toSQL();
      expect(compiled.sql).toContain('update "notifications"');
      expect(compiled.sql).toContain('set "read" = $1');
      expect(compiled.sql).toContain('where ("notifications"."id" = $2 and "notifications"."user_id" = $3)');
      expect(compiled.params).toEqual([true, 'notif-1', 'user-1']);
    });
  });

  describe('transactions schema', () => {
    it('compiles filter queries correctly', () => {
      const query = db
        .select()
        .from(transactions)
        .where(eq(transactions.status, 'Completed'));

      const compiled = query.toSQL();
      expect(compiled.sql).toContain('select');
      expect(compiled.sql).toContain('from "transactions"');
      expect(compiled.sql).toContain('where "transactions"."status" = $1');
      expect(compiled.params).toEqual(['Completed']);
    });
  });

  describe('auditEvents schema', () => {
    it('compiles insert queries correctly', () => {
      const query = db.insert(auditEvents).values({
        id: 'event-1',
        userId: 'user-1',
        action: 'login',
        entityType: 'session',
        entityId: 'session-123',
        details: { ip: '127.0.0.1' },
      });

      const compiled = query.toSQL();
      expect(compiled.sql).toContain('insert into "audit_events"');
      expect(compiled.sql).toContain('"action"');
      expect(compiled.sql).toContain('"entity_type"');
      expect(compiled.sql).toContain('"details"');
    });
  });
});

// ---------------------------------------------------------------------------
// Schema ↔ ProfileRecord alignment (runtime)
// ---------------------------------------------------------------------------
//
// This describe block is the runtime companion to the compile-time guard in
// lib/account/profile-schema-alignment.ts.  It extracts the column keys that
// Drizzle exposes on the accounts table object at runtime and compares them
// (sorted) against the keys declared on a ProfileRecord-shaped value.
//
// Why both layers?
// • The compile-time guard catches mismatches whenever `tsc --noEmit` runs
//   (CI type-check step, editor).
// • This runtime test catches cases where the TypeScript build is skipped or
//   the guard file is accidentally excluded from tsconfig.json, and also
//   provides a human-readable diff in the test output.

describe('accounts table ↔ ProfileRecord key alignment', () => {
  /**
   * Drizzle exposes every column as an enumerable property on the table
   * object.  We filter out the internal Drizzle symbols/metadata keys
   * (which are non-enumerable or start with '_') so we get only the
   * TypeScript-friendly camelCase column names that callers use.
   */
  function accountsColumnKeys(): string[] {
    return Object.keys(accounts)
      .filter((k) => !k.startsWith('_') && !k.startsWith('$') && k !== 'enableRLS' && typeof (accounts as any)[k] !== 'function')
      .sort();
  }

  /**
   * Returns the keys of a complete ProfileRecord literal.
   * Because ProfileRecord is an interface (erased at runtime) we assert
   * against a typed constant — the compiler guarantees this object has
   * exactly the fields declared by ProfileRecord (no extras, thanks to
   * excess-property checking; no missing ones, thanks to the interface).
   */
  function profileRecordKeys(): string[] {
    // This object literal is type-checked against ProfileRecord.
    // Add/remove a field from either side and tsc will complain here too.
    const sample: ProfileRecord = {
      userId: 'u',
      displayName: 'd',
      bio: 'b',
      website: 'w',
      timezone: 'UTC',
      updatedAt: new Date(),
    };
    return Object.keys(sample).sort();
  }

  it('has the same column keys as ProfileRecord — no extra or missing fields', () => {
    const schemaKeys = accountsColumnKeys();
    const recordKeys = profileRecordKeys();

    expect(schemaKeys).toEqual(recordKeys);
  });

  it('every ProfileRecord key maps to a column in the accounts table', () => {
    const schemaKeys = new Set(accountsColumnKeys());
    const recordKeys = profileRecordKeys();

    const missingFromSchema = recordKeys.filter((k) => !schemaKeys.has(k));
    expect(missingFromSchema).toEqual([]);
  });

  it('every accounts column maps to a key in ProfileRecord', () => {
    const recordKeys = new Set(profileRecordKeys());
    const schemaKeys = accountsColumnKeys();

    const missingFromRecord = schemaKeys.filter((k) => !recordKeys.has(k));
    expect(missingFromRecord).toEqual([]);
  });
});
