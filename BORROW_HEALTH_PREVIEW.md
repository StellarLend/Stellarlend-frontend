# Borrow Health Preview

The borrowing form now shows a projected health preview before submission. The preview is intentionally advisory: it warns when a position is close to liquidation, but it keeps the existing 150% minimum-collateral validation as the hard form rule.

## Formula

The form estimates position health from USD values:

```text
loanValueUsd = loanAmount * borrowAssetPrice
collateralValueUsd = collateralAmount * collateralAssetPrice
healthFactor = collateralValueUsd / (loanValueUsd * 1.2)
liquidationPrice = (loanValueUsd * 1.2) / collateralAmount
```

The `1.2` multiplier matches the displayed 120% liquidation threshold. Health bands match `PositionSummary`:

- `healthy`: health factor >= 2.0
- `at-risk`: health factor >= 1.0 and < 2.0
- `critical`: health factor < 1.0

## Price Source

`BorrowingForm` fetches `/api/prices?assets=<borrow>,<collateral>` after asset changes with a short debounce. If the request fails, the preview uses local fallback prices so the user still sees an estimate instead of a blank section.

## Example

Borrowing `100 USDC` with `300 USDC` collateral:

```text
loanValueUsd = 100 * 1 = 100
collateralValueUsd = 300 * 1 = 300
healthFactor = 300 / (100 * 1.2) = 2.50
liquidationPrice = (100 * 1.2) / 300 = 0.40 USDC
```

That position is shown as `healthy`.
