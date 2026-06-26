**Prometheus Metrics**

Endpoints:
- `GET /api/metrics` — Prometheus exposition (text/plain; version=0.0.4). Protected by a bearer token (`SERVER_TOKEN` / `lib/server-config.ts`).

Metric catalog:
- `http_requests_total{method,route,status}` — counter for incoming HTTP requests.
- `http_request_duration_seconds{method,route,status}` — histogram of request latencies (seconds).
- `http_errors_total{route,error}` — counter for internal errors.
- `soroban_submissions_total{result}` — counter for Soroban tx submissions (`success`/`failure`).
- `soroban_submit_duration_seconds{result}` — histogram for Soroban submit duration.
- `outbound_http_requests_total{method,host,status}` — counter for outbound HTTP calls.
- `outbound_http_request_duration_seconds{method,host,status}` — histogram for outbound request durations.
- `horizon_selection_total{host}` — counter for Horizon endpoint selections used for failover.

Cardinality guidance:
- Keep `route` and `host` labels limited to known values (do not use unbounded user-provided values).
- Avoid adding high-cardinality labels such as user IDs.

Usage:
- Configure your Prometheus scrape config to use the bearer token: `Authorization: Bearer <token>`.
- Exempt `/api/metrics` from rate limiting in the API gateway or middleware.


## Request correlation

All `/api/*` requests participate in `x-request-id` correlation:

- Clients may send `x-request-id` as a ULID (26 Crockford Base32 characters, for example `01HZ0000000000000000000000`).
- `middleware.ts` preserves a valid incoming value, generates a fresh ULID when the header is missing or malformed, and returns the final value in the response `x-request-id` header.
- `withRequestLogging` stores the value in request-scoped logger context so structured logs include `context.requestId`.
- `lib/http/client.ts` forwards the active value to upstream services on outbound HTTP calls.

Example:

```bash
curl -H 'x-request-id: 01HZ0000000000000000000000' \
  http://localhost:3000/api/health
```
