import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { db } from '../../db/index';
import { accounts } from '../../db/schema/accounts';
import { eq } from 'drizzle-orm';

describe('Drizzle Profile Repository - SQL Compilation', () => {
  it('select by userId compiles to Postgres dialect', () => {
    const query = db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, 'user-123'))
      .limit(1);

    const compiled = query.toSQL();
    expect(compiled.sql).toContain('select');
    expect(compiled.sql).toContain('from "accounts"');
    expect(compiled.sql).toContain('where "accounts"."user_id" = $1');
    expect(compiled.sql).toContain('limit $2');
    expect(compiled.params).toContain('user-123');
  });

  it('insert onConflictDoUpdate returning compiles to Postgres dialect', () => {
    const query = db
      .insert(accounts)
      .values({
        userId: 'user-123',
        displayName: 'Test User',
        bio: 'Hello',
        website: 'https://example.com',
        timezone: 'EST',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: accounts.userId,
        set: {
          displayName: 'Test User',
          bio: 'Hello',
          website: 'https://example.com',
          timezone: 'EST',
          updatedAt: new Date(),
        },
      })
      .returning();

    const compiled = query.toSQL();
    expect(compiled.sql).toContain('insert into "accounts"');
    expect(compiled.sql).toContain('on conflict');
    expect(compiled.sql).toContain('do update');
    expect(compiled.sql).toContain('returning');
    expect(compiled.params.length).toBeGreaterThan(0);
  });

  it('update compiles to Postgres dialect', () => {
    const query = db
      .update(accounts)
      .set({ displayName: '[deleted]' })
      .where(eq(accounts.userId, 'user-123'));

    const compiled = query.toSQL();
    expect(compiled.sql).toContain('update "accounts"');
    expect(compiled.sql).toContain('set "display_name" = $1');
    expect(compiled.sql).toContain('where "accounts"."user_id" = $2');
    expect(compiled.params).toEqual(['[deleted]', 'user-123']);
  });
});
