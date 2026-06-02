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
