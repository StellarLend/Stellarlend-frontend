# HealthFactorAlert

`HealthFactorAlert` warns borrowers when their dashboard health factor leaves the healthy range.

## Thresholds

- Healthy: `healthFactor >= 2.0`; no alert is shown.
- At risk: `1.0 <= healthFactor < 2.0`; a warning alert is shown.
- Critical: `healthFactor < 1.0`; a critical alert is shown because the position is below the liquidation threshold.

## Dismissal

Dismissal is stored in browser `localStorage` per risk band. Dismissing an at-risk alert does not hide a later critical alert if the position worsens.

## Actions

The banner links directly to repayment and collateral actions:

- Repay debt: `/lending?tab=repay`
- Add collateral: `/lending?tab=borrow`
