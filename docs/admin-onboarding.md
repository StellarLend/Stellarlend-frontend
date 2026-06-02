# Admin Onboarding — Stellarlend

This document explains how to grant admin access, how the RBAC system works, and how to use the `/api/admin/users` endpoint.

---

## Overview

Stellarlend uses a **claim-based RBAC** model. The role is stored as a `role` claim inside the session JWT. Three roles exist:

| Role    | Value     | Description                                    |
|---------|-----------|------------------------------------------------|
| User    | `user`    | Standard authenticated user                    |
| Ops     | `ops`     | Operations staff with elevated read access     |
| Admin   | `admin`   | Full admin access to administrative endpoints  |

---

## Granting the Admin Role

The admin role is embedded in the session JWT at sign-in time. To grant admin access:

1. **Set the `role` claim** when minting the JWT in your authentication flow (e.g. in `lib/auth.ts` → `createSession`):

   ```ts
   // Example: promote a known ops user to admin at session creation
   const token = await new SignJWT({
     userId: user.id,
     email:  user.email,
     role:   'admin',           // ← add this claim
   })
     .setProtectedHeader({ alg: 'HS256' })
     .setIssuedAt()
     .setExpirationTime('24h')
     .sign(secret);
   ```

2. **Store the role** in your user database / management console (Supabase, Auth0, custom DB). The simplest approach is a `role` column on your `users` table.

3. **Re-issue the session token** after a role change — existing tokens remain valid until expiry.

> [!CAUTION]
> Never grant `admin` programmatically in public-facing code paths. Admin promotions must be gated behind a separate privileged process (e.g. a CLI script, a migrations run by a super-admin, or a manual DB update).

---

## Environment Variables

| Variable                     | Default                              | Purpose                          |
|------------------------------|--------------------------------------|----------------------------------|
| `AUTH_SECRET`                | `dev-secret-change-in-production`    | HMAC secret for JWT signing      |
| `NEXT_PUBLIC_SESSION_COOKIE` | `session`                            | Session cookie name              |

> [!IMPORTANT]
> Change `AUTH_SECRET` to a cryptographically random value (≥ 32 chars) in every non-development environment.

---

## Using the `/api/admin/users` Endpoint

### Request

```
GET /api/admin/users
Authorization: Bearer <admin-jwt>
```

### Query Parameters

| Parameter  | Type    | Default | Maximum | Description                                            |
|------------|---------|---------|---------|--------------------------------------------------------|
| `page`     | integer | 1       | –       | 1-based page number                                    |
| `pageSize` | integer | 20      | 100     | Records per page                                       |
| `search`   | string  | –       | 100 chars | Substring match on `email` and `name` (case-insensitive) |

### Example — curl

```bash
# Obtain an admin token first (example: via your auth endpoint)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@stellarlend.io","password":"…"}' \
  | jq -r '.token')

# List users — page 2, 10 per page
curl -G http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "page=2" \
  --data-urlencode "pageSize=10"

# Search by name
curl -G http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "search=alice"
```

### Successful Response (200)

```json
{
  "users": [
    {
      "id": "usr_001",
      "email": "alice@stellarlend.io",
      "name": "Alice Nakamoto",
      "walletAddress": "GABC1234567890",
      "role": "user",
      "status": "active",
      "createdAt": "2025-01-10T09:00:00.000Z",
      "updatedAt": "2025-01-10T09:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

> [!NOTE]
> Response fields are restricted to a safe allow-list. **Hashed passwords, session tokens, and private keys are never returned.**

### Error Responses

| Status | Condition                                            |
|--------|------------------------------------------------------|
| 400    | Invalid query params (bad `page`, `pageSize`, etc.)  |
| 401    | Missing or expired JWT                               |
| 403    | Valid JWT but caller does not hold the `admin` role  |
| 500    | Unexpected server error                              |

---

## Audit Logging

Every successful call to `/api/admin/users` emits a structured audit event to **stdout** in NDJSON format:

```json
{
  "type": "AUDIT",
  "timestamp": "2026-06-02T05:00:00.000Z",
  "action": "admin.users.read",
  "actorId": "usr_003",
  "context": {
    "queryParams": { "page": 1, "pageSize": 20, "search": null, "resultCount": 3 }
  }
}
```

Route these logs to your SIEM / audit store via your log aggregation pipeline (Datadog, CloudWatch, Loki, etc.).

---

## Running Tests

```bash
# Run only the admin tests
pnpm vitest run __tests__/admin/users.test.ts

# Run with coverage
pnpm vitest run --coverage __tests__/admin/users.test.ts
```

Target: **≥ 95 % statement coverage** for the new modules.

---

## Files Added by This Feature

| File                                          | Purpose                                               |
|-----------------------------------------------|-------------------------------------------------------|
| `lib/auth/rbac.ts`                            | Role definitions, JWT claim extraction, RBAC guards   |
| `lib/validation/schemas/admin.ts`             | Zod schema for query params                           |
| `lib/db/users.ts`                             | User data-access layer (replace with real DB calls)   |
| `lib/audit/logger.ts`                         | Structured audit event emitter                        |
| `app/api/admin/users/route.ts`                | The admin users route handler                         |
| `__tests__/admin/users.test.ts`               | Comprehensive test suite                              |
| `openapi.yaml`                                | Updated with admin endpoint, schemas, security scheme |
| `docs/admin-onboarding.md`                    | This document                                         |
