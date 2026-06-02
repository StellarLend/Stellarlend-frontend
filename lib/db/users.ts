/**
 * lib/db/users.ts
 *
 * Data-access helpers for user records used by the admin API.
 *
 * Because this codebase does not currently integrate an ORM, the functions
 * below operate against an in-memory store by default and are designed to be
 * trivially replaced with real DB calls (Prisma, Drizzle, Supabase, etc.)
 * by swapping the `USER_STORE` implementation.
 *
 * Fields intentionally NEVER returned:
 *   - hashedPassword / passwordHash
 *   - sessionToken / refreshToken
 *   - any raw secrets
 */

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  walletAddress?: string;
  role: string;
  status: 'active' | 'suspended' | 'pending';
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

export interface GetUsersOptions {
  page: number;
  pageSize: number;
  search?: string;
}

export interface GetUsersResult {
  users: AdminUserRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// In-memory seed (replace with DB query in production)
// ---------------------------------------------------------------------------

/** @internal Seed data – replace with a real DB query in production. */
export const USER_STORE: AdminUserRecord[] = [
  {
    id: 'usr_001',
    email: 'alice@stellarlend.io',
    name: 'Alice Nakamoto',
    walletAddress: 'GABC1234567890',
    role: 'user',
    status: 'active',
    createdAt: '2025-01-10T09:00:00.000Z',
    updatedAt: '2025-01-10T09:00:00.000Z',
  },
  {
    id: 'usr_002',
    email: 'bob@stellarlend.io',
    name: 'Bob Satoshi',
    role: 'ops',
    status: 'active',
    createdAt: '2025-02-14T12:30:00.000Z',
    updatedAt: '2025-03-01T08:00:00.000Z',
  },
  {
    id: 'usr_003',
    email: 'carol@stellarlend.io',
    name: 'Carol Lumina',
    walletAddress: 'GXYZ9876543210',
    role: 'admin',
    status: 'active',
    createdAt: '2025-03-01T08:00:00.000Z',
    updatedAt: '2025-03-01T08:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Data-access function
// ---------------------------------------------------------------------------

/**
 * Retrieve a paginated, optionally filtered list of users.
 *
 * In production this should be replaced with a parameterised DB query that:
 *   - Uses `LIMIT` / `OFFSET` (or cursor-based pagination) for efficiency.
 *   - Applies the search filter in SQL (`ILIKE '%term%'`) rather than in JS.
 *   - Never selects password hashes or token columns.
 *
 * @param opts - Pagination and optional search options.
 * @returns Paginated result including users and metadata.
 */
export function getUsers(opts: GetUsersOptions): GetUsersResult {
  const { page, pageSize, search } = opts;

  // Filter
  let filtered = USER_STORE;
  if (search) {
    const term = search.toLowerCase();
    filtered = USER_STORE.filter(
      (u) =>
        u.email.toLowerCase().includes(term) ||
        u.name.toLowerCase().includes(term),
    );
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;
  const users = filtered.slice(offset, offset + pageSize);

  return { users, total, page, pageSize, totalPages };
}
