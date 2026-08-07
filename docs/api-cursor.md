# Opaque API Cursors (`lib/api/cursor.ts`)

Module: [`lib/api/cursor.ts`](../lib/api/cursor.ts)  
Tests: [`lib/api/cursor.test.ts`](../lib/api/cursor.test.ts), [`test/server/cursor.test.ts`](../test/server/cursor.test.ts)

GrantFox **#674** — encode/decode contract for opaque pagination cursors used by
transaction list / infinite-scroll and related read routes.

## Why opaque cursors

Clients never invent page offsets. The server encodes a **keyset** (date + id +
direction) as base64url JSON so:

1. Paging stays stable under inserts between pages.
2. Clients cannot easily forge “page 999” or scan internal sequences.
3. The wire format is a single `cursor` query string, not multiple filters.

## Payload shape (`TransactionCursor`)

| Field | Type | Rules |
|---|---|---|
| `v` | `1` | Only version `1` is accepted |
| `date` | string | Non-empty; must parse as a real `Date` |
| `id` | string | Length 1–256 |
| `direction` | `'next' \| 'prev'` | Only these two values |

### Encode

`encodeTransactionCursor(cursor)` validates, then:

```
base64url( JSON.stringify(cursor) )
```

### Decode

`decodeTransactionCursor(raw)`:

1. Rejects empty string.
2. base64url-decodes and `JSON.parse`s; on failure throws a generic
   “base64url-encoded JSON” error (no stack / raw buffer leak).
3. Re-validates version, date, id, direction.

Malformed, truncated, wrong-version, or tampered payloads **throw** `Error`.
Callers (route handlers) should catch and map to `400` with a safe public
message — do not echo the internal exception text to clients if it ever grows
beyond the stable messages above.

## Query helpers

| Helper | Behaviour |
|---|---|
| `parseCursorLimit(value)` | `null` → `DEFAULT_CURSOR_LIMIT` (6); caps at `MAX_CURSOR_LIMIT` (100); rejects non-integers &lt; 1 |
| `parseCursorParams(searchParams)` | Reads `cursor` + `limit` from `URLSearchParams`; missing cursor → `null` |

## Guarantees

- **Round-trip**: `decode(encode(c)) === c` for every valid `TransactionCursor`.
- **Safe-closed decode**: garbage / truncate / version bump never returns a partial object.
- **No production secrets** in the cursor — only paging keyset fields.

## Example

```ts
import {
  encodeTransactionCursor,
  decodeTransactionCursor,
  parseCursorParams,
} from '@/lib/api/cursor';

const token = encodeTransactionCursor({
  v: 1,
  date: '2026-08-01T12:00:00.000Z',
  id: 'txn_abc',
  direction: 'next',
});

const again = decodeTransactionCursor(token);
// { v: 1, date: '…', id: 'txn_abc', direction: 'next' }

const { cursor, limit } = parseCursorParams(
  new URLSearchParams({ cursor: token, limit: '20' }),
);
```
