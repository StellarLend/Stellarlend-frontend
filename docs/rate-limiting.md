# Rate Limiting: IP Bucket vs. Account Bucket

Stellarlend runs two independent, in-memory rate limiters. They are not aware of
each other and do not share state:

| Limiter | File | Keyed by | Enforced in |
|---|---|---|---|
| IP bucket | `lib/rate-limit.ts` (`rateLimit`) | `x-forwarded-for` (falls back to `127.0.0.1`) | `middleware.ts`, for every `/api/*` request |
| Account bucket | `lib/rate-limit/account-bucket.ts` (`accountBucketRateLimit`) | authenticated user id (wallet address), token-bucket with burst | individual route handlers, e.g. `app/api/account/delete/challenge/route.ts` |

## How a single request is evaluated

`middleware.ts` decides whether to apply the IP bucket at all *before* the
route handler runs, based on whether a session cookie is present
(`request.cookies.has(sessionCookieName)`):

- **Session cookie present** → `middleware.ts` treats the request as
  authenticated and skips the IP bucket entirely (no `X-RateLimit-*` headers,
  no `rateLimit()` call). Only the account bucket (if the route calls one)
  constrains the request.
- **No session cookie** (e.g. a `Authorization: Bearer <token>` request from a
  non-browser client) → `middleware.ts` applies the IP bucket. If the route
  also calls `accountBucketRateLimit`, the request must pass **both**
  independent checks: the IP bucket in `middleware.ts` first, then the account
  bucket inside the route handler. Neither call informs or debits the other —
  passing one does not consume from the other's budget.
- **No credentials at all** → the IP bucket applies in `middleware.ts`; the
  route's `requireAuth` rejects with `401` before `accountBucketRateLimit` is
  ever invoked, so the account bucket is untouched.

Important consequence: because the two buckets use different identifiers,
they don't compose into one combined per-user limit — they each defend
against a different threat:

- The **IP bucket** limits how many requests *any* client behind one IP can
  make, including anonymous/unauthenticated traffic. Multiple accounts behind
  a shared IP (NAT, office network, mobile carrier) share this single budget,
  so heavy use by one account can throttle unrelated accounts on the same IP.
- The **account bucket** limits how many requests *one authenticated account*
  can make, regardless of source IP. Rotating IPs (or spoofing
  `x-forwarded-for`) does not help an attacker bypass this limiter, since it
  never resets on IP change and follows only the token's `sub` claim.

`middleware.ts`'s exemption check only verifies that a session cookie is
*present*, not that it is valid — an invalid/expired session cookie still
skips the IP bucket, and then fails `requireAuth` before the account bucket
runs. A request with a garbage session cookie is therefore not rate-limited
by either mechanism. Routes that accept bearer tokens without a session
cookie do not have this gap, since the IP bucket still applies in that case.

See [`lib/rate-limit-interaction.test.ts`](../test/server/rate-limit-interaction.test.ts)
for an integration test exercising both limiters together against
`/api/account/delete/challenge`.
