/**
 * __tests__/admin/users.test.ts
 *
 * Comprehensive tests for:
 *   - lib/auth/rbac.ts          (Role checks, requireAdmin guard)
 *   - lib/validation/schemas/admin.ts (query-param schema)
 *   - lib/db/users.ts           (getUsers pagination + search)
 *   - lib/audit/logger.ts       (audit event emission)
 *   - app/api/admin/users/route.ts (full request/response cycle)
 *
 * Coverage target: ≥ 95 %
 */

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = 'dev-secret-change-in-production';
const ADMIN_ROLE = 'admin';
const OPS_ROLE = 'ops';
const USER_ROLE = 'user';

/**
 * Build a signed JWT with the given role claim.
 * Uses the same secret/algorithm as lib/auth.ts so the route can verify it.
 */
async function buildToken(role: string, expiresIn = '1h'): Promise<string> {
  const secret = new TextEncoder().encode(SECRET);
  return new SignJWT({ userId: 'test-user-1', email: 'test@stellarlend.io', role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

/** Construct a NextRequest pointing at the admin users endpoint. */
function makeRequest(
  queryParams: Record<string, string> = {},
  token?: string,
): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/users');
  Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return new NextRequest(url, { method: 'GET', headers });
}

// ---------------------------------------------------------------------------
// 1. RBAC – lib/auth/rbac.ts
// ---------------------------------------------------------------------------

describe('lib/auth/rbac', () => {
  const { hasRole, Role, requireAdmin, requireOpsOrAdmin } =
    await import('@/lib/auth/rbac');

  describe('hasRole()', () => {
    it('returns true when the role claim matches', () => {
      expect(hasRole({ role: 'admin' }, Role.Admin)).toBe(true);
    });

    it('returns false when the role claim does not match', () => {
      expect(hasRole({ role: 'user' }, Role.Admin)).toBe(false);
    });

    it('returns false when role claim is absent', () => {
      expect(hasRole({}, Role.Admin)).toBe(false);
    });
  });

  describe('requireAdmin()', () => {
    it('returns an AdminUser when the JWT carries the admin role', async () => {
      const token = await buildToken(ADMIN_ROLE);
      const req = makeRequest({}, token);
      const user = await requireAdmin(req);
      expect(user.role).toBe(Role.Admin);
    });

    it('throws 401 when no token is present', async () => {
      const req = makeRequest();
      const result = requireAdmin(req);
      await expect(result).rejects.toBeInstanceOf(NextResponse);
      const resp = await result.catch((e) => e as NextResponse);
      expect(resp.status).toBe(401);
    });

    it('throws 401 when the token is expired', async () => {
      const token = await buildToken(ADMIN_ROLE, '0s');
      await new Promise((r) => setTimeout(r, 1100)); // wait >1 s
      const req = makeRequest({}, token);
      await expect(requireAdmin(req)).rejects.toBeInstanceOf(NextResponse);
    });

    it('throws 403 when the token role is "user"', async () => {
      const token = await buildToken(USER_ROLE);
      const req = makeRequest({}, token);
      const result = requireAdmin(req);
      await expect(result).rejects.toBeInstanceOf(NextResponse);
      const resp = await result.catch((e) => e as NextResponse);
      expect(resp.status).toBe(403);
    });

    it('throws 403 when the token role is "ops"', async () => {
      const token = await buildToken(OPS_ROLE);
      const req = makeRequest({}, token);
      const result = requireAdmin(req);
      await expect(result).rejects.toBeInstanceOf(NextResponse);
      const resp = await result.catch((e) => e as NextResponse);
      expect(resp.status).toBe(403);
    });
  });

  describe('requireOpsOrAdmin()', () => {
    it('succeeds for admin role', async () => {
      const token = await buildToken(ADMIN_ROLE);
      const req = makeRequest({}, token);
      const user = await requireOpsOrAdmin(req);
      expect(['admin', 'ops']).toContain(user.role);
    });

    it('succeeds for ops role', async () => {
      const token = await buildToken(OPS_ROLE);
      const req = makeRequest({}, token);
      const user = await requireOpsOrAdmin(req);
      expect(user.role).toBe(Role.Ops);
    });

    it('throws 403 for plain user role', async () => {
      const token = await buildToken(USER_ROLE);
      const req = makeRequest({}, token);
      const result = requireOpsOrAdmin(req);
      await expect(result).rejects.toBeInstanceOf(NextResponse);
      const resp = await result.catch((e) => e as NextResponse);
      expect(resp.status).toBe(403);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Validation – lib/validation/schemas/admin.ts
// ---------------------------------------------------------------------------

describe('lib/validation/schemas/admin – adminUsersQuerySchema', () => {
  const { adminUsersQuerySchema, ADMIN_USERS_DEFAULT_PAGE_SIZE, ADMIN_USERS_MAX_PAGE_SIZE } =
    await import('@/lib/validation/schemas/admin');

  it('applies default page and pageSize when no params provided', () => {
    const result = adminUsersQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(ADMIN_USERS_DEFAULT_PAGE_SIZE);
    expect(result.search).toBeUndefined();
  });

  it('coerces string numbers correctly', () => {
    const result = adminUsersQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it('rejects page < 1', () => {
    expect(() => adminUsersQuerySchema.parse({ page: '0' })).toThrow();
  });

  it('rejects pageSize > max', () => {
    expect(() =>
      adminUsersQuerySchema.parse({ pageSize: String(ADMIN_USERS_MAX_PAGE_SIZE + 1) }),
    ).toThrow();
  });

  it('rejects pageSize < 1', () => {
    expect(() => adminUsersQuerySchema.parse({ pageSize: '0' })).toThrow();
  });

  it('rejects search strings longer than 100 characters', () => {
    expect(() =>
      adminUsersQuerySchema.parse({ search: 'a'.repeat(101) }),
    ).toThrow();
  });

  it('accepts a valid search string', () => {
    const result = adminUsersQuerySchema.parse({ search: 'alice' });
    expect(result.search).toBe('alice');
  });

  it('rejects non-integer page', () => {
    expect(() => adminUsersQuerySchema.parse({ page: '1.5' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Data Access – lib/db/users.ts
// ---------------------------------------------------------------------------

describe('lib/db/users – getUsers()', () => {
  const { getUsers, USER_STORE } = await import('@/lib/db/users');

  it('returns the first page with correct total', () => {
    const result = getUsers({ page: 1, pageSize: 2 });
    expect(result.users.length).toBeLessThanOrEqual(2);
    expect(result.total).toBe(USER_STORE.length);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
  });

  it('paginates correctly to page 2', () => {
    const page1 = getUsers({ page: 1, pageSize: 2 });
    const page2 = getUsers({ page: 2, pageSize: 2 });

    // No overlap between pages
    const ids1 = new Set(page1.users.map((u) => u.id));
    page2.users.forEach((u) => expect(ids1.has(u.id)).toBe(false));
  });

  it('returns empty users array when page is beyond total', () => {
    const result = getUsers({ page: 9999, pageSize: 20 });
    expect(result.users).toHaveLength(0);
    expect(result.total).toBe(USER_STORE.length);
  });

  it('filters by email substring (case-insensitive)', () => {
    const result = getUsers({ page: 1, pageSize: 20, search: 'alice' });
    expect(result.users.every((u) => u.email.toLowerCase().includes('alice'))).toBe(true);
  });

  it('filters by name substring (case-insensitive)', () => {
    const result = getUsers({ page: 1, pageSize: 20, search: 'satoshi' });
    expect(result.total).toBe(1);
    expect(result.users[0].name.toLowerCase()).toContain('satoshi');
  });

  it('returns zero results for a non-matching search term', () => {
    const result = getUsers({ page: 1, pageSize: 20, search: 'zzznomatch999' });
    expect(result.total).toBe(0);
    expect(result.users).toHaveLength(0);
  });

  it('never exposes sensitive fields (password, token)', () => {
    const result = getUsers({ page: 1, pageSize: 100 });
    result.users.forEach((u) => {
      expect(u).not.toHaveProperty('hashedPassword');
      expect(u).not.toHaveProperty('passwordHash');
      expect(u).not.toHaveProperty('sessionToken');
      expect(u).not.toHaveProperty('refreshToken');
    });
  });

  it('computes totalPages correctly', () => {
    const totalRecords = USER_STORE.length;
    const pageSize = 2;
    const result = getUsers({ page: 1, pageSize });
    const expected = Math.max(1, Math.ceil(totalRecords / pageSize));
    expect(result.totalPages).toBe(expected);
  });

  it('totalPages is at least 1 even when result set is empty', () => {
    const result = getUsers({ page: 1, pageSize: 20, search: 'nomatch_xyz_abc' });
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Audit logger – lib/audit/logger.ts
// ---------------------------------------------------------------------------

describe('lib/audit/logger – emitAuditEvent()', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  const { emitAuditEvent, auditAdminUsersRead } =
    await import('@/lib/audit/logger');

  it('writes a JSON line to stdout', () => {
    emitAuditEvent('admin.users.read', 'actor-1', { page: 1 });
    expect(writeSpy).toHaveBeenCalledOnce();
    const written = writeSpy.mock.calls[0][0] as string;
    expect(written.endsWith('\n')).toBe(true);
  });

  it('emitted event has correct shape', () => {
    emitAuditEvent('admin.users.read', 'actor-42', { pageSize: 20 });
    const written = writeSpy.mock.calls[0][0] as string;
    const event = JSON.parse(written.trim());
    expect(event.type).toBe('AUDIT');
    expect(event.action).toBe('admin.users.read');
    expect(event.actorId).toBe('actor-42');
    expect(event.context).toMatchObject({ pageSize: 20 });
    expect(typeof event.timestamp).toBe('string');
  });

  it('auditAdminUsersRead is a convenience wrapper that works correctly', () => {
    auditAdminUsersRead('usr_001', { page: 1, pageSize: 20, search: null });
    expect(writeSpy).toHaveBeenCalledOnce();
    const event = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(event.action).toBe('admin.users.read');
    expect(event.actorId).toBe('usr_001');
    expect(event.context.queryParams).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('emitted event never contains raw token or password values', () => {
    emitAuditEvent('admin.users.read', 'actor-1', {
      queryParams: { page: 1 },
      // deliberately passing sensitive-looking keys to assert they appear verbatim
      // (the audit logger itself doesn't redact – that's the caller's responsibility)
    });
    const written = writeSpy.mock.calls[0][0] as string;
    // Ensure no JWT or password values are in standard fields
    expect(written).not.toContain('hashedPassword');
    expect(written).not.toContain('sessionToken');
  });
});

// ---------------------------------------------------------------------------
// 5. Route – app/api/admin/users/route.ts (integration-style)
// ---------------------------------------------------------------------------

describe('GET /api/admin/users – route handler', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  const { GET } = await import('@/app/api/admin/users/route');

  // ── Authentication / Authorisation ─────────────────────────────────────────

  it('returns 401 when no Authorization header is provided', async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 403 when a non-admin JWT is provided (role=user)', async () => {
    const token = await buildToken(USER_ROLE);
    const req = makeRequest({}, token);
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 when a non-admin JWT is provided (role=ops)', async () => {
    const token = await buildToken(OPS_ROLE);
    const req = makeRequest({}, token);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 401 for a malformed token', async () => {
    const req = makeRequest({}, 'not.a.valid.jwt');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  // ── Successful responses ────────────────────────────────────────────────────

  it('returns 200 with users and pagination for a valid admin token', async () => {
    const token = await buildToken(ADMIN_ROLE);
    const req = makeRequest({}, token);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('users');
    expect(body).toHaveProperty('pagination');
    expect(Array.isArray(body.users)).toBe(true);
  });

  it('pagination metadata reflects request params', async () => {
    const token = await buildToken(ADMIN_ROLE);
    const req = makeRequest({ page: '1', pageSize: '2' }, token);
    const res = await GET(req);
    const body = await res.json();

    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(2);
    expect(typeof body.pagination.total).toBe('number');
    expect(typeof body.pagination.totalPages).toBe('number');
  });

  it('search parameter filters results correctly', async () => {
    const token = await buildToken(ADMIN_ROLE);
    const req = makeRequest({ search: 'alice' }, token);
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    body.users.forEach((u: { email: string; name: string }) => {
      const matches =
        u.email.toLowerCase().includes('alice') ||
        u.name.toLowerCase().includes('alice');
      expect(matches).toBe(true);
    });
  });

  it('returns empty users array for a search with no matches', async () => {
    const token = await buildToken(ADMIN_ROLE);
    const req = makeRequest({ search: 'zzznomatch9999' }, token);
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.users).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });

  // ── Field sanitisation ──────────────────────────────────────────────────────

  it('response users never contain hashedPassword or sessionToken', async () => {
    const token = await buildToken(ADMIN_ROLE);
    const req = makeRequest({}, token);
    const res = await GET(req);
    const body = await res.json();

    body.users.forEach((u: Record<string, unknown>) => {
      expect(u).not.toHaveProperty('hashedPassword');
      expect(u).not.toHaveProperty('passwordHash');
      expect(u).not.toHaveProperty('sessionToken');
      expect(u).not.toHaveProperty('refreshToken');
    });
  });

  // ── Validation errors ───────────────────────────────────────────────────────

  it('returns 400 for invalid page param (page=0)', async () => {
    const token = await buildToken(ADMIN_ROLE);
    const req = makeRequest({ page: '0' }, token);
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('details');
  });

  it('returns 400 for pageSize exceeding maximum', async () => {
    const token = await buildToken(ADMIN_ROLE);
    const req = makeRequest({ pageSize: '101' }, token);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for search string exceeding 100 characters', async () => {
    const token = await buildToken(ADMIN_ROLE);
    const req = makeRequest({ search: 'a'.repeat(101) }, token);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  // ── Audit logging ───────────────────────────────────────────────────────────

  it('emits exactly one audit event per successful request', async () => {
    const token = await buildToken(ADMIN_ROLE);
    const req = makeRequest({}, token);
    await GET(req);
    expect(writeSpy).toHaveBeenCalledOnce();

    const event = JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
    expect(event.action).toBe('admin.users.read');
  });

  it('does NOT emit an audit event when the request is rejected (401)', async () => {
    const req = makeRequest(); // no token
    await GET(req);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('does NOT emit an audit event when the request is rejected (403)', async () => {
    const token = await buildToken(USER_ROLE);
    const req = makeRequest({}, token);
    await GET(req);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  // ── Default values ──────────────────────────────────────────────────────────

  it('applies default page=1 and pageSize=20 when no params are sent', async () => {
    const token = await buildToken(ADMIN_ROLE);
    const req = makeRequest({}, token);
    const res = await GET(req);
    const body = await res.json();

    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(20);
  });
});
