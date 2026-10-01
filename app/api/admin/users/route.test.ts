/**
 * app/api/admin/users/route.test.ts
 *
 * Tests for `GET /api/admin/users` (app/api/admin/users/route.ts).
 *
 * The route is an admin-only, audit-logged, paginated user listing, so the
 * behaviours guarded here are the security-critical ones:
 *
 *   401 – no / invalid session                       (no session)
 *   403 – authenticated but not an admin             (non-admin)
 *   400 – invalid `page` / `pageSize` / `search`     (query validation)
 *   200 – paginated user listing + audit event       (success)
 *   500 – unexpected auth / data-store failure       (fail closed)
 *
 * Regression guards included here:
 *   - `requireAdmin` is always invoked with the incoming request and its
 *     verdict is honoured (catches the guard being short-circuited).
 *   - Authorisation runs *before* query validation, so an unauthenticated
 *     caller can never use the endpoint as a validation oracle.
 *   - `auditAdminUsersRead` fires exactly once per successful call and is
 *     never fired for rejected calls (catches a silently dropped audit).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET } from './route';
import { auditAdminUsersRead } from '@/lib/audit/logger';
import { requireAdmin } from '@/lib/auth/rbac';
import { getUsers } from '@/lib/db/users';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockRequireAdmin, mockGetUsers, mockAudit, mockLoggerError } = vi.hoisted(
  () => ({
    mockRequireAdmin: vi.fn(),
    mockGetUsers: vi.fn(),
    mockAudit: vi.fn(),
    mockLoggerError: vi.fn(),
  }),
);

vi.mock('@/lib/auth/rbac', () => ({ requireAdmin: mockRequireAdmin }));
vi.mock('@/lib/db/users', () => ({ getUsers: mockGetUsers }));
vi.mock('@/lib/audit/logger', () => ({ auditAdminUsersRead: mockAudit }));
vi.mock('@/lib/logger', () => ({ logger: { error: mockLoggerError } }));

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const ADMIN = {
  id: 'admin-123',
  email: 'admin@stellarlend.io',
  name: 'Root Admin',
  walletAddress: 'GADMINWALLET',
  role: 'admin',
};

/** Mirrors `AdminUserRecord` – the allow-listed shape returned to admins. */
const ALICE = {
  id: 'usr_001',
  email: 'alice@stellarlend.io',
  name: 'Alice Nakamoto',
  walletAddress: 'GABC1234567890',
  role: 'user',
  status: 'active' as const,
  createdAt: '2025-01-10T09:00:00.000Z',
  updatedAt: '2025-01-11T09:00:00.000Z',
};

const BOB = { ...ALICE, id: 'usr_002', email: 'bob@stellarlend.io', name: 'Bob Sato' };

function usersResult(users: Record<string, unknown>[] = [ALICE, BOB], meta = {}) {
  return {
    users,
    page: 1,
    pageSize: 20,
    total: users.length,
    totalPages: 1,
    ...meta,
  };
}

function makeRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/users');
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return new NextRequest(url, { method: 'GET' });
}

