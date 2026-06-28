# API Cursor Format

`lib/api/cursor.ts` owns the opaque cursor tokens used by transaction list
routes and CSV-style page walkers. The token is intentionally safe to pass
through URLs, but callers should treat it as an opaque value and send it back
unchanged instead of decoding it client-side.

## Payload

The current cursor payload is a versioned JSON object encoded with base64url:

```ts
{
  v: 1,
  date: string,
  id: string,
  direction: 'next' | 'prev'
}
```

`date` and `id` form the keyset boundary for a transaction row. `direction`
selects the comparison direction for forward or reverse paging. `v` lets the
server reject unknown cursor layouts before using the boundary.

## Guarantees

- Tokens are URL-safe base64url strings and do not contain raw JSON.
- Decoding validates every field before returning a cursor object.
- Empty, malformed, truncated, and tampered tokens fail with stable cursor
  validation errors.
- `id` must be present and no longer than 256 characters.
- `date` must parse as a valid JavaScript date.
- `limit` defaults to `DEFAULT_CURSOR_LIMIT`, must be a positive integer, and is
  capped at `MAX_CURSOR_LIMIT`.

## Operational Notes

When adding a cursor-backed route, keep the cursor as a server-owned contract:
return `nextCursor` or `prevCursor` from the API, then accept the same token on
the next request. Do not expose cursor internals in UI copy, local storage
schemas, or third-party integrations. If the keyset changes, introduce a new
version and keep the old decoder only as long as live clients can still hold old
tokens.

Related coverage lives in `lib/api/cursor.test.ts`.
