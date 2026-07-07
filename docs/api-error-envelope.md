# API Error Envelope

`lib/api/errors.ts` defines the small server-side contract used to classify
common API failures before route handlers serialize them.

## Domain Errors

| Error class       | HTTP status | Envelope code          | Use case                                                               |
| ----------------- | ----------: | ---------------------- | ---------------------------------------------------------------------- |
| `ValidationError` |         400 | `VALIDATION_ERROR`     | Request body, query, or field validation failed.                       |
| `AuthError`       |         401 | `AUTHENTICATION_ERROR` | The caller is missing a valid authenticated session or credential.     |
| `UpstreamError`   |         502 | `UPSTREAM_ERROR`       | A dependency such as Horizon, Soroban RPC, or a price provider failed. |
| Unknown error     |         500 | `INTERNAL_ERROR`       | Any unexpected failure that should not expose internals.               |

## Envelope Shape

```ts
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request body',
    requestId: '01HZ0000000000000000000000',
    details: {
      email: ['email is required']
    }
  }
}
```

`requestId` is always present in the helper output and is `null` when a caller
does not provide one. Validation details are only included for
`ValidationError` instances that carry field-level detail.

## Safety Rules

- Known domain errors keep their public message so callers can fix the request
  or retry the right dependency.
- Unknown errors are mapped to `INTERNAL_ERROR` with the generic message
  `Internal server error`.
- Nested causes, stack traces, connection strings, credentials, tokens, and raw
  exception messages from unknown errors must not be serialized into the client
  envelope.

## Review Notes

The current helper is pure and does not change existing route behavior by
itself. Route handlers can opt into it when they need a stable JSON error
contract with typed status mapping and request-id propagation.
