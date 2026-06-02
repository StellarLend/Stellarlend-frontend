/**
 * lib/auth/rbac.ts
 *
 * Role-Based Access Control (RBAC) utilities for Stellarlend.
 *
 * Roles are stored as a `role` claim inside the session JWT. The claim
 * value must exactly match one of the Role enum members (case-sensitive).
 *
 * Usage:
 *   import { requireAdmin } from '@/lib/auth/rbac';
 *   const user = await requireAdmin(request); // throws 401/403 on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

/** All recognised application roles. Extend as needed. */
export enum Role {
  User = 'user',
  Ops = 'ops',
  Admin = 'admin',
}

// ---------------------------------------------------------------------------
// Internal JWT types
// ---------------------------------------------------------------------------

/** Shape of the decoded JWT payload used throughout Stellarlend. */
export interface StellarJWTPayload extends JWTPayload {
  userId?: string;
  email?: string;
  name?: string;
  walletAddress?: string;
  /**
   * Role claim. Must be one of the Role enum values.
   * Assigned at session creation time by the auth system.
   */
  role?: string;
}

/** Minimal, sanitised user object returned after RBAC checks. */
export interface AdminUser {
  id: string;
  email?: string;
  name?: string;
  walletAddress?: string;
  role: Role;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'dev-secret-change-in-production';
const SESSION_COOKIE = process.env.NEXT_PUBLIC_SESSION_COOKIE ?? 'session';

/**
 * Decode and verify the session JWT from the request.
 *
 * Looks for the token in, in order:
 *   1. `Authorization: Bearer <token>` header
 *   2. Session cookie
 *
 * @throws `NextResponse` (401) when no token is present or the token is invalid/expired.
 */
async function verifySessionToken(request: NextRequest): Promise<StellarJWTPayload> {
  const secret = new TextEncoder().encode(AUTH_SECRET);

  // 1. Bearer header
  const authHeader = request.headers.get('authorization') ?? '';
  let rawToken: string | undefined;

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    rawToken = authHeader.slice(7).trim();
  }

  // 2. Session cookie fallback
  if (!rawToken) {
    rawToken = request.cookies.get(SESSION_COOKIE)?.value;
  }

  if (!rawToken) {
    throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(rawToken, secret);
    return payload as StellarJWTPayload;
  } catch {
    throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine whether a decoded JWT payload carries the requested role.
 *
 * @param payload - Decoded JWT payload.
 * @param required - The minimum role required.
 * @returns `true` when the payload's `role` claim matches the required role.
 */
export function hasRole(payload: StellarJWTPayload, required: Role): boolean {
  return payload.role === required;
}

/**
 * Guard that enforces admin-only access.
 *
 * Verifies the session token and checks that the caller holds the `admin`
 * role claim. Returns the sanitised admin user on success.
 *
 * @throws `NextResponse` (401) when authentication fails.
 * @throws `NextResponse` (403) when the caller is authenticated but lacks the admin role.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminUser> {
  const payload = await verifySessionToken(request);

  if (!hasRole(payload, Role.Admin)) {
    throw NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return {
    id: (payload.sub ?? payload.userId) as string,
    email: payload.email,
    name: payload.name,
    walletAddress: payload.walletAddress,
    role: Role.Admin,
  };
}

/**
 * Guard that enforces ops-or-admin access (admin is a superset of ops).
 *
 * @throws `NextResponse` (401/403) on failure.
 */
export async function requireOpsOrAdmin(request: NextRequest): Promise<AdminUser> {
  const payload = await verifySessionToken(request);

  if (payload.role !== Role.Admin && payload.role !== Role.Ops) {
    throw NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return {
    id: (payload.sub ?? payload.userId) as string,
    email: payload.email,
    name: payload.name,
    walletAddress: payload.walletAddress,
    role: payload.role as Role,
  };
}
