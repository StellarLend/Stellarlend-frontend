# Tx status tracking

This document describes the client-side polling lifecycle for transaction settlement used by `useTxStatus`.

- After the app receives a `{ status: 'submitted', hash }` response from `POST /api/tx/submit`, the client calls `useTxStatus(hash)`.
- `useTxStatus` will poll `GET /api/tx/status/[hash]` with exponential backoff starting at 1s, doubling up to 30s.
- Terminal API statuses: `SUCCESS` -> considered completed; `FAILED` and `NOT_FOUND` -> considered failed. The hook stops polling when a terminal status is reached.
- If the status endpoint returns `429`, the hook stops and surfaces a `rate_limited` state containing `Retry-After` when present.
- The hook cleans up on unmount and when the hash is cleared.
