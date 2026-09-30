# API error envelope

How an error thrown inside an API route becomes an HTTP response.

Source: [`lib/api/errors.ts`](../lib/api/errors.ts) (the error classes) and
[`lib/api/handler.ts`](../lib/api/handler.ts) (the `withRequestLogging` wrapper
that catches them). Tests: [`lib/api/errors.test.ts`](../lib/api/errors.test.ts).

## Error classes

`lib/api/errors.ts` exports three domain errors. Each carries a `statusCode` so
route code can throw a business-level error and let the caller decide the HTTP
mapping — routing logic stays decoupled from business logic.

| Class             | `statusCode` | `name`            | Use when                                        |
| ----------------- | ------------ | ----------------- | ----------------------------------------------- |
| `ValidationError` | `400`        | `ValidationError` | The request body/query failed validation.       |
| `AuthError`       | `401`        | `AuthError`       | No session, or the session is expired/invalid.   |
| `UpstreamError`   | `502`        | `UpstreamError`   | Horizon, Soroban RPC, or another dependency failed. |

All three extend `Error`, so a single `catch (e)` still works, but they are not
interchangeable: a `catch` narrowed to `ValidationError` will not swallow an
`AuthError`.

## Status mapping

A handler resolves the status from the error's own `statusCode`, falling back to
`500` when there isn't a numeric one:

```ts
const candidate = (error as { statusCode?: unknown })?.statusCode;
const status = typeof candidate === 'number' ? candidate : 500;
```

The `typeof … === 'number'` check is deliberate. A third-party library may attach
a *string* `statusCode` (`'400'`); that is not a status this codebase set, so it
is ignored and the error is treated as unexpected.

Only the thrown error is inspected. If an error carries a `cause`, the outer
error's status wins — wrapping an `UpstreamError` in a `ValidationError` yields
`400`, not `502`.

## The generic 500 fallback

Anything that isn't one of the domain errors — a plain `Error`, a thrown string,
`null`, a subclass that forgot to declare a status — falls back to a fixed
envelope. `withRequestLogging` returns:

```jsonc
{ "error": "Internal server error" }
```

with status `500` and the request-id header set. The caught message is **never**
copied into the body: internal errors routinely contain connection strings,
hostnames, and credentials. The full error (name, message, stack) goes to the
logger and to Sentry instead, correlated by request id.

## Request id

Every response — success or error — carries the request id in the
`REQUEST_ID_HEADER` (see [`lib/request-id.ts`](../lib/request-id.ts)). That
header is the join key between the generic 500 a client sees and the detailed
record in the logs. When surfacing an error to a user, show the request id so it
can be traced.

## Building the body

`Error` is not JSON-serialisable in the way you might expect. `message` and
`stack` are inherited as non-enumerable, so they disappear under
`JSON.stringify` — but `name` and `statusCode` are own enumerable properties and
survive:

```ts
JSON.stringify(new ValidationError('"amount" is required'));
// {"name":"ValidationError","statusCode":400}   <- no message
```

Serialising the error directly therefore produces a body that echoes the status
back with no explanation at all. Read `.message` explicitly:

```ts
// correct
return NextResponse.json({ error: error.message }, { status: error.statusCode });

// wrong -- emits {"error":{"name":"ValidationError","statusCode":400}}
return NextResponse.json({ error }, { status: error.statusCode });
```

## Field-level detail

The error classes take a single `message` string; there is no separate `fields`
slot. Encode multi-field failures in the message:

```ts
throw new ValidationError('invalid request: "amount" is required, "asset" is required');
```

The message is preserved verbatim — including an empty string — so whatever a
route composes is exactly what reaches the client on a 4xx.

## Observability

`name` is part of the observable contract, not an implementation detail:
`withRequestLogging` labels its error counter with it
(`metrics.httpErrors.inc({ route, error: error.name })`). Renaming a class
silently breaks existing dashboards and alerts.
