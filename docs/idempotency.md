# API Idempotency Contract

Mutating API routes use the `Idempotency-Key` header to guarantee at-most-once execution for retried financial operations.

## Header contract

- Send `Idempotency-Key: <unique-string>` on mutating requests.
- The key must be stable across retries of the same logical operation.
- The key is paired with the request payload hash before execution.

## Replay behavior

- On the first request, the route executes normally and stores the serialized response.
- On a duplicate request with the same key and identical payload, the original response is replayed from cache.
- On a duplicate request with the same key but a different payload, the route returns `409 Conflict` and does not re-execute the mutation.

## Lifetime and storage

- Stored idempotency entries live in the shared in-memory cache for 24 hours.
- The cached entry retains the original status, body, and response headers, including `Set-Cookie` values.
- Entries are evicted automatically after their TTL expires.

## Usage example

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: retry-001' \
  -d '{"asset":"XLM","type":"Deposit","status":"Completed","amount":100,"date":"2025-01-01","time":"09:00AM"}'
```
