/**
 * lib/validation/schemas/admin.ts
 *
 * Shared Zod validation schemas for admin API routes.
 */

import { z } from 'zod';

/** Maximum number of users that may be returned in a single page. */
export const ADMIN_USERS_MAX_PAGE_SIZE = 100;

/** Default page size for the admin users listing. */
export const ADMIN_USERS_DEFAULT_PAGE_SIZE = 20;

/**
 * Query-parameter schema for `GET /api/admin/users`.
 *
 * All params are optional; sensible defaults are applied automatically.
 */
export const adminUsersQuerySchema = z.object({
  /** 1-based page number. */
  page: z.coerce
    .number()
    .int('page must be an integer')
    .positive('page must be >= 1')
    .default(1),

  /** Number of records per page (1 – 100). */
  pageSize: z.coerce
    .number()
    .int('pageSize must be an integer')
    .min(1, 'pageSize must be >= 1')
    .max(ADMIN_USERS_MAX_PAGE_SIZE, `pageSize must be <= ${ADMIN_USERS_MAX_PAGE_SIZE}`)
    .default(ADMIN_USERS_DEFAULT_PAGE_SIZE),

  /**
   * Optional search term.
   * Applied as a case-insensitive substring match on `email` and `name`.
   * Maximum 100 characters to prevent oversized queries.
   */
  search: z.string().max(100, 'search must be <= 100 characters').optional(),
});

export type AdminUsersQueryInput = z.infer<typeof adminUsersQuerySchema>;
