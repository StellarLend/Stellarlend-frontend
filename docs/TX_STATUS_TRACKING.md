# Tx status tracking

This document describes the client-side polling lifecycle for transaction settlement used by `useTxStatus`.

## Flow

- After the app receives a `{ status: 'submitted', hash }` response from `POST /api/tx/submit`, the client calls `useTxStatus(hash)`.
- `useTxStatus` polls `GET /api/tx/status/[hash]` with exponential backoff starting at 1s, doubling up to 30s.
- Terminal API statuses: `SUCCESS` → completed; `FAILED` and `NOT_FOUND` → failed. Polling stops when a terminal status is reached.
- If the status endpoint returns `429`, polling stops and the hook surfaces a `rate_limited` state containing `Retry-After` when present.
- The hook cleans up on unmount and when the hash is cleared or changed.

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

## Optimistic pending row in RecentTransactions ([#418](https://github.com/StellarLend/Stellarlend-frontend/issues/418))

> **Problem:** After submitting a transaction, users see a gap before it appears in RecentTransactions because the list only shows confirmed history. This creates confusion — users don't know if their action was submitted.

`RecentTransactions` accepts an optional `inFlightTx` prop to show a just-submitted transaction as a pending row before it lands on-chain.

### InFlightTx interface

```ts
interface InFlightTx {
  hash: string;        // Soroban transaction hash – drives useTxStatus polling
  type: TransactionType; // "Deposit" | "Withdrawal" | "Lend Funds" | "Loan Payment"
  amount: number;
  asset: AssetSymbol;  // "XLM" | "USDC" | "BTC" | "ETH"
}
```

### Lifecycle

1. Caller passes `inFlightTx={{ hash, type, amount, asset }}` to `<RecentTransactions />`.
2. `RecentTransactions` calls `useTxStatus(hash)` and derives a `Transaction` with `status: "Processing"`.
3. The pending row renders at the top of the table with distinct styling (dashed blue border, pulse animation, "Pending…" action text).
4. When `useTxStatus` reaches `completed`, the pending row is removed. The caller is responsible for triggering a refetch of the transactions list so the real row appears.
5. If the status becomes `failed`, the pending row transitions to `status: "Failed"`.

### Deduplication

If the fetched transactions list already contains a row matching the pending tx's `type`, `amount`, and `asset`, the pending row is suppressed to avoid duplicates.

### Test coverage

Optimistic row behavior is covered in `components/shared/common/RecentTransactions.test.tsx`:

- No pending tx renders normally
- Pending tx renders at top with "Processing" status
- Pending → confirmed removes the pending row
- Pending → failed transitions to "Failed"
- Dedup suppresses pending row when real tx lands

Run:

```bash
npx vitest run --project accessibility components/shared/common/RecentTransactions.test.tsx
```
