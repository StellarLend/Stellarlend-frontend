# Rate Limiting

The frontend applies two distinct rate limits to its `/api/*` routes, layered
on top of each other:

1. A **global per-IP limiter** enforced inside `middleware.ts` on every
   request that reaches the API surface.
2. A **per-account token-bucket limiter** that protects sensitive
   transaction-submission endpoints from a single wallet spamming the network,
   even when the caller rotates IPs.

Both limiters are in-memory (per process) and intended to provide best-effort
abuse mitigation at the edge. They are not a substitute for a hardened upstream
gateway.

## Global per-IP limiter — `lib/rate-limit.ts`

`rateLimit(identifier, limit, windowMs)` is a sliding fixed-window counter
keyed by an arbitrary identifier string. Every call:

1. Looks up the bucket for the identifier in a `Map`.
2. If the bucket is missing or its `reset` has passed, starts a new window
   with `count = 1`.
3. Otherwise, increments `count` and returns the result.

Expired entries are purged lazily by a once-an-hour sweep inside
`cleanupExpiredEntries()`.

### `RateLimitResult`

```ts
interface RateLimitResult {
  success: boolean;   // false once the count has exceeded the limit
  limit: number;      // configured ceiling for the window
  remaining: number;  // requests still allowed in the current window (>= 0)
  reset: number;      // epoch milliseconds at which the window flips
}
```

### `clearRateLimitCache()`

Reset helper used by the test suite to keep tests deterministic. Do not call
this from request paths.

## Per-account token bucket — `lib/rate-limit/account-bucket.ts`

`accountBucketRateLimit(walletAddress, { limit, windowMs, burst })` is a
token-bucket limiter keyed by the caller's Stellar wallet address. It is used
inside the `/api/tx/*` routes to throttle signed-submission and
simulation/build calls.

Algorithm:

1. Normalise the wallet address (trim + lowercase) so the same wallet cannot
   spawn parallel buckets by case variation.
2. Look up the bucket `{ tokens, lastRefill }`, or seed it with `tokens = burst`.
3. Compute `elapsedMs` since `lastRefill`, add `elapsedMs * refillRate`
   (where `refillRate = limit / windowMs`) and clamp to `burst`.
4. If `tokens >= 1`, debit one token and return `success: true`. Otherwise
   return `success: false` along with the wait time needed to accrue one
   token.

`AccountBucketResult` extends `RateLimitResult` with a `retryAfter` field
(seconds) that handlers can echo back via the standard `Retry-After` header.

### Why a token bucket, not a fixed window?

The transaction submission surface is bursty in practice — a user may submit
two operations back-to-back while composing a multi-step transaction, then go
silent for several minutes. A fixed window would let the user send the whole
`limit` at the end of a window and the whole `limit` again at the start of the
next, doubling the effective rate. The token bucket smooths that by allowing a
short `burst` and then dripping tokens at `limit / windowMs`.

## Where each limiter is applied

### `middleware.ts` — global per-IP

The Next.js middleware (`matcher: '/api/:path*'`) runs the global limiter on
every API request **except**:

- `/api/health` (always allowed)
- Authenticated requests carrying the session cookie (`session`, or the value
  of `NEXT_PUBLIC_SESSION_COOKIE` if rate limiting is enabled in config)

For the remaining anonymous requests, the identifier is
`api-ratelimit:<x-forwarded-for>` (falling back to `127.0.0.1`). On
`success: false` the middleware short-circuits with:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: <seconds>

{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

On every response (success or failure) the middleware also sets:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (epoch seconds)

These headers are consistent with the de-facto standard used by GitHub,
Stripe, and most public APIs, so client SDKs that already understand them
work without modification.

### `app/api/tx/submit/route.ts` and `app/api/tx/build/route.ts` — per-account

After resolving the session, these handlers call
`accountBucketRateLimit(walletAddress, config.rateLimit.account)`. If the
bucket is empty, the request is rejected with `429` and the bucket's
`retryAfter` is echoed back. Successful requests are unaffected by the
global per-IP limiter because the session-cookie exemption in the middleware
skips it for authenticated callers.

## Configuration

All knobs live in `lib/config.ts` and are sourced from environment variables:

| Variable | Default | Used by |
|---|---|---|
| `RATE_LIMIT_MAX` | `100` | global per-IP `limit` (requests per `window`) |
| `RATE_LIMIT_WINDOW` | `60000` | global per-IP window in milliseconds |
| `TX_ACCOUNT_RATE_LIMIT_MAX` | `30` | per-account sustained rate (tokens per `windowMs`) |
| `TX_ACCOUNT_RATE_LIMIT_WINDOW_MS` | `60000` | per-account refill window in milliseconds |
| `TX_ACCOUNT_RATE_LIMIT_BURST` | `60` | per-account burst capacity |

The per-account burst should normally be at least 2× the per-account
sustained rate so that a user can compose a two-step transaction (build +
submit) without being throttled.

## Tuning per route

The global limiter is path-agnostic; the per-account limiter is currently
applied only on `/api/tx/submit` and `/api/tx/build`. If you need to add a
third surface:

1. Add a new config block under `rateLimit` (e.g. `rateLimit.markets: { … }`).
2. In the route handler, after resolving the session (or IP for anonymous
   surfaces), call the appropriate limiter.
3. On `success: false`, return `429` with `Retry-After: result.retryAfter`
   and a stable error code (see `docs/api-error-envelope.md`).
4. Add a regression test next to the handler asserting the new route is
   covered.

## Operational notes

- The in-memory `Map`s do not survive a process restart and are not shared
  across instances. For multi-instance deployments, swap the backing store
  for Redis or a similar shared cache.
- The hourly cleanup is best-effort; under sustained churn the maps may
  briefly hold expired entries. They are evicted on the next access to a
  different key.
- The `walletAddress` is the only account identifier used here. If the
  product grows to support multiple identities per wallet, key the bucket on
  `(walletAddress, subAccountId)` and update `normalizeWalletAddress` to
  handle the composite.

## Related

- `docs/api-error-envelope.md` — standard 4xx/5xx envelope and the
  `ValidationError`/`AuthError`/`UpstreamError` classes used in handlers.
- `docs/observability.md` — how rate-limit denials are surfaced to metrics
  and audit events.
