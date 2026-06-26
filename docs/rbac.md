# RBAC Guide

Stellarlend uses claim-based RBAC for admin-facing API routes. The source of truth is `lib/auth/rbac.ts`.

## Roles

`Role` is a string enum. Role matching is exact and case-sensitive.

| Enum | Claim value | Intended privileges |
| --- | --- | --- |
| `Role.User` | `user` | Standard authenticated user. No admin API access. |
| `Role.Ops` | `ops` | Operations staff. May access ops/admin read tools guarded by `requireOpsOrAdmin`. |
| `Role.Admin` | `admin` | Full administrative access. Required by `requireAdmin`. |

Unknown strings, missing roles, and differently cased values such as `Admin` do not match any role.

## Claim Flow

The role is stored as the `role` claim inside the session JWT. The RBAC helper verifies tokens from:

1. `Authorization: Bearer <token>`
2. The session cookie named by `NEXT_PUBLIC_SESSION_COOKIE`, defaulting to `session`

The JWT is verified with `AUTH_SECRET`. If verification fails, the guard throws a `NextResponse` with status `401`.

Example session payload:

```ts
{
  sub: 'user_123',
  email: 'ops@stellarlend.io',
  role: 'ops',
}
```

Role changes only affect newly issued tokens. Re-issue the session after promoting or demoting a user.

## Guard Helpers

`hasRole(payload, required)` performs an exact role claim comparison:

```ts
hasRole({ role: 'admin' }, Role.Admin); // true
hasRole({ role: 'Admin' }, Role.Admin); // false
```

`requireAdmin(request)`:

- Returns an `AdminUser` when the JWT is valid and `role` is exactly `admin`.
- Throws `401` for a missing, invalid, or expired token.
- Throws `403` for authenticated users without the `admin` role.

`requireOpsOrAdmin(request)`:

- Returns an `AdminUser` when the JWT role is `ops` or `admin`.
- Throws `401` for a missing, invalid, or expired token.
- Throws `403` for `user`, unknown role strings, or absent role claims.

There is no standalone `requireOps` helper in the current API. Use `requireOpsOrAdmin` for operations tooling where admins should remain a superset of ops.

## Protecting A Route

Use the guard at the top of the route and return the thrown `NextResponse` unchanged.

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { requireOpsOrAdmin } from '@/lib/auth/rbac';

export async function GET(request: NextRequest): Promise<NextResponse> {
  let actor;

  try {
    actor = await requireOpsOrAdmin(request);
  } catch (authError) {
    if (authError instanceof NextResponse) {
      return authError;
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    actorId: actor.id,
    role: actor.role,
  });
}
```

Use `requireAdmin` for endpoints that can mutate users, roles, balances, or system configuration.

## Existing Routes

`app/api/admin/users/route.ts` uses `requireAdmin`. It returns:

- `401` when no bearer token/session cookie is present or JWT verification fails.
- `403` when the caller is authenticated but does not have `role: 'admin'`.
- `200` for valid admin tokens.

`app/api/admin/migrate-status/route.ts` is an internal admin route protected by `x-server-token` and `serverConfig.server.token`. It does not currently use JWT role claims. Keep that model for service-to-service/internal automation, or migrate to `requireOpsOrAdmin` if the endpoint should be callable by human ops/admin sessions.

## Operational Notes

- Never grant `admin` in public sign-up or self-service profile flows.
- Store role assignments in the user management system and mint them into JWTs during session creation.
- Keep `AUTH_SECRET` different per environment and rotate sessions after role changes.
- Include successful admin actions in audit logs, as `app/api/admin/users/route.ts` does with `auditAdminUsersRead`.
