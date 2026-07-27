import { describe, it, expect } from 'vitest';
import { db } from '../../index';
import { accounts } from '../accounts';
import { sessions } from '../sessions';
import { notifications } from '../notifications';
import { transactions } from '../transactions';
import { auditEvents } from '../audit_events';
import { eq, and } from 'drizzle-orm';

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
