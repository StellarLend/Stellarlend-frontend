# Account Deletion Challenge Rate Limit

The account deletion challenge endpoint is protected by a per-account bucket rate limit.

- Route: `GET /api/account/delete/challenge`
- Rate limiter: `lib/rate-limit/account-bucket.ts`
- Config: `config.rateLimit.account`

When the limit is exceeded, the route returns HTTP `429` with the following headers:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After`

The response body includes:

- `error.code`: `RATE_LIMIT_EXCEEDED`
- `error.message`
- `limit`
- `remaining`
- `reset`
- `retryAfter`

An audit event `auth.challenge.rate_limited` is emitted when an account hits the rate limit.
