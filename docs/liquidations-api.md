# Liquidations API

## Endpoint

`GET /api/liquidations`

## Authentication

Requires a valid session cookie. Returns 401 if unauthenticated.

## Query parameters

| Param    | Required | Description |
|----------|----------|-------------|
| `wallet` | No       | Override wallet address for admin inspection (max 56 chars) |

## Response

```json
{
  "positions": [
    {
      "asset": "XLM",
      "borrowedAmount": 1500,
      "collateralAsset": "XLM",
      "collateralAmount": 5000,
      "collateralFactor": 0.75,
      "healthFactor": 2.5,
      "liquidationPriceFactor": 0.4,
      "riskScore": 0.25
    }
  ],
  "totalRiskScore": 0.83,
  "timestamp": "2026-06-02T12:00:00.000Z"
}
```

Positions are sorted by `riskScore` descending (most at risk first).

## Formulas

### Health factor

```
healthFactor = (collateralAmount × collateralFactor) / borrowedAmount
```

- If the result is < 1, the position is liquidatable
- If `borrowedAmount` is 0, `healthFactor` is `Infinity` (no borrow, no risk)

### Liquidation price factor

```
liquidationPriceFactor = borrowedAmount / (collateralAmount × collateralFactor)
```

This is the fraction of the current USD price at which the health factor drops to exactly 1. For example, a factor of 0.4 means a 60% price decline would trigger liquidation.

Returns `null` when `collateralAmount <= 0` or `collateralFactor <= 0`.

### Risk score

```
riskScore = clamp(1 - (healthFactor - 1) / (SAFE_HF - 1), 0, 1)
```

Where `SAFE_HF = 2.0`.

- healthFactor ≤ 1 → riskScore = 1 (liquidatable)
- healthFactor ≥ 2 → riskScore = 0 (safe)
- Linear interpolation between 1 and 2

The risk score is rounded to 6 decimal places and is monotonically decreasing with respect to health factor.

### Total risk score

```
totalRiskScore = max(riskScore of all positions)
```

A single aggregate metric consumable by the dashboard liquidation banner.

## Collateral registry

| Asset | Collateral factor | Liquidation threshold |
|-------|-------------------|-----------------------|
| XLM   | 0.75              | 0.80                  |
| USDC  | 0.85              | 0.90                  |
| BTC   | 0.80              | 0.85                  |
| ETH   | 0.80              | 0.85                  |

Source: `lib/markets/registry.ts`

## Properties (invariants)

1. **Monotonicity**: risk score is monotonically decreasing in health factor
2. **Bounded**: risk score is always in [0, 1]
3. **Clamped**: HF ≤ 1 → score = 1; HF ≥ 2 → score = 0
4. **Sorted**: returned positions are sorted by risk score descending
5. **Finite**: all numeric outputs are finite for valid inputs

These are verified by property-based tests in `lib/positions/liquidation.property.test.ts`.

## Error codes

| Status | Condition |
|--------|-----------|
| 401    | No valid session |
| 400    | Invalid wallet address param (too long) |
| 500    | Internal error (caught by `withRequestLogging`) |
