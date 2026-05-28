# Stellarlend Backend Architecture

This document describes the server-side API surface and the `lib/` modules that back it.
The machine-readable contract for every route lives in [openapi.yaml](../openapi.yaml).

---

## Overview

Stellarlend uses **Next.js App Router** route handlers (`app/api/*/route.ts`) as its API layer.
All handlers run on the **Node.js runtime** (`export const runtime = 'nodejs'`) so they can
access cookies, perform crypto operations, and use Node-only packages.

```
app/api/
├── auth/session/route.ts      POST | GET | DELETE  – session lifecycle
├── health/route.ts            GET                  – platform health check
├── markets/route.ts           GET                  – per-asset APR & utilization  ← #193
├── notifications/
│   ├── route.ts               GET                  – list user notifications       ← #195
│   └── [id]/route.ts          PATCH                – mark notification read        ← #195
├── positions/route.ts         GET                  – user positions
├── prices/route.ts            GET                  – asset spot prices
├── quote/route.ts             POST                 – lending / borrowing quote
└── transactions/
    ├── route.ts               GET | POST           – transactions CRUD
    └── export/route.ts        GET                  – CSV export
```

---

## lib/ Server Modules

### lib/config.ts — Public configuration

Reads `NEXT_PUBLIC_*` env vars and exposes a typed `Config` object.
Safe to import on both client and server.

Key fields used by the API layer:

| Path | Env var | Default |
|---|---|---|
| `stellar.sorobanRpcUrl` | `NEXT_PUBLIC_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `stellar.horizonUrl` | `NEXT_PUBLIC_STELLAR_HORIZON_URL` | `https://horizon-testnet.stellar.org` |
| `api.timeout` | — | 10 000 ms |

### lib/server-config.ts — Server-only secrets

Imports `server-only` to prevent accidental client bundle inclusion.
Reads `AUTH_SECRET`, `AUTH_ORACLE_API_KEY`, `SERVER_TOKEN` from env.

### lib/auth.ts — Session management

| Function | Description |
|---|---|
| `getSession()` | Reads and validates the session cookie; returns `Session \| null` |
| `getUser()` | Convenience wrapper; returns `User \| null` |
| `getAuthenticatedUser()` | Throws `AuthError` if not authenticated |
| `isAuthenticated()` | Boolean check |
| `getSessionExpiry()` | Returns `{ expiresAt, expiresIn }` |

Sessions are stored as JWTs in an HttpOnly `SameSite=strict` cookie (`session`).
The cookie name is configurable via `NEXT_PUBLIC_SESSION_COOKIE`.

**Production note:** Replace the placeholder `verifySessionSignature` with a
proper JWT library (`jose` or `jsonwebtoken`).

### lib/cache/index.ts — In-memory SWR cache

`InMemoryCache` implements a two-phase expiry model:

```
|<-- TTL window -->|<-- SWR window -->|  expired
   fresh (HIT)       stale (STALE)
```

* **HIT** — entry is within TTL; returned immediately.
* **STALE** — entry is past TTL but within the SWR window; stale value returned
  immediately while a background revalidation is triggered (non-blocking).
* **MISS** — entry is fully expired or absent; fetcher is awaited synchronously.
* **BYPASS** — caller has auth credentials; cache is skipped entirely.

The `globalCache` singleton is shared across all route handlers within a single
server process.

Cache keys follow the convention `<domain>:<dimension>:<value>`:

| Route | Key pattern | TTL / SWR |
|---|---|---|
| `/api/prices` | `price:assets:XLM,USDC` | 5 s / 10 s |
| `/api/markets` | `markets:assets:BTC,ETH` | 30 s / 60 s |
| `/api/positions` | `positions:public` | 10 s / 20 s |

### lib/http/client.ts — HTTP client

`httpGet<T>(url, options?)` — GET with exponential-backoff retry (3 attempts).
`httpPost<T>(url, body, options?)` — POST with a single attempt.

Both functions honour a configurable `timeoutMs` (default 10 s) via
`AbortController` and throw typed errors:

