# RBAC — Role-Based Access Control

This guide documents Stellarlend's role-based access control (RBAC) model. It
explains the role hierarchy, how the `role` JWT claim is issued, how to use the
guard helpers in `lib/auth/rbac.ts`, and how to protect a new admin or ops
route. New contributors who need to onboard into admin tooling should read this
document before touching any `/api/admin/*` handler.

> **Source of truth:** the runtime behaviour described here is enforced by
> [`lib/auth/rbac.ts`](../lib/auth/rbac.ts) and verified by
> [`lib/auth/rbac.test.ts`](../lib/auth/rbac.test.ts). If the source and this
> guide disagree, trust the source.

---

## Overview

Stellarlend uses a **claim-based RBAC** model. A user's role is carried as the
`role` claim inside the session JWT issued at sign-in time; route handlers
verify the JWT and inspect that single claim to decide whether to allow the
request through. There is no separate authorization database call per request.

| Concern | Implementation |
|---|---|
| Role definition | `Role` enum in `lib/auth/rbac.ts` |
| Claim issuance | `lib/auth.ts` → `createSession` (mint the JWT) |
| Guard helpers | `requireAdmin`, `requireOpsOrAdmin`, `hasRole` in `lib/auth/rbac.ts` |
| Token verification | `jose.jwtVerify` over a Bearer header or session cookie |
| First protected route | `app/api/admin/users/route.ts` |
| Cross-references | [`docs/AUTH.md`](./AUTH.md) · [`docs/admin-onboarding.md`](./admin-onboarding.md) |

---

## Role Definitions

There are exactly three roles. They form a strict, non-overlapping enum — no
role is a "superset" at the data layer, but admin- and ops-only routes use
guard helpers (`requireAdmin` / `requireOpsOrAdmin`) which give 403 access
failures for callers holding a less-privileged role.

| Role    | Claim value | Intended privileges |
|---------|-------------|---------------------|
| `user`  | `"user"`    | Default for every authenticated borrower/lender. Can call user-facing API routes, but is rejected (403) by every admin/ops route guard. |
| `ops`   | `"ops"`     | Operations staff. Can call ops-tier endpoints (e.g. `requireOpsOrAdmin`-guarded read-only admin views) but is rejected by `requireAdmin`-only routes. |
| `admin` | `"admin"`   | Full administrative access. Passes both `requireAdmin` and `requireOpsOrAdmin`. |

Declare the enum exactly once, at the place guards live:

```ts
// lib/auth/rbac.ts
import { Role } from '@/lib/auth/rbac';
// Role.User === 'user'
// Role.Ops  === 'ops'
// Role.Admin === 'admin'
```

> [!IMPORTANT]
> Comparison is **case-sensitive** — `'Admin'` is **not** the same as
> `'admin'`. Always use the `Role` enum when minting or comparing JWTs.
> This is verified by `lib/auth/rbac.test.ts`, which asserts that a mixed-case
> `role: 'Admin'` claim is rejected with 403.

---

## Hierarchy

Conceptually (in code, not data):

```
admin ⊇ ops ⊇ user
```

- `requireAdmin` accepts **only** the `admin` role.
- `requireOpsOrAdmin` accepts either the `admin` or `ops` role.
- There is no `requireUser` helper — any successfully authenticated user with
  the `user` role can hit ordinary user-facing routes.

This matches the helpers exported by `lib/auth/rbac.ts`:

| Helper | Allowed `role` claim | Failure status |
|---|---|---|
| `requireAdmin(request)` | `"admin"` | 401 / 403 |
| `requireOpsOrAdmin(request)` | `"admin"` or `"ops"` | 401 / 403 |
| `hasRole(payload, required)` | exact match against the enum member | n/a (boolean) |

> [!NOTE]
> Issue #537 originally proposed a helper called `requireOps`. The actual
> export is `requireOpsOrAdmin` (admin is a superset of ops at the guard
> level, so the two roles are bundled together). Use `requireOpsOrAdmin`
> for any route where both `admin` and `ops` should be admitted.

> [!WARNING]
> Every guard above throws a fully-formed `NextResponse`. Route handlers
> **must** wrap the `await` in `try` / `catch` and return the thrown
> response on failure — otherwise the 401/403 will leak as an unhandled
> rejection. The worked example below demonstrates the pattern.

