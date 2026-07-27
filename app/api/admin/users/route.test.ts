/**
 * app/api/admin/users/route.test.ts
 *
 * Tests for GET /api/admin/users endpoint.
 * Covers authentication, authorization, validation, pagination, and audit logging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { GET } from './route';
import { auditAdminUsersRead } from '@/lib/audit/logger';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockRequireAdmin, mockGetUsers, mockLoggerError } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockGetUsers: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('@/lib/auth/rbac', () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock('@/lib/db/users', () => ({
  getUsers: mockGetUsers,
}));

vi.mock('@/lib/audit/logger', () => ({
  auditAdminUsersRead: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mockLoggerError,
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = 'dev-secret-change-in-production';

async function buildToken(role: string, expiresIn = '1h'): Promise<string> {
  const secret = new TextEncoder().encode(SECRET);
  return new SignJWT({ userId: 'test-user-1', email: 'test@stellarlend.io', role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

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

const mockAdminUser = { id: 'admin-123', email: 'admin@stellarlend.io', role: 'admin' };

const mockUsersResult = {
  users: [
    { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
    { id: 'user-2', email: 'bob@example.com', name: 'Bob' },
  ],
  page: 1,
  pageSize: 20,
  total: 2,
  totalPages: 1,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(mockAdminUser);
    mockGetUsers.mockReturnValue(mockUsersResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Authentication / Authorization ───────────────────────────────────────

  it('returns 401 when no session token is provided', async () => {
    mockRequireAdmin.mockRejectedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );

    const req = makeRequest();
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 403 when authenticated user lacks admin role', async () => {
    mockRequireAdmin.mockRejectedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const token = await buildToken('user');
    const req = makeRequest({}, token);
    const res = await GET(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  // ── Validation errors ─────────────────────────────────────────────────────

  it('returns 400 for invalid page parameter (page=0)', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({ page: '0' }, token);
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('details');
  });

  it('returns 400 for invalid page parameter (page=-1)', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({ page: '-1' }, token);
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid pageSize parameter (pageSize=0)', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({ pageSize: '0' }, token);
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for pageSize exceeding maximum (101)', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({ pageSize: '101' }, token);
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for search string exceeding 100 characters', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({ search: 'a'.repeat(101) }, token);
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  // ── Successful responses ─────────────────────────────────────────────────

  it('returns 200 with users and pagination for valid admin token', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({}, token);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('users');
    expect(body).toHaveProperty('pagination');
    expect(Array.isArray(body.users)).toBe(true);
  });

  it('returns correct pagination metadata', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({ page: '1', pageSize: '2' }, token);
    
    mockGetUsers.mockReturnValue({
      users: mockUsersResult.users,
      page: 1,
      pageSize: 2,
      total: 2,
      totalPages: 1,
    });
    
    const res = await GET(req);
    const body = await res.json();

    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(2);
    expect(typeof body.pagination.total).toBe('number');
    expect(typeof body.pagination.totalPages).toBe('number');
  });

  it('applies default page=1 and pageSize=20 when no params provided', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({}, token);
    const res = await GET(req);
    const body = await res.json();

    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(20);
  });

  it('passes search parameter to getUsers', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({ search: 'alice' }, token);
    await GET(req);

    expect(mockGetUsers).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'alice' }),
    );
  });

  it('response users never contain sensitive fields', async () => {
    const token = await buildToken('admin');
    // getUsers is responsible for filtering sensitive fields, not the route
    // This test verifies that the route passes through the sanitized data
    const sanitizedUsers = [
      { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
    ];
    mockGetUsers.mockReturnValue({
      users: sanitizedUsers,
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    const req = makeRequest({}, token);
    const res = await GET(req);
    const body = await res.json();

    // Verify the route passes through the sanitized data
    body.users.forEach((u: Record<string, unknown>) => {
      expect(u).not.toHaveProperty('hashedPassword');
      expect(u).not.toHaveProperty('passwordHash');
      expect(u).not.toHaveProperty('sessionToken');
    });
  });

  // ── Audit logging ────────────────────────────────────────────────────────

  it('emits auditAdminUsersRead event on successful request', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({ page: '1', pageSize: '20' }, token);
    await GET(req);

    expect(auditAdminUsersRead).toHaveBeenCalledWith(
      'admin-123',
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        search: null,
        resultCount: 2,
      }),
    );
  });

  it('passes search parameter to audit event when provided', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({ search: 'alice' }, token);
    await GET(req);

    expect(auditAdminUsersRead).toHaveBeenCalledWith(
      'admin-123',
      expect.objectContaining({
        search: 'alice',
      }),
    );
  });

  it('does NOT emit audit event when request fails with 401', async () => {
    mockRequireAdmin.mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );

    const req = makeRequest();
    await GET(req);

    expect(auditAdminUsersRead).not.toHaveBeenCalled();
  });

  it('does NOT emit audit event when request fails with 403', async () => {
    mockRequireAdmin.mockRejectedValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    );

    const token = await buildToken('user');
    const req = makeRequest({}, token);
    await GET(req);

    expect(auditAdminUsersRead).not.toHaveBeenCalled();
  });

  it('does NOT emit audit event when request fails with 400', async () => {
    const token = await buildToken('admin');
    const req = makeRequest({ page: '0' }, token);
    await GET(req);

    expect(auditAdminUsersRead).not.toHaveBeenCalled();
  });

  // ── Error handling ───────────────────────────────────────────────────────

  it('returns 500 when requireAdmin throws unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected error'));

    const token = await buildToken('admin');
    const req = makeRequest({}, token);
    const res = await GET(req);

    expect(res.status).toBe(500);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it('returns 500 when getUsers throws an error', async () => {
    mockGetUsers.mockImplementation(() => {
      throw new Error('Database error');
    });

    const token = await buildToken('admin');
    const req = makeRequest({}, token);
    const res = await GET(req);

    expect(res.status).toBe(500);
    expect(mockLoggerError).toHaveBeenCalled();
    expect(auditAdminUsersRead).not.toHaveBeenCalled();
  });
});
