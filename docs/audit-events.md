# Audit Events and Redaction

Stellarlend currently has two audit utilities:

- `lib/audit/events.ts` stores account-deletion and cleanup events in a local
  in-memory audit list for account lifecycle workflows.
- `lib/audit/logger.ts` stores request-scoped audit rows for profile, auth, and
  transaction flows, and emits admin audit events as JSON lines.

## Event Catalogue

### Account Lifecycle Events

`lib/audit/events.ts` supports:

- `account.deleted`
- `account.anonymized`
- `sessions.revoked`
- `data.cleanup.enqueued`
- `data.cleanup.completed`
- `data.cleanup.failed`
- `auth.challenge.issued`
- `auth.challenge.verified`
- `auth.challenge.rate_limited`

Each event includes:

- `id`
- `type`
- `userId`
- `timestamp`
- `metadata`

The metadata object is caller-provided. Callers should avoid placing raw
credentials, tokens, signed envelopes, or wallet secrets there.

### Request Audit Rows

`lib/audit/logger.ts` appends rows with:

- `actorWallet`
- `action`
- `resource`
- `status`
- `requestId`
- `ipHash`
- `createdAt`

IP addresses should be passed through `hashIp()` before being stored. The
current route usage stores wallet addresses as actor identifiers, not as payload
metadata.

### Admin Audit Events

Admin audit events are emitted as one JSON object per line with:

- `type: "AUDIT"`
- `timestamp`
- `action`
- `actorId`
- `context`

## Redaction Rules

Use `redactAuditPayload()` before attaching arbitrary payload objects to audit
context. It removes known sensitive keys:

- `actorWallet`
- `password`
- `privateKey`
- `publicKey`
- `secret`
- `seed`
- `signedEnvelopeXdr`
- `token`
- `transaction`
- `walletAddress`

Unknown fields are preserved so reviewers can see operational context without
including credentials or signed transaction material.

## Review Notes

The dedicated tests cover event shape, timestamp behavior, request-id slots,
filtering, fake stdout sinks, append-only reads, missing actor fallback values,
oversized caller metadata, and redaction of token, wallet, and signed-envelope
payload fields.
