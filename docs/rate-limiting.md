# Rate limiting

StellarLend applies rate limits at two layers:

## Global IP bucket

`lib/rate-limit.ts` tracks requests per IP with a sliding window. Exceeded limits return HTTP 429 with `Retry-After`.

## Account wallet bucket

`lib/rate-limit/account-bucket.ts` applies token-bucket limits per normalized Stellar wallet address for authenticated routes. Options:

| Option | Meaning |
|--------|---------|
| `limit` | Sustained requests per window |
| `windowMs` | Window size in milliseconds |
| `burst` | Extra burst capacity |

Use `clearAccountBucketCache()` in tests to reset state.

Tune limits via environment variables documented in `lib/server-config.ts`.
