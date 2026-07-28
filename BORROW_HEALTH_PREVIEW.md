# Borrow Health Preview

The borrowing form shows a projected health preview before submission. The preview explains how close a position is to liquidation, while the 150% initial collateral ratio remains a hard form rule.

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

`BorrowingForm` fetches `/api/prices?assets=<borrow>,<collateral>` after asset changes with a short debounce. If the request fails, the preview uses local fallback prices so the user still sees an estimate instead of a blank section. A successful response that omits either requested price is treated as incomplete and blocks submission.

## Cross-asset collateral

Borrow and collateral amounts are not compared token-for-token. The form first converts the requested loan to USD, then converts the 150% requirement into units of the selected collateral asset:

```text
requiredCollateral = (loanAmount * borrowAssetPrice * 1.5) / collateralAssetPrice
```

For example, borrowing `100 USDC` against XLM at `$0.12` requires `1,250 XLM`, not `150 XLM`. Changing either selector recalculates the suggested minimum while preserving a collateral amount the user entered manually. The same asset may be selected on both sides, but zero collateral, missing prices, insufficient balance, and collateral below 150% of the borrowed USD value all prevent submission.

## Example

Borrowing `100 USDC` with `300 USDC` collateral:

```text
loanValueUsd = 100 * 1 = 100
collateralValueUsd = 300 * 1 = 300
healthFactor = 300 / (100 * 1.2) = 2.50
liquidationPrice = (100 * 1.2) / 300 = 0.40 USDC
```

That position is shown as `healthy`.
