# Webhook Contract: Transaction Status Updates

This document describes the signed webhook endpoint used by upstream indexers/services to notify Stellarlend when a transaction's on-chain settlement status changes.

## Endpoint

```
POST /api/webhooks/transactions
```

## Authentication

Every request **must** include an HMAC-SHA256 signature in the `x-webhook-signature` header.

### Signature Format

```
x-webhook-signature: sha256=<hex-digest>
```

The digest is computed as:

```
HMAC-SHA256(WEBHOOK_SECRET, raw-request-body)
```

> **Important:** The signature is computed over the **raw** request body string — not a re-serialised version. Whitespace, key order, and encoding must be preserved exactly.

### Constant-Time Verification

The server verifies the digest with Node.js `crypto.timingSafeEqual`. Malformed,
missing, wrong-length, and wrong-value signatures are normalized through the same
fixed-length comparison path before the request is rejected with `401`. This
avoids exposing signature validity through simple timing differences. The
server never logs the shared secret or the full received signature on failure.

### Environment Variable

| Variable         | Required | Description                                                              |
| ---------------- | -------- | ------------------------------------------------------------------------ |
| `WEBHOOK_SECRET` | ✅ Yes   | Shared HMAC secret. **Server-only** — do NOT prefix with `NEXT_PUBLIC_`. |

For local development, add to `.env.local`:

```env
WEBHOOK_SECRET=your-secret-key-here
```

## Payload Contract

### Headers

| Header                | Required | Description                          |
| --------------------- | -------- | ------------------------------------ |
| `Content-Type`        | Yes      | Must be `application/json`           |
| `x-webhook-signature` | Yes      | `sha256=<hex-digest>` HMAC signature |

### Body

```json
{
  "event": "transaction.status_updated",
  "timestamp": 1717243200000,
  "nonce": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "transaction_id": "TXN12346",
    "status": "Completed"
  }
}
```

### Field Reference

| Field                 | Type                | Required | Description                                                                                       |
| --------------------- | ------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `event`               | `string`            | ✅       | Must be `"transaction.status_updated"`                                                            |
| `timestamp`           | `number`            | ✅       | Unix timestamp in **milliseconds** (e.g. `Date.now()`). Must be within ±5 minutes of server time. |
| `nonce`               | `string`            | ✅       | Unique event ID (UUID v4 recommended). Prevents replay attacks.                                   |
| `data.transaction_id` | `string`            | ✅       | Stellarlend transaction ID (e.g. `"TXN12345"`)                                                    |
| `data.status`         | `TransactionStatus` | ✅       | New status. One of: `"Completed"`, `"Processing"`, `"Failed"`                                     |

## Replay Protection

Two mechanisms prevent replay attacks:

1. **Timestamp validation** — Events with a timestamp more than **5 minutes** from the server clock (in either direction) are rejected with `403`.
2. **Nonce deduplication** — Each `nonce` is tracked for the duration of the timestamp tolerance window. Duplicate nonces are rejected with `409`.

## Response Codes

| Code  | Meaning               | When                                                                          |
| ----- | --------------------- | ----------------------------------------------------------------------------- |
| `200` | Success               | Event processed, transaction status updated                                   |
| `400` | Bad Request           | Invalid JSON, unsupported event type, missing fields, or unknown status value |
| `401` | Unauthorized          | Missing or invalid `x-webhook-signature`                                      |
| `403` | Forbidden             | Timestamp outside ±5 minute tolerance window                                  |
| `404` | Not Found             | `transaction_id` does not exist                                               |
| `409` | Conflict              | Duplicate `nonce` (event already processed)                                   |
| `500` | Internal Server Error | `WEBHOOK_SECRET` environment variable not configured                          |

### Success Response

```json
{
  "success": true,
  "transaction": {
    "id": "TXN12346",
    "type": "Loan Payment",
    "amount": -250,
    "asset": "BTC",
    "date": "2025-03-10",
    "time": "11:15AM",
    "status": "Completed"
  }
}
```

### Error Response

```json
{
  "error": "Description of what went wrong"
}
```

## Testing

### Generate a Test Signature (Node.js)

```js
const crypto = require("crypto");

const secret = "your-secret-key-here";
const body = JSON.stringify({
  event: "transaction.status_updated",
  timestamp: Date.now(),
  nonce: crypto.randomUUID(),
  data: {
    transaction_id: "TXN12346",
    status: "Completed",
  },
});

const signature =
  "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

console.log("Body:", body);
console.log("Signature:", signature);
```

### Generate a Test Signature (OpenSSL)

```bash
BODY='{"event":"transaction.status_updated","timestamp":1717243200000,"nonce":"test-1","data":{"transaction_id":"TXN12346","status":"Completed"}}'
SECRET="your-secret-key-here"

SIGNATURE="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)"
echo $SIGNATURE
```

### Example cURL

```bash
curl -X POST http://localhost:3000/api/webhooks/transactions \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $SIGNATURE" \
  -d "$BODY"
```

### Run Automated Tests

```bash
# Run webhook + verification tests
npx vitest run --project unit

# Run with coverage
npx vitest run --project unit --coverage
```

## Architecture Notes

- **No new dependencies** — uses Node.js built-in `crypto` module.
- **Signing secret is server-only** — never exposed to the browser (no `NEXT_PUBLIC_` prefix).
- **Timing-safe comparison** — uses `crypto.timingSafeEqual` to prevent timing side-channel attacks on signature verification.
- **In-memory nonce store** — nonces are stored in a `Set` with automatic pruning. For multi-instance deployments, consider using a shared store (e.g. Redis).

## File Map

| File                                     | Purpose                                                   |
| ---------------------------------------- | --------------------------------------------------------- |
| `app/api/webhooks/transactions/route.ts` | Webhook route handler                                     |
| `lib/webhooks/verify.ts`                 | Signature verification, timestamp validation, nonce store |
| `lib/webhooks/types.ts`                  | `WebhookPayload` interface and constants                  |
| `lib/transactions/store.ts`              | In-memory transaction data layer                          |