/** Mirrors the 401/403 `NextResponse` values thrown by `requireAdmin`. */
const rejectAs = (status: 401 | 403, error: 'Unauthorized' | 'Forbidden') =>
  mockRequireAdmin.mockRejectedValue(NextResponse.json({ error }, { status }));

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(ADMIN);
  mockGetUsers.mockReturnValue(usersResult());
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/users', () => {
  it('observes the same collaborators the route imports', () => {
    // Sanity check that the module mocks line up with the route's imports.
    expect(requireAdmin).toBe(mockRequireAdmin);
    expect(getUsers).toBe(mockGetUsers);
    expect(auditAdminUsersRead).toBe(mockAudit);
    expect(logger.error).toBe(mockLoggerError);
  });

  describe('authorisation guard', () => {
    it('always delegates to requireAdmin with the incoming request', async () => {
      const req = makeRequest();
      await GET(req);

      // Guards against `requireAdmin` being accidentally short-circuited.
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
      expect(mockRequireAdmin).toHaveBeenCalledWith(req);
    });

    it('returns 401 and no payload when there is no session', async () => {
      rejectAs(401, 'Unauthorized');

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 403 when the caller is authenticated but not an admin', async () => {
      rejectAs(403, 'Forbidden');

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ error: 'Forbidden' });
    });

    it('passes the guard’s own error response through unchanged', async () => {
      const guardResponse = NextResponse.json(
        { error: 'Unauthorized', reason: 'token_expired' },
        { status: 401 },
      );
      mockRequireAdmin.mockRejectedValue(guardResponse);

      const res = await GET(makeRequest());

      expect(res).toBe(guardResponse);
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({
        error: 'Unauthorized',
        reason: 'token_expired',
      });
    });

    it('never reaches the data store when the guard rejects', async () => {
      rejectAs(403, 'Forbidden');
      await GET(makeRequest());
      expect(mockGetUsers).not.toHaveBeenCalled();
    });

    it('authorises before validating query parameters', async () => {
      // A rejected caller must not learn whether their query was valid.
      rejectAs(401, 'Unauthorized');

      const res = await GET(makeRequest({ page: '0', pageSize: '999' }));

      expect(res.status).toBe(401);
      expect(mockGetUsers).not.toHaveBeenCalled();
    });

    it('fails closed with 500 when the guard throws an unexpected error', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('jwt decode blew up'));

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toEqual({ error: 'Internal Server Error' });
      expect(mockLoggerError).toHaveBeenCalled();
      expect(mockGetUsers).not.toHaveBeenCalled();
    });
  });

  describe('400 – query parameter validation', () => {
    it.each([
      ['page=0', { page: '0' }],
      ['page=-1', { page: '-1' }],
      ['page=abc', { page: 'abc' }],
      ['page=1.5', { page: '1.5' }],
      ['pageSize=0', { pageSize: '0' }],
      ['pageSize=-5', { pageSize: '-5' }],
      ['pageSize=101', { pageSize: '101' }],
      ['pageSize=abc', { pageSize: 'abc' }],
      ['search=101 chars', { search: 'a'.repeat(101) }],
    ])('rejects %s', async (_label, query) => {
      const res = await GET(makeRequest(query));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid query parameters');
      expect(body.details).toBeTypeOf('object');
      expect(mockGetUsers).not.toHaveBeenCalled();
    });

    it('names the offending field in the validation details', async () => {
      const res = await GET(makeRequest({ pageSize: '500' }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(Object.keys(body.details)).toContain('pageSize');
    });

    it.each([
      ['page=1', { page: '1' }],
      ['pageSize=100', { pageSize: '100' }],
      ['pageSize=1', { pageSize: '1' }],
      ['search=100 chars', { search: 'a'.repeat(100) }],
    ])('accepts boundary value %s', async (_label, query) => {
      const res = await GET(makeRequest(query));

      expect(res.status).toBe(200);
    });

    it('does not emit an audit event for a rejected query', async () => {
      await GET(makeRequest({ page: '0' }));
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });

  describe('200 – successful listing', () => {
    it('returns users plus pagination metadata', async () => {
      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.users).toEqual([ALICE, BOB]);
      expect(body.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('exposes exactly the documented response keys', async () => {
      const body = await (await GET(makeRequest())).json();

      expect(Object.keys(body).sort()).toEqual(['pagination', 'users']);
      expect(Object.keys(body.pagination).sort()).toEqual([
        'page',
        'pageSize',
        'total',
        'totalPages',
      ]);
    });

    it('serialises numeric pagination fields as numbers', async () => {
      const body = await (await GET(makeRequest())).json();

      for (const key of ['page', 'pageSize', 'total', 'totalPages']) {
        expect(body.pagination[key]).toBeTypeOf('number');
      }
    });

    it('echoes the pagination window reported by the data store', async () => {
      mockGetUsers.mockReturnValue(
        usersResult([BOB], { page: 3, pageSize: 5, total: 42, totalPages: 9 }),
      );

      const body = await (await GET(makeRequest({ page: '3', pageSize: '5' }))).json();

      expect(body.pagination).toEqual({ page: 3, pageSize: 5, total: 42, totalPages: 9 });
      expect(body.users).toEqual([BOB]);
    });

    it('applies page=1 / pageSize=20 defaults and coerces them to numbers', async () => {
      await GET(makeRequest());

      expect(mockGetUsers).toHaveBeenCalledTimes(1);
      expect(mockGetUsers).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: undefined });
    });

    it('forwards the requested page window as numbers', async () => {
      await GET(makeRequest({ page: '4', pageSize: '50' }));

      expect(mockGetUsers).toHaveBeenCalledWith({ page: 4, pageSize: 50, search: undefined });
    });

    it('forwards the search term', async () => {
      await GET(makeRequest({ search: 'alice' }));

      expect(mockGetUsers).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        search: 'alice',
      });
    });

    it('returns an empty page without erroring when there are no matches', async () => {
      mockGetUsers.mockReturnValue(usersResult([], { total: 0, totalPages: 1 }));

      const res = await GET(makeRequest({ search: 'nobody' }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.users).toEqual([]);
      expect(body.pagination).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
    });

    it('returns only the allow-listed user fields, un-enriched', async () => {
      const body = await (await GET(makeRequest())).json();

      expect(Object.keys(body.users[0]).sort()).toEqual(Object.keys(ALICE).sort());
      expect(body.users[0]).toEqual(ALICE);
    });

    it('does not inject credential material into the response', async () => {
      const body = await (await GET(makeRequest())).json();
      const serialised = JSON.stringify(body);

      for (const forbidden of [
        'hashedPassword',
        'passwordHash',
        'sessionToken',
        'refreshToken',
        'privateKey',
      ]) {
        expect(Object.keys(body.users[0])).not.toContain(forbidden);
        expect(serialised).not.toContain(forbidden);
      }
    });
  });

  describe('audit trail', () => {
    it('emits exactly one audit event attributed to the admin on success', async () => {
      await GET(makeRequest());

      expect(mockAudit).toHaveBeenCalledTimes(1);
      expect(mockAudit).toHaveBeenCalledWith('admin-123', {
        page: 1,
        pageSize: 20,
        search: null,
        resultCount: 2,
      });
    });

    it('records the requested page window in the audit payload', async () => {
      await GET(makeRequest({ page: '2', pageSize: '10' }));

      expect(mockAudit).toHaveBeenCalledWith(
        'admin-123',
        expect.objectContaining({ page: 2, pageSize: 10, resultCount: 2 }),
      );
    });

    it('records the search term when one is supplied', async () => {
      await GET(makeRequest({ search: 'alice' }));

      expect(mockAudit).toHaveBeenCalledWith(
        'admin-123',
        expect.objectContaining({ search: 'alice' }),
      );
    });

    it('records a zero result count for an empty page', async () => {
      mockGetUsers.mockReturnValue(usersResult([], { total: 0, totalPages: 1 }));

      await GET(makeRequest({ page: '9' }));

      expect(mockAudit).toHaveBeenCalledWith(
        'admin-123',
        expect.objectContaining({ resultCount: 0 }),
      );
    });

    it.each([
      ['401', () => rejectAs(401, 'Unauthorized')],
      ['403', () => rejectAs(403, 'Forbidden')],
      ['400', () => undefined],
    ])('does not emit an audit event for a %s response', async (_status, arrange) => {
      arrange();
      await GET(makeRequest({ page: '0' }));
      expect(mockAudit).not.toHaveBeenCalled();
    });

    it('does not emit an audit event when the data store fails', async () => {
      mockGetUsers.mockImplementation(() => {
        throw new Error('data store unavailable');
      });

      const res = await GET(makeRequest());

      expect(res.status).toBe(500);
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });

  describe('500 – data store failure', () => {
    it('returns a generic error without leaking the internal message', async () => {
      mockGetUsers.mockImplementation(() => {
        throw new Error('connection string leaked here');
      });

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toEqual({ error: 'Internal Server Error' });
      expect(JSON.stringify(body)).not.toContain('connection string');
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });
});