> `requireAdmin` only ever rejects with HTTP 401 (unknown caller) or HTTP 403
> (known caller without the `admin` role). It never returns a `User` —
> callers must catch and forward the thrown `NextResponse`.

---

## Claim Issuance

The `role` claim is added to the session JWT **at sign-in time**. After that
the role is fixed until the token expires; role changes therefore require the
caller to be re-authenticated (or their existing JWT re-issued).

### Where it is minted

`createSession()` in `lib/auth.ts` is the single function responsible for
signing session JWTs.

> [!NOTE]
> The snippet below shows the **intended signing shape** — i.e. how
> `createSession` should look once it accepts and emits the `role` claim.
> The current `createSession(user: Partial<User>)` does **not** yet read or
> write a `role` field, so adding the claim is a prerequisite for these
> guards to do anything useful. Concretely, mint the JWT so the
> `role` claim is present in the payload:

```ts
// lib/auth.ts (target shape)
import { SignJWT } from 'jose';
import { Role } from '@/lib/auth/rbac';

export async function createSession(user: {
  id: string;
  email?: string;
  name?: string;
  walletAddress?: string;
  role: Role;          // ← 'user' | 'ops' | 'admin' (case-sensitive)
}): Promise<string> {
  const secret = new TextEncoder().encode(AUTH_CONFIG.sessionSecret);
  const alg = 'HS256';

  const token = await new SignJWT({
    userId: user.id,
    walletAddress: user.walletAddress,
    email: user.email,
    name: user.name,
    role: user.role,        // ← 'user' | 'ops' | 'admin' (case-sensitive)
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(`${AUTH_CONFIG.sessionExpiryHours}h`)
    .sign(secret);

  return token;
}
```

Pick `user.role` from your user store (e.g. a `users.role` column). Until the
token expires, the caller carries that exact role — re-promote by issuing a
fresh JWT.