| Error class | When |
|---|---|
| `TimeoutError` | Request exceeded `timeoutMs` |
| `NetworkError` | Network-level failure (DNS, refused connection) |
| `UpstreamHttpError` | Non-2xx response from upstream |

### lib/lending/ — Quote calculations

`lib/lending/types.ts` — `LendingData`, `CalculationResult` interfaces.
`lib/lending/quote.ts` — `calculateQuote(type, data)` — pure math, no I/O.

* **Lend:** daily compound earnings over `duration` days.
* **Borrow:** amortised monthly repayments using the standard annuity formula.

### lib/markets/ — Market data (new, #193)

`lib/markets/types.ts` — `AssetMarket`, `MarketsResponse`.
`lib/markets/repository.ts` — `fetchMarkets(assets)` — documented Soroban RPC
stub returning representative APR and utilization values.

**Production integration steps** are documented inline in `repository.ts`:
call `get_reserve_data(asset_address)` on the Soroban lending pool contract
(address set via `SOROBAN_LENDING_POOL_CONTRACT_ID`) and decode the XDR response.

### lib/notifications/ — Notification store (new, #195)

`lib/notifications/types.ts` — `Notification`, `NotificationsResponse`, `NotificationType`.
`lib/notifications/repository.ts` — in-memory store keyed by `userId` with seed data.

| Function | Description |
|---|---|
| `getNotifications(userId)` | Returns all notifications, seeding on first access |
| `markNotificationRead(userId, id)` | Sets `read: true`; returns `Notification \| null` |
| `clearStore()` | Test helper – wipes the in-memory store |

**Production note:** Replace the `Map`-backed store with a database repository
(e.g. Prisma + PostgreSQL or Supabase).

### lib/transactions/ — Transaction utilities

CSV export, filtering helpers, and validation used by `/api/transactions/export`.

### lib/api/etag.ts — ETag utilities

`generateETag(data)` — deterministic ETag for conditional GET (`If-None-Match`).
Used by read routes to return `304 Not Modified` and save bandwidth.

---

## Type Definitions

All canonical vocabulary is defined in `types/enums.ts` and acts as the single
source of truth for both the API validation layer and the UI:

| Export | Values |
|---|---|
| `ASSET_SYMBOLS` / `AssetSymbol` | `XLM \| USDC \| BTC \| ETH` |
| `TRANSACTION_TYPES` / `TransactionType` | `Deposit \| Withdrawal \| Lend Funds \| Loan Payment` |
| `TRANSACTION_STATUSES` / `TransactionStatus` | `Completed \| Processing \| Failed` |

Type guards (`isAssetSymbol`, `isTransactionType`, `isTransactionStatus`) are used in
route handlers to validate query parameters before processing.

The `Transaction` interface lives in `types/Transaction.ts`.
`LendingData` and `CalculationResult` live in `lib/lending/types.ts`.

---

## Security Model

* **Secrets isolation:** `lib/server-config.ts` imports `server-only`; any
  accidental client import fails at build time.
* **Session tokens:** HttpOnly + SameSite=strict cookie prevents XSS and CSRF.
* **Cache bypass:** Authenticated requests always skip the shared cache to
  prevent cross-user data leakage.
* **Input validation:** All API query params are validated against canonical
  enum lists; unknown values return 400 with a descriptive message.
* **Notification scoping:** Notifications are keyed by `userId`; a user can
  only read and mutate their own notifications.

---

## Adding a New Route

1. Create `app/api/<name>/route.ts` with `export const runtime = 'nodejs'`.
2. Define request/response types in `lib/<name>/types.ts`.
3. Implement the data fetcher/repository in `lib/<name>/repository.ts`.
4. Wire caching via `globalCache.getOrFetch(...)` (public routes) or skip it
   (authenticated routes that are inherently user-scoped).
5. Validate all query/body inputs against canonical enums or Zod schemas.
6. Add the route to `openapi.yaml` under `paths:` and its schemas under
   `components/schemas:`.
7. Write route tests in `lib/<name>/<name>.test.ts` following the pattern in
   `lib/markets/markets.test.ts` or `lib/cache/routes.test.ts`.
