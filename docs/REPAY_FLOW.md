# Repay Flow

This guide documents the borrower repayment path added to the lending page.

## Primary Surfaces

The repayment flow is centered on these files:

- `app/lending/page.tsx`
- `components/features/lending/components/TabSelector.tsx`
- `components/features/lending/components/RepayForm.tsx`
- `components/features/lending/components/ConfirmModal.tsx`
- `components/features/dashboard/components/PositionSummary.tsx`

`TabSelector` exposes the `repay` tab alongside `lend` and `borrow`. `RepayForm` owns repayment-specific field state, validation, preview calculation, and `/api/quote` preview loading. `app/lending/page.tsx` stores the validated repayment draft and opens `ConfirmModal` for final review.

## User Flow

1. The user opens `/lending` and selects the Repay Loan tab.
2. The user selects an open borrow position.
3. The user enters a repayment amount.
4. The form validates that `0 < amount <= outstandingDebt`.
5. The form previews remaining debt and the post-repayment health factor.
6. The form requests `/api/quote` using the existing borrow quote path for repayment cost preview context.
7. The page opens `ConfirmModal` with the repayment amount, remaining debt, collateral, and updated health factor.
8. The user confirms before the transaction build/submit layer is invoked.

## Validation Rules

Repayment validation happens in `RepayForm` before any quote request:

- A borrow position must be selected.
- The repayment amount must be greater than zero.
- The repayment amount must not exceed the selected position's outstanding debt.
- Field-level errors and a summary alert are rendered with accessible labels and live regions.

## Health Factor Preview

The repayment preview reuses the same threshold model as `PositionSummary`:

| Health Factor        | Status   |
| -------------------- | -------- |
| `>= 2.0`             | Healthy  |
| `>= 1.0` and `< 2.0` | At Risk  |
| `< 1.0`              | Critical |

For partial repayments, `RepayForm` keeps collateral fixed and recalculates the post-repayment health factor by reducing the debt denominator. Full repayment is displayed as debt cleared.

## Worked Example

A borrower has an XLM loan with:

- Outstanding debt: `1,500 XLM`
- Collateral: `5,000 XLM`
- Current health factor: `1.50`

If the borrower repays `500 XLM`, the live preview shows:

- Remaining debt: `1,000 XLM`
- New health factor: `2.25`
- Status: `Healthy`

If the borrower repays the full `1,500 XLM`, the preview shows `0 XLM` remaining debt and `Debt cleared` for the health factor state.

## Tests

`components/features/lending/components/RepayForm.test.tsx` covers:

- Required repayment amount validation.
- No open positions.
- Overpayment validation.
- Partial repayment preview.
- Full repayment preview.
- Quote submission and callback payload.
- Loading and error states when quote preview fails.

Run the focused suite with:

```bash
npm test -- components/features/lending/components/RepayForm.test.tsx
```
