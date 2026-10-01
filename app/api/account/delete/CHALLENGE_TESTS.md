# Account Deletion Challenge Tests

This document outlines the test plan for the account deletion challenge flow:
challenge issuance (`GET /api/account/delete/challenge`) and the challenge
verification gate (`DELETE /api/account/delete`).

## Test Scopes

### `GET /api/account/delete/challenge` — Challenge issuance

| # | Test | Expected |
|---|------|----------|
| 1 | Unauthenticated request | `401` |
| 2 | Invalid / malformed token | `401` |
| 3 | Authenticated request returns a 64-hex challenge token | `200` + `challenge`, `expiresAt`, `message` in body |
| 4 | Challenge is single-use (immediate verify + re-verify via `verifyDeletionChallenge`) | First `true`, second `false` |
| 5 | Audit event `auth.challenge.issued` is emitted | Event present with `challengeType: 'account_deletion'` |

### `DELETE /api/account/delete` — Challenge verification gate

| # | Test | Expected |
|---|------|----------|
| 6 | Unauthenticated request | `401` |
| 7 | Missing `challenge` in body | `400` with `'Missing deletion challenge'` |
| 8 | Malformed JSON body | `400` |
| 9 | Nonexistent challenge string | `401` with `'Invalid or expired'` |
| 10 | Challenge issued for a different user | `401` |
| 11 | Valid challenge accepted; `deleteAccount` called | `200` with `'Account deletion initiated'` |
| 12 | Replay of an already consumed challenge | `401` with `'Invalid or expired'` |
| 13 | Expired challenge (TTL window passed) | `401` with `'Invalid or expired'` |

## Implementation notes

- **File**: `app/api/account/delete/challenge/route.test.ts`
- The challenge store is the real in-memory implementation (not mocked) so that the
  full challenge lifecycle is exercised at the route level.
- `@/lib/account/delete` is mocked because the focus is on the verification gate;
  full deletion integration (profile anonymization, notification removal, cleanup
  jobs) is covered in `__tests__/api/account/delete.test.ts`.
- Rate-limit 429 behaviour is tested separately in
  `app/api/account/delete/challenge/route.ratelimit.test.ts`.
- Fake timers (`vi.useFakeTimers`) are used for the expired-challenge edge case.
