/**
 * app/api/admin/users/route.ts
 *
 * GET /api/admin/users
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-only endpoint that returns a paginated list of platform users.
 *
 * SECURITY
 *   - Requires a valid session JWT with `role: "admin"` claim (checked by
 *     `requireAdmin`).  Returns 401 when unauthenticated, 403 when the caller
 *     lacks the admin role.
 *   - Response fields are restricted to a minimal, non-sensitive allow-list.
 *     Hashed credentials, session tokens, and private keys are NEVER included.
 *   - Every successful call emits a structured audit event via `auditAdminUsersRead`.
 *
 * QUERY PARAMETERS (all optional)
 *   page      – 1-based page number        (default: 1)
 *   pageSize  – records per page, 1-100    (default: 20)
 *   search    – substring match on email / name (max 100 chars)
 *
 * RESPONSE (200)
 *   {
 *     users: AdminUserRecord[],
 *     pagination: {
 *       page: number,
 *       pageSize: number,
 *       total: number,
 *       totalPages: number
 *     }
 *   }
 *
 * ERRORS
 *   400 – invalid query parameters (Zod validation failure)
 *   401 – missing or invalid session token
 *   403 – authenticated but does not hold the admin role
 *   500 – unexpected server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/rbac';
import { adminUsersQuerySchema } from '@/lib/validation/schemas/admin';
import { getUsers } from '@/lib/db/users';
import { auditAdminUsersRead } from '@/lib/audit/logger';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const ROUTE = '/api/admin/users';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── 1. Authentication & authorisation ──────────────────────────────────────
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (authError) {
    // requireAdmin throws a pre-built NextResponse; re-throw it as-is
    if (authError instanceof NextResponse) {
      return authError;
    }
    logger.error('Unexpected auth error', ROUTE, authError);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  // ── 2. Parse & validate query parameters ───────────────────────────────────
  const { searchParams } = request.nextUrl;
  const rawParams = {
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  };

  const parsed = adminUsersQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid query parameters',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { page, pageSize, search } = parsed.data;

  // ── 3. Fetch users ─────────────────────────────────────────────────────────
  let result;
  try {
    result = getUsers({ page, pageSize, search });
  } catch (dbError) {
    logger.error('Failed to fetch users from data store', ROUTE, dbError);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  // ── 4. Emit audit event ────────────────────────────────────────────────────
  auditAdminUsersRead(admin.id, {
    page,
    pageSize,
    search: search ?? null,
    resultCount: result.users.length,
  });

  // ── 5. Return response ─────────────────────────────────────────────────────
  return NextResponse.json(
    {
      users: result.users,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    },
    { status: 200 },
  );
}
