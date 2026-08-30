# ConfirmModal fee breakdown

How the pre-submit confirmation dialog surfaces protocol fees.

Source: [`components/features/lending/components/ConfirmModal.tsx`](../components/features/lending/components/ConfirmModal.tsx)

Fee math: [`lib/fee-calculator.ts`](../lib/fee-calculator.ts)

Tests: [`ConfirmModal.test.tsx`](../components/features/lending/components/ConfirmModal.test.tsx)

## What the user sees

For `lend`, `borrow`, and `repay` actions the dialog shows a **Fee breakdown**
block (after the amount/duration rows):

| Row            | Value                                      |
| -------------- | ------------------------------------------ |
| Gross Amount   | `data.amount`                              |
| Protocol Fee   | `calculateProtocolFee(...).feeAmount` (+ bps) |
| Net Amount     | `max(0, gross - fee)`                      |

`withdraw` has no entry in the fee schedule, so the block is omitted.

## How the fee is computed

```ts
const { feeAmount, feeBps } = calculateProtocolFee(marketId, action, amount);
```

- `marketId` is the asset symbol (looked up case-insensitively in the registry).
- `action` is `lend` | `borrow` | `repay`.
- Fee = `max(amount * bps / 10000, minFeeAmount)`, except **zero amount → zero fee**.
- Negative amounts throw; the modal catches and hides the breakdown rather than
  blocking confirm.

## Rounding / display

Amounts go through the modal's local `formatCurrency` helper (2–4 fractional
digits + asset symbol). The calculator returns a raw JS number; display rounding
is presentation-only and does not change the fee math.

## Recompute on change

The breakdown is derived during render from `data.amount`, `data.asset`, and
`type`. Changing any of those props (e.g. the user edits the form behind the
modal) recomputes gross/fee/net on the next render — there is no cached fee
state inside the modal.

## Unknown market fallback

If `calculateProtocolFee` throws (unknown market id), the breakdown is omitted
and the rest of the confirm flow still works. Operators should register the
market in `lib/registry.ts` before enabling the action in production.
