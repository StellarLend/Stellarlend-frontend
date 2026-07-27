# Chaos Injection Middleware (`x-chaos-inject`)

## Overview
The **Chaos Injection Middleware** enables deterministic fault‑injection for development and staging environments. It allows you to simulate latency, rate‑limiting, and server‑error responses on any API route via the `x-chaos-inject` request header.

## When is it active?
- Controlled by the `ENABLE_CHAOS_INJECTION` environment variable (must be set to `true`).
- Automatically disabled when `process.env.NODE_ENV === 'production'` regardless of the flag.
- Intended for **dev** and **staging** only – never runs in production.

## Header contract
Send a JSON payload in the `x-chaos-inject` header. Example:
```http
GET /api/positions HTTP/1.1
Host: localhost:3000
x-chaos-inject: {"latency":200,"rateLimit":1,"status":502}
```

| Property | Type | Description |
|----------|------|-------------|
| `latency` | number (ms) | Adds an artificial delay before the request is processed. |
| `rateLimit` | number (>=1) | Responds immediately with **429 Too Many Requests**. |
| `status` | number (500‑599) | Returns a JSON error with the given status code (e.g., 502). |

Only the fields you include are acted upon. If multiple fields are present, they are applied in the order: **latency → rate‑limit → status**.

## Metrics
Each injection emits a `api.chaos_injection` metric with tags:
- `scenario` – `latency`, `rate_limit`, or `error`.
- `route` – the request pathname.

## Security & Performance
- Disabled in production, preventing accidental exposure.
- The middleware does **no heavy computation** – only a `setTimeout` and short‑circuit responses.
- Logging is performed via the existing `logger` utility.

## Example usage (Vitest unit test)
```ts
process.env.ENABLE_CHAOS_INJECTION = 'true';
const req = new NextRequest('http://localhost/api/test', {
  headers: { 'x-chaos-inject': JSON.stringify({ latency: 100 }) },
});
await chaosInject(req); // waits ~100 ms
```

## Enabling the middleware
1. Set `ENABLE_CHAOS_INJECTION=true` in your `.env.development` or `.env.staging`.
2. Ensure `NODE_ENV` is not `production`.
3. No further code changes are required – the middleware is automatically wired into all API handlers.

---
*If you need to disable it for a specific request, simply omit the header.*
