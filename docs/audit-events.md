# Audit events

The event catalogue, shaping rules, and redaction contract for the audit trail.

Canonical module: [`lib/audit/index.ts`](../lib/audit/index.ts).
Legacy-facing wrappers: [`lib/audit/events.ts`](../lib/audit/events.ts) (account
events) and [`lib/audit/logger.ts`](../lib/audit/logger.ts) (transaction and
admin events). Both re-export the canonical API unchanged; import from
`@/lib/audit` directly in new code.

Tests: [`lib/audit/events.test.ts`](../lib/audit/events.test.ts) and
[`lib/audit/logger.test.ts`](../lib/audit/logger.test.ts).

## Three kinds of event

| Kind            | Emitted by                | Stored where                     | Queryable in-process |
| --------------- | ------------------------- | -------------------------------- | -------------------- |
| **account**     | `emitAuditEvent` (events) | In-memory ring buffer            | Yes                  |
| **transaction** | `appendAuditEvent`        | In-memory ring buffer            | Yes                  |
| **admin**       | `emitAuditEvent` (logger) | stdout, one JSON line per event  | **No**               |

Admin audit is deliberately write-only: it goes to stdout for the log pipeline
to collect and is never held in the ring buffer, so it cannot be read back
through `getAuditEvents()`.

## Account event catalogue

`AccountAuditEventType` is a closed union:

- `account.deleted`, `account.anonymized`
- `sessions.revoked`
- `data.cleanup.enqueued`, `data.cleanup.completed`, `data.cleanup.failed`
- `auth.challenge.issued`, `auth.challenge.verified`, `auth.challenge.rate_limited`

Each stored event carries exactly six fields:

```ts
{
  kind: 'account',
  id: string,           // `audit-<epoch-ms>-<counter>`, unique and ordered
  type: AccountAuditEventType,
  userId: string,       // the actor
  timestamp: string,    // ISO-8601
  metadata: Record<string, unknown>,  // defaults to {}
}
```

`metadata` defaults to `{}` rather than `undefined`, so consumers can index into
it without a null check.

A missing actor does **not** drop the event — `emitAuditEvent(type, '')` still
records. A pre-authentication failure has to be auditable, which is exactly when
`auth.challenge.rate_limited` fires.

### Filtering

`getAuditEvents({ userId, type, since })` — filters combine with AND, and any
subset may be omitted. `since` is **inclusive** (`>=`), so an event exactly on
the boundary is retained.

## Transaction events

```ts
{
  kind: 'transaction',
  actorWallet?: string | null,
  action: string,
  resource: string,
  status: 'success' | 'failure',
  requestId?: string | null,
  ipHash?: string | null,
  createdAt: string,   // ISO-8601, stamped on append
}
```

`kind` and `createdAt` are stamped by `appendAuditEvent`; everything else is
caller-supplied and preserved verbatim. `actorWallet` and `requestId` are
nullable for the same reason as above: unauthenticated failures must still be
recorded. Both success and failure outcomes are logged — an audit trail with
only successes is not an audit trail.

## Redaction

`redactAuditPayload` removes exactly these top-level keys:

```
password   token   secret   transaction   signedEnvelopeXdr
```

It returns a new object and does not mutate the caller's payload — the caller
usually still needs the original for the operation being audited. Falsy
non-sensitive values (`0`, `false`, `''`) are preserved rather than dropped.

### Three limitations worth knowing

These are asserted by the tests so they can't drift silently:

1. **Matching is exact and case-sensitive.** `Token` and `accessToken` are
   **not** stripped — only the literal key `token` is. Use the exact blocked
   names.
2. **Redaction is shallow.** `{ outer: { password: 'x' } }` keeps the nested
   password. Flatten sensitive values to the top level before redacting.
3. **Wallet addresses are not redacted**, by design. The wallet is the actor
   identity for the trail; it's a public key, not a credential.

## IP hashing

`hashIp(ip)` returns the lowercase sha256 hex digest (64 chars) of the address,
and `null` for `undefined`, `null`, or `''`.

Returning `null` for empty input is deliberate: hashing `''` would produce a
real-looking digest that silently collides across every request without an IP.
`null` says "no IP", a digest says "this IP".

Store the digest, never the raw address. It is deterministic, so you can still
correlate requests from the same client without retaining the address itself.

## Payload size caps

Both account `metadata` and admin `context` run through the same sanitiser:

- Under **4 KB** serialised — stored as-is.
- Over 4 KB — replaced with `{ __truncated: true, __reason: 'audit payload
  exceeded maximum size', __originalSizeBytes, preview }`, where `preview` is
  the first **1 KB** of the serialised payload. Enough to triage, bounded enough
  not to blow up the log.
- Not serialisable at all (e.g. a circular reference) — replaced with
  `{ __truncated: true, __reason: 'audit payload could not be serialized' }`.

Neither path throws. **Auditing must never break the operation it is
recording**, so a bad payload degrades to a marker rather than an exception.

## Eviction

The ring buffer holds `DEFAULT_MAX_AUDIT_EVENTS` (10,000) entries across both
account and transaction kinds, evicting oldest-first. This is process-local and
does not survive a restart — it backs in-process queries and tests, not
long-term retention. Durable retention is the log pipeline's job, fed by the
`logger.info` call on every account event and the stdout line on every admin
event.

## Running the tests

```bash
npx vitest run --project server-unit lib/audit
```