> [!CAUTION]
> Never grant `admin` in public-facing or self-service code paths. Admin
> promotions must come from a separate, gated process — typically a CLI
> script, a database migration run by a super-admin, or a manual DB update.
> See [`docs/admin-onboarding.md`](./admin-onboarding.md#granting-the-admin-role)
> for the full procedure.

### Verification (where the claim is read)

`requireAdmin` / `requireOpsOrAdmin` call `verifySessionToken()` internally. That
helper looks for the token in this order:

1. `Authorization: Bearer <token>` request header
2. Session cookie named `NEXT_PUBLIC_SESSION_COOKIE` (default `session`)

If neither is present, or the JWT signature is invalid, or it has expired, the
guard throws a `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`.

---

## Guards

All three helpers are pure functions of `(request, …)` and throw
`NextResponse` instances on failure. Route handlers must therefore catch and
return the thrown response.

### `requireAdmin(request)`

- **Verifies** the JWT signature and expiry.
- **Requires** `role === 'admin'`.
- **Throws:** `NextResponse` with HTTP 401 if authentication fails, HTTP 403
  if authenticated but the role is not `admin`.
- **Returns:** an `AdminUser` with `{ id, email?, name?, walletAddress?, role }`.

### `requireOpsOrAdmin(request)`

- **Verifies** the JWT signature and expiry.
- **Requires** `role === 'admin'` **or** `role === 'ops'`.
- **Throws:** HTTP 401 on auth failure, HTTP 403 otherwise.
- **Returns:** an `AdminUser` whose `role` reflects the caller's actual role.

### `hasRole(payload, required)`

- Pure boolean helper. Does **not** verify the JWT — pass an already-decoded
  `StellarJWTPayload` (the test suite demonstrates both `'admin'` strings and
  the `Role.Admin` enum value matching).
- Useful for custom handlers that need a different policy than the canned
  guards.

---

## Worked Example: Protecting a New Route

Below is a copy-pasteable handler template that meets the production standard,
parallel to `app/api/admin/users/route.ts`. It works against the **current**
`lib/auth/rbac.ts` API (verified against `lib/auth/rbac.test.ts`).

```ts
// app/api/admin/example/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/rbac';

export const runtime = 'nodejs';

const ROUTE = '/api/admin/example';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Authentication & authorisation ──────────────────────────────────────
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (authError) {
    // requireAdmin throws a pre-built NextResponse; re-throw it as-is
    if (authError instanceof NextResponse) {
      return authError;
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }

  // ── 2. Your route logic goes here … ────────────────────────────────────────
  return NextResponse.json(
    { ok: true, actor: admin.id },
    { status: 200 },
  );
}
```

For an ops-tier endpoint, swap `requireAdmin` for `requireOpsOrAdmin`:

```ts
// app/api/ops/example/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { requireOpsOrAdmin } from '@/lib/auth/rbac';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const caller = await requireOpsOrAdmin(request);
    return NextResponse.json({ ok: true, caller });
  } catch (authError) {
    if (authError instanceof NextResponse) return authError;
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

---

## Edge Cases & Error Matrix

These are verified end-to-end by `lib/auth/rbac.test.ts` and
`__tests__/admin/users.test.ts`.

| Caller state | Guard | Outcome |
|---|---|---|
| No `Authorization` header and no session cookie | `requireAdmin` / `requireOpsOrAdmin` | **401** `{ error: 'Unauthorized' }` |
| `Authorization: Token …` (not `Bearer`) | `requireAdmin` | **401** `{ error: 'Unauthorized' }` (only Bearer is honoured) |
| Bearer token has expired (`exp` in past) | `requireAdmin` | **401** `{ error: 'Unauthorized' }` |
| Bearer token signed with a different `AUTH_SECRET` | `requireAdmin` | **401** `{ error: 'Unauthorized' }` |
| Bearer token tampered with | `requireAdmin` | **401** `{ error: 'Unauthorized' }` |
| Valid JWT, `role` is `superuser` (unknown string) | `requireAdmin` / `requireOpsOrAdmin` | **403** `{ error: 'Forbidden' }` |
| Valid JWT, `role` is `Admin` (capitalised) | `requireAdmin` / `requireOpsOrAdmin` | **403** `{ error: 'Forbidden' }` (case-sensitive) |
| Valid JWT, `role` is `user` | `requireAdmin` / `requireOpsOrAdmin` | **403** `{ error: 'Forbidden' }` |
| Valid JWT, `role` is `ops` | `requireAdmin` | **403** `{ error: 'Forbidden' }` |
| Valid JWT, `role` is `ops` | `requireOpsOrAdmin` | **200** — returns `AdminUser` with `role: Role.Ops` |
| Valid JWT, `role` is `admin` | `requireAdmin` / `requireOpsOrAdmin` | **200** — returns `AdminUser` with `role: Role.Admin` |

> [!NOTE]
> `401` means "we don't know who you are"; `403` means "we know who you are,
> but you can't do this". Always emit the correct one — clients can use it
> to prompt re-authentication vs. escalate to a support contact.

---

## Environment Variables

| Variable | Default | Used by |
|---|---|---|
| `AUTH_SECRET` | `dev-secret-change-in-production` | JWT signing/verification (`lib/auth/rbac.ts` and `lib/auth.ts`) |
| `NEXT_PUBLIC_SESSION_COOKIE` | `session` | Cookie name read by `verifySessionToken` |

Set `AUTH_SECRET` to `$(openssl rand -base64 32)` (or equivalent) in every
non-development environment. See
[`docs/ENVIRONMENT.md`](./ENVIRONMENT.md) for the full variable catalogue.

---

## Verification Checklist

Before opening a PR that touches any RBAC code path, run the focused suites
that lock down these behaviours:

```bash
# Guard behaviour (401 / 403 / case-sensitivity / unknown roles)
pnpm vitest run lib/auth/rbac.test.ts

# Integration via the admin users endpoint
pnpm vitest run __tests__/admin/users.test.ts
```

Target: **≥ 95 % statement coverage** on changed RBAC routes and on any new
guards.

---

## Cross-references

- [`docs/AUTH.md`](./AUTH.md) — JWT, session cookies, `getUser`, `getSession`,
  and other session utilities.
- [`docs/admin-onboarding.md`](./admin-onboarding.md) — How to grant the
  admin role at sign-in (the side of RBAC that this doc intentionally does
  **not** cover) and the `/api/admin/users` reference.
- [`lib/auth/rbac.ts`](../lib/auth/rbac.ts) — The source of truth.
- `lib/auth.ts` — Where the JWT (and therefore the `role` claim) is signed.

---

## See also

- OWASP — [Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- RFC 8725 — [JSON Web Token Best Current Practices](https://tools.ietf.org/html/rfc8725)
