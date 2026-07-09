# API Error Envelope

The `lib/api/errors.ts` module defines domain-specific error classes used across
API route handlers. Each class carries a `statusCode` property so handlers can
map business-level errors to HTTP status codes without coupling routing logic to
business logic.

## Error Classes

| Class | HTTP Status | Use Case |
|---|---|---|
| `ValidationError` | 400 Bad Request | Invalid or missing input (e.g., required field omitted, malformed payload) |
| `AuthError` | 401 Unauthorized | Authentication failure (missing or invalid token, expired session) |
| `UpstreamError` | 502 Bad Gateway | Downstream dependency failure (Soroban RPC timeout, Horizon 5xx) |

## Contract

Every error class:

- Extends the built-in `Error` (preserves `stack`, `message`)
- Exposes a **readonly** `statusCode: number`
- Sets its `name` property to the class name for type discrimination

### Example: Route handler error-to-response mapping

```typescript
import { ValidationError, AuthError, UpstreamError } from "@/lib/api/errors";

async function handleRequest() {
  try {
    // … route logic …
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof UpstreamError) {
      return Response.json({ error: "Service temporarily unavailable" }, { status: 502 });
    }
    // Unknown/unexpected errors → safe 500 without leaking internals
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

## Safe 500 Fallback

Unknown or unexpected errors (`TypeError`, `ReferenceError`, or any error not
inheriting from the three domain classes) MUST be mapped to a generic 500
response with a fixed message. The original error details MUST NOT be exposed
to the client.
