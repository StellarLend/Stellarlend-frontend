# Tx status tracking

This document describes the client-side polling lifecycle for transaction settlement used by `useTxStatus`.

## Flow

- After the app receives a `{ status: 'submitted', hash }` response from `POST /api/tx/submit`, the client calls `useTxStatus(hash)`.
- `useTxStatus` polls `GET /api/tx/status/[hash]` with exponential backoff starting at 1s, doubling up to 30s.
- Terminal API statuses: `SUCCESS` → completed; `FAILED` and `NOT_FOUND` → failed. Polling stops when a terminal status is reached.
- If the status endpoint returns `429`, polling stops and the hook surfaces a `rate_limited` state containing `Retry-After` when present.
- The hook cleans up on unmount and when the hash is cleared or changed.

## Optimistic Pending Row

To bridge the UX gap between transaction submission and settlement, the `RecentTransactions` component accepts an optional `pendingTx` prop (containing `hash`, `type`, `amount`, and `asset`).
- **Rendering**: If `pendingTx` is provided and the real transaction has not yet landed in the refetched list (`!displayTransactions.some(txn => txn.id === pendingTx.hash)`), a distinct pending row is rendered at the top.
- **Styling**: It is styled with a subtle `pulse` animation and a distinctive color scheme (amber/orange theme).
- **Status Driving**: Its status badge is driven directly by the `useTxStatus` hook, transitioning in place from `Processing` (while polling) to `Completed` or `Failed` when polling completes.
- **Reconciliation**: Once the transaction settlement succeeds or fails, a refetch of the transactions is automatically triggered to sync the list. Once the real transaction lands in the list, the pending row is hidden to prevent duplicates.

## Polling lifecycle (tested)

| Scenario | Expected behavior |
| --- | --- |
| Immediate `SUCCESS` | Single fetch; state moves `processing` → `completed`; no further polls |
| `PENDING` → `SUCCESS` | Poll at initial 1s delay; stop after success |
| `PENDING` → `FAILED` | Poll until failure; stop after terminal `FAILED` |
| `NOT_FOUND` | Single fetch; state moves to `failed`; no further polls |
| `429` | Single fetch; state moves to `rate_limited`; no further polls |
| Transient fetch error | Backoff retry with doubled delay; recover on next successful fetch |
| Unmount mid-poll | In-flight request aborted; timers cleared; no further fetches |
| Hash cleared / changed | Previous poll stopped; new poll starts for updated hash |

## Backoff schedule

| Poll attempt after non-terminal response | Delay before next fetch |
| --- | --- |
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| … | doubles until 30s cap |

## Test coverage

Lifecycle behavior is covered in `lib/tx/useTxStatus.test.ts` using Vitest fake timers:

- Poll cadence and exponential backoff between non-terminal responses
- Terminal-state stop conditions (`SUCCESS`, `FAILED`, `NOT_FOUND`, `429`)
- Transient network error retry with backoff
- Unmount cleanup and hash change abort

Run:

```bash
npx vitest run --config vitest.server.config.ts lib/tx/useTxStatus.test.ts
```

Coverage:

```bash
npx vitest run --config vitest.server.config.ts lib/tx/useTxStatus.test.ts --coverage
```
