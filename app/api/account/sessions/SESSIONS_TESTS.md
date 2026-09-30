# Account Sessions Routes — Integration Test Plan

## Files

| File | Route tested |
|------|-------------|
| `app/api/account/sessions/route.test.ts` | `GET /api/account/sessions` |
| `app/api/account/sessions/[id]/route.test.ts` | `DELETE /api/account/sessions/[id]` |

---

## GET /api/account/sessions

| # | Scenario | Expected |
|---|----------|----------|
| 1 | No session cookie / unauthenticated | `401 Unauthorized` |
| 2 | Session exists but `user.id` is absent | `401 Unauthorized` |
| 3 | Authenticated — returns only the caller's sessions | `200` with scoped session list |
| 4 | `listStoredSessions` called with the correct `userId` | Verified via mock assertion |
| 5 | Current session is flagged `current: true` | Session whose `id === session.user.id` is marked |
| 6 | `touchStoredSession` is called for the current session | Verified via mock assertion |
| 7 | User has no stored sessions | `200` with `sessions: []` |
| 8 | Sessions of other users are never returned | `listStoredSessions` never called with another user's id |
| 9 | Response shape is correct | `id`, `current`, `device.userAgent`, `device.ipAddress`, `createdAt`, `lastSeenAt` |

---

## DELETE /api/account/sessions/[id]

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Unauthenticated request | `401 Unauthorized` |
| 2 | Session with missing `user.id` | `401 Unauthorized` |
| 3 | Target session does not exist | `404 Session not found` |
| 4 | Target session belongs to a different user (foreign id) | `404 Session not found`, no revocation |
| 5 | Revoking the current session without `?confirm=true` | `400` with error referencing `confirm` |
| 6 | Revoking the current session with `?confirm=true` | `200 { revoked: true }`, session revoked |
| 7 | Revoking a non-current session | `200 { revoked: true }`, `revokeStoredSession` called |
| 8 | Revocation does not affect other users' sessions | `revokeStoredSession` not called for foreign session |
| 9 | Audit event emitted on successful revoke | `console.info('audit.session.revoked', { sessionId, userId, revokedAt })` |
| 10 | No audit event on `401` | `console.info` not called |
| 11 | No audit event on `404` | `console.info` not called |
| 12 | Already-revoked session (idempotent) | Route returns `200` both times (store behaviour unchanged) |

---

## Running the Tests

```bash
# Run just the sessions tests
npx vitest run app/api/account/sessions

# Or via npm script pattern
npm test -- sessions
```

---

## Mocking Strategy

Both suites mock at the module boundary:

- `@/lib/auth` → `getSession` — controls authentication state without touching cookies or JWTs.
- `@/lib/auth/session-store` → `listStoredSessions`, `touchStoredSession`, `getStoredSession`, `revokeStoredSession` — controls the in-memory session store without side-effects across tests.

`console.info` is spied on to assert the audit log line emitted by the DELETE handler.
