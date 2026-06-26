# Withdraw Flow

## Overview

Suppliers can redeem previously supplied liquidity through the **Withdraw** tab on the lending page (`/lending`). The flow is:

1. Select a supply position
2. Enter a withdrawal amount (up to the withdrawable balance)
3. Review the health factor impact live
4. Confirm via the shared `ConfirmModal`
5. A signed transaction is submitted to `/api/tx/submit` and tracked via `/api/tx/status/{hash}`

## Withdrawable Balance Computation

Only the **free (non-collateralised)** portion of supplied funds is available for withdrawal.

```
withdrawableBalance = suppliedAmount − lockedCollateral
```

| Field             | Description                                              |
|-------------------|----------------------------------------------------------|
| `suppliedAmount`  | Total funds currently supplied in this position          |
| `lockedCollateral`| Funds reserved as collateral backing open borrow positions |
| `withdrawableBalance` | Funds available for immediate redemption           |

### Worked Example

| Field                     | Value       |
|---------------------------|-------------|
| Asset                     | XLM         |
| Total supplied            | 5,000 XLM   |
| Locked as collateral      | 2,250 XLM   |
| **Available to withdraw** | **2,750 XLM** |

Attempting to withdraw 3,000 XLM is blocked with:

> "Amount exceeds withdrawable balance of 2,750.00 XLM"

## Health Factor Guard

When a position carries outstanding debt, withdrawing reduces the collateral buffer and can lower the health factor. The post-withdrawal estimate uses a proportional model:

```
healthFactorAfter = currentHealthFactor × (suppliedAmount − withdrawal) / suppliedAmount
```

### Thresholds (from `PositionSummary.tsx`)

| Health Factor Range | Status   | UI Behaviour                                     |
|---------------------|----------|--------------------------------------------------|
| ≥ 2.0               | Healthy  | Withdrawal allowed, no warning                   |
| 1.0 – < 2.0         | At Risk  | Amber inline warning shown; submission still allowed |
| < 1.0               | Critical | Red inline warning shown; form validation blocks submission |

> Positions with **no outstanding debt** are exempt from the health factor guard. The health factor row is hidden from the preview for those positions.

### Worked Example (health impact)

Starting position: `healthFactor = 1.85`, `suppliedAmount = 5,000 XLM`, `outstandingDebt = 1,500 XLM`.

| Withdrawal | `healthFactorAfter`                         | Status             |
|------------|---------------------------------------------|--------------------|
| 500 XLM    | 1.85 × 4,500 / 5,000 = **1.67**            | At Risk (warning)  |
| 1,000 XLM  | 1.85 × 4,000 / 5,000 = **1.48**            | At Risk (warning)  |
| 2,750 XLM  | 1.85 × 2,250 / 5,000 = **0.83** (blocked)  | Critical           |

## Data Flow

```
WithdrawForm
  └─ onSubmit(LendingData) ──────────────────────────────────────────────┐
                                                                          │
app/lending/page.tsx                                                      │
  ├─ handleWithdrawSubmit  ◄─────────────────────────────────────────────┘
  │     setWithdrawData(data)
  │     setShowConfirmModal(true)
  │
  ├─ ConfirmModal (type="withdraw")
  │     onConfirm → handleConfirm()
  │                   POST /api/tx/submit
  │                   → setTxHash(hash)
  │
  └─ useTxStatus(txHash) → polls /api/tx/status/{hash} → Toast
```

### `LendingData` fields used by withdraw

| Field              | Withdraw meaning                              |
|--------------------|-----------------------------------------------|
| `asset`            | Asset being withdrawn                         |
| `amount`           | Withdrawal amount                             |
| `interestRate`     | Always `0` (no interest on withdrawals)       |
| `positionId`       | Supply position ID                            |
| `outstandingDebt`  | Outstanding debt on this position             |
| `remainingDebt`    | Remaining supplied after withdrawal           |
| `collateralAmount` | Amount locked as collateral (informational)   |
| `healthFactorBefore` | Health factor before withdrawal             |
| `healthFactorAfter`  | Projected health factor after withdrawal    |

## Key Files

| File | Role |
|------|------|
| `components/features/lending/components/WithdrawForm.tsx` | Form component with validation and live preview |
| `components/features/lending/components/WithdrawForm.test.tsx` | RTL test suite |
| `components/features/lending/components/TabSelector.tsx` | Exposes the "Withdraw" tab |
| `components/features/lending/components/ConfirmModal.tsx` | Handles `type="withdraw"` confirmation |
| `app/lending/page.tsx` | Routes the withdraw tab and wires submission |
| `lib/lending/types.ts` | `LendingActionType` includes `"withdraw"` |
