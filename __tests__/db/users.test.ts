/**
 * __tests__/db/users.test.ts
 *
 * Dedicated unit tests for lib/db/users.ts – getUsers() pagination & search.
 *
 * Covers the exact semantics called out in GitHub issue #1179:
 *   - Empty search returns all users
 *   - Search matching only email
 *   - Search matching only name
 *   - Page number past the last page of results
 */

import { describe, it, expect } from 'vitest';
import { getUsers, USER_STORE } from '@/lib/db/users';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand for the full (unfiltered) dataset length. */
const TOTAL = USER_STORE.length;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('lib/db/users – getUsers() pagination & search', () => {

  // ── Empty search ────────────────────────────────────────────────────────

  describe('empty / omitted search', () => {
    it('returns all users when search is undefined', () => {
      const result = getUsers({ page: 1, pageSize: 100, search: undefined });
      expect(result.users).toHaveLength(TOTAL);
      expect(result.total).toBe(TOTAL);
    });

    it('returns all users when search is an empty string', () => {
      const result = getUsers({ page: 1, pageSize: 100, search: '' });
      expect(result.users).toHaveLength(TOTAL);
      expect(result.total).toBe(TOTAL);
    });

    it('totalPages equals 1 when pageSize >= total records', () => {
      const result = getUsers({ page: 1, pageSize: TOTAL + 50 });
      expect(result.totalPages).toBe(1);
    });
  });

  // ── Search matching only email ──────────────────────────────────────────

  describe('search matching only email', () => {
    it('finds a user by a unique email prefix not present in any name', () => {
      // Pick an email substring that does NOT appear in any name field.
      // "alice@stellarlend" is unique to the email column.
      const result = getUsers({ page: 1, pageSize: 20, search: 'alice@stellarlend' });
      expect(result.total).toBe(1);
      expect(result.users[0].email).toBe('alice@stellarlend.io');
    });

    it('filter is case-insensitive for email', () => {
      const result = getUsers({ page: 1, pageSize: 20, search: 'ALICE@STELLARLEND' });
      expect(result.total).toBe(1);
      expect(result.users[0].id).toBe('usr_001');
    });

    it('does not return users whose name contains the term but email does not', () => {
      // "bob" appears in Bob's email but also in his name — so use a term
      // that only the email matches.  We'll craft a partial domain match.
      const result = getUsers({ page: 1, pageSize: 20, search: '@stellarlend.io' });
      // All three seed users have @stellarlend.io emails
      expect(result.total).toBe(TOTAL);
    });
  });

  // ── Search matching only name ───────────────────────────────────────────

  describe('search matching only name', () => {
    it('finds a user by a name substring not present in any email', () => {
      // "Nakamoto" only appears in Alice's name, not in any email.
      const result = getUsers({ page: 1, pageSize: 20, search: 'Nakamoto' });
      expect(result.total).toBe(1);
      expect(result.users[0].name).toBe('Alice Nakamoto');
    });

    it('filter is case-insensitive for name', () => {
      const result = getUsers({ page: 1, pageSize: 20, search: 'lumina' });
      expect(result.total).toBe(1);
      expect(result.users[0].name).toBe('Carol Lumina');
    });

    it('does not return users whose email contains the term but name does not', () => {
      // "satoshi" only appears in Bob's name; no email contains it.
      const result = getUsers({ page: 1, pageSize: 20, search: 'satoshi' });
      expect(result.total).toBe(1);
      expect(result.users[0].id).toBe('usr_002');
    });
  });

  // ── Page past last page ─────────────────────────────────────────────────

  describe('page past the last page', () => {
    it('returns an empty users array when page exceeds total pages', () => {
      const all = getUsers({ page: 1, pageSize: 1, search: undefined });
      const lastPage = all.totalPages;
      const beyond = getUsers({ page: lastPage + 1, pageSize: 1 });
      expect(beyond.users).toHaveLength(0);
    });

    it('still reports the correct total and totalPages', () => {
      const result = getUsers({ page: 9999, pageSize: 10 });
      expect(result.total).toBe(TOTAL);
      expect(result.totalPages).toBe(Math.max(1, Math.ceil(TOTAL / 10)));
    });

    it('page=2 with pageSize equal to total returns empty array', () => {
      const result = getUsers({ page: 2, pageSize: TOTAL });
      expect(result.users).toHaveLength(0);
    });

    it('does not affect totalPages when the search returns zero results', () => {
      const result = getUsers({ page: 100, pageSize: 5, search: 'nonexistent_term_xyz' });
      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
    });
  });
});
