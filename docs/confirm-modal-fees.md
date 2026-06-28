# ConfirmModal Protocol Fee Breakdown

`ConfirmModal` shows a protocol fee estimate before users submit a lending
action. The estimate is informational and is recomputed from the current action,
asset, and amount every time the modal renders.

## Source Of Truth

- Fee math comes from `lib/fee-calculator.ts`.
- Asset decimal precision comes from `lib/assets/registry.ts`.
- Amount formatting uses `lib/utils/format.ts`.

The UI displays:

- Gross Amount: the submitted action amount.
- Estimated Protocol Fee: the fee returned by `calculateProtocolFee`.
- Net Amount: gross amount minus the estimated protocol fee.

## Unsupported Estimates

The fee calculator currently supports `lend`, `borrow`, and `repay` actions for
markets with a configured fee schedule. If an action or asset does not have a
fee schedule, the modal keeps the user flow available and marks the fee as
`N/A` instead of blocking confirmation.

## Rounding

Each displayed value is rounded to the selected asset's registry decimals. For
example, XLM displays seven decimal places and USDC displays six decimal places.
