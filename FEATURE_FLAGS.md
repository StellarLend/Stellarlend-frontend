# Feature Flags

Feature flags are evaluated by `lib/flags/evaluator.ts` from `config/feature-flags.json`.
The API surface for clients is `GET /api/feature-flags`.

## User Identity

The route reads the `x-user-id` request header and passes it to `evaluateAllFlags`.
When the header is missing, the route evaluates flags for `anonymous`.

## Route Cache

`GET /api/feature-flags` keeps a per-user in-memory cache for five minutes.
The cache key is the resolved user ID, so two different `x-user-id` values do not share flag results.

Within the five-minute TTL:

- the first request for a user calls `evaluateAllFlags(userId)`;
- later requests for the same user return the cached flag map;
- requests for another user evaluate and cache independently.

After the TTL expires, the next request for that user evaluates flags again and refreshes the cached value.

## Testing Contract

The route test covers:

- same-user cache hits inside the TTL;
- cache refresh after the five-minute TTL;
- per-user cache isolation;
- the `anonymous` fallback when `x-user-id` is absent;
- back-to-back first requests for one user.
