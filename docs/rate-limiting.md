# Rate Limiting Strategy

Stellarlend uses two in-memory limiters:

- `rateLimit` in `lib/rate-limit.ts` protects anonymous API traffic with a fixed-window counter.
- `accountBucketRateLimit` in `lib/rate-limit/account-bucket.ts` protects authenticated account actions with a token bucket.

Both limiters return the same core shape from `RateLimitResult`: `success`, `limit`, `remaining`, and `reset`. The account bucket extends that shape with `retryAfter` through `AccountBucketResult`.

## Global API Limiter

`middleware.ts` applies the global limiter to `app/api/*` through the Next.js middleware matcher. It identifies anonymous requests by `x-forwarded-for` and stores them as `api-ratelimit:<ip>`.

Authenticated internal calls are skipped when the configured session cookie is present. Skipped calls still receive the request ID, content security policy, and referrer policy headers.

Global settings come from:

| Config path               | Environment variable | Default    |
| ------------------------- | -------------------- | ---------- |
| `config.rateLimit.max`    | `RATE_LIMIT_MAX`     | `100`      |
| `config.rateLimit.window` | `RATE_LIMIT_WINDOW`  | `60000` ms |

When the global limiter blocks a request, middleware returns:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

The response status is `429`.

## Account Bucket Limiter

`accountBucketRateLimit` normalizes the wallet or user identifier to lowercase and refills tokens over time. Its `AccountBucketOptions` input provides `limit`, `windowMs`, and `burst`. The bucket starts with `burst` capacity, refills at `limit / windowMs`, and returns `retryAfter` when there are not enough tokens for another request.

Account bucket settings come from:

| Config path                         | Environment variable              | Default    |
| ----------------------------------- | --------------------------------- | ---------- |
| `config.rateLimit.account.limit`    | `TX_ACCOUNT_RATE_LIMIT_MAX`       | `30`       |
| `config.rateLimit.account.windowMs` | `TX_ACCOUNT_RATE_LIMIT_WINDOW_MS` | `60000` ms |
| `config.rateLimit.account.burst`    | `TX_ACCOUNT_RATE_LIMIT_BURST`     | `60`       |

The account bucket is currently applied by:

- `app/api/tx/build/route.ts`, keyed by `session.user.walletAddress`.
- `app/api/tx/submit/route.ts`, keyed by `session.user.walletAddress`.
- `app/api/account/delete/challenge/route.ts`, keyed by the authenticated user ID.

When an account bucket blocks a request, routes return a structured error envelope:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Account rate limit exceeded. Please try again later.",
    "limit": 30,
    "remaining": 0,
    "reset": 1730000000,
    "retryAfter": 2
  }
}
```

`app/api/account/delete/challenge/route.ts` uses the same `RATE_LIMIT_EXCEEDED` code with a route-specific message.

## Headers

Blocked and allowed global middleware responses include:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

Blocked global responses and blocked account bucket responses also include:

- `Retry-After`

The global limiter stores `reset` internally in milliseconds and sends `X-RateLimit-Reset` as seconds. The account bucket computes `reset` in seconds and sends it directly.

## Tuning Guidance

Use the global limiter for broad anonymous API pressure, such as bots or unauthenticated scraping.

Use the account bucket for operations where a signed-in account or wallet can create load or irreversible side effects. Transaction build, transaction submit, and account deletion challenge issuance are account-scoped because they should not share a rate budget with unrelated users behind the same IP.

When tuning a route:

1. Keep `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW` broad enough for normal page loads and background polling.
2. Tune `TX_ACCOUNT_RATE_LIMIT_MAX` and `TX_ACCOUNT_RATE_LIMIT_WINDOW_MS` around expected authenticated bursts.
3. Set `TX_ACCOUNT_RATE_LIMIT_BURST` higher than `TX_ACCOUNT_RATE_LIMIT_MAX` only when short bursts are acceptable and sustained traffic still needs throttling.
4. Preserve `Retry-After` on blocked account routes so clients can stop retrying until the bucket refills.

## Test Coverage

`lib/rate-limit.test.ts` covers the fixed-window utility and `clearRateLimitCache`.

`lib/rate-limit/account-bucket.test.ts` covers burst capacity, refill behavior, `retryAfter`, and `clearAccountBucketCache`.

`__tests__/config/rate-limiting-doc.test.ts` keeps this document tied to the exported limiter symbols, route files, headers, and configuration keys.
