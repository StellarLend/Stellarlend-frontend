# Feature Flags

The `/api/feature-flags` route evaluates all configured flags for one caller and caches the result briefly so polling UI does not repeatedly evaluate the same flag set.

## Request Contract

- Method: `GET /api/feature-flags`
- User key: `x-user-id` request header
- Anonymous fallback: missing `x-user-id` is evaluated as `anonymous`
- Response: JSON object mapping flag keys to booleans, for example `{ "newDashboard": true }`

## Caching Contract

- Cache key: the resolved user id, not the full request URL.
- TTL: 5 minutes.
- A second request for the same user inside the TTL returns cached flags without re-running the evaluator.
- Different users have independent cache entries.
- After the TTL expires, the next request re-runs `evaluateAllFlags` and refreshes the cache.

## Test Coverage

`app/api/feature-flags/route.test.ts` uses fake timers and a mocked evaluator to cover:

- first request evaluation and cache hit reuse;
- per-user cache isolation;
- anonymous fallback when `x-user-id` is missing;
- cache expiry after the 5-minute TTL.

Run the focused test with:

```bash
npm run test:server -- app/api/feature-flags/route.test.ts
```
