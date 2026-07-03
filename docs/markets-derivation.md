# Market Rate Derivation

This document describes the mathematical formulas used to derive lending market rates in the Stellarlend frontend.

## Overview

Market rates are derived from three core inputs:
- **Total Supply**: Total assets deposited into the lending pool
- **Total Borrow**: Total assets borrowed from the lending pool
- **Market Parameters**: Base rate, rate slope, and reserve factor

## Formulas

### Utilization Rate

```
utilization = totalBorrow / totalSupply
```

- Clamped to range `[0, 1]`
- Returns `0` when `totalSupply <= 0` (avoid division by zero)
- Represents the percentage of supplied assets currently borrowed

**Edge Cases:**
- Empty market (supply = 0): utilization = 0
- Supply only (borrow = 0): utilization = 0
- Fully utilized (borrow = supply): utilization = 1
- Over-utilized (borrow > supply): utilization = 1 (clamped)

### Borrow APR

```
borrowApr = baseRate + (utilization × rateSlope)
```

- Linear model: borrow rate increases as utilization increases
- At 0% utilization: borrow rate equals `baseRate`
- At 100% utilization: borrow rate equals `baseRate + rateSlope`

**Example:**
- Base rate: 2%, Rate slope: 10%
- At 50% utilization: 2% + (0.5 × 10%) = 7%
- At 100% utilization: 2% + (1 × 10%) = 12%

### Supply APR

```
supplyApr = borrowApr × utilization × (1 − reserveFactor)
```

- Suppliers earn a portion of the borrow interest
- Earnings scale with both borrow rate and utilization
- Protocol takes `reserveFactor` percentage as fee

**Example:**
- Borrow APR: 8.5%, Utilization: 65%, Reserve factor: 10%
- Supply APR: 8.5% × 0.65 × 0.9 = 4.9725%

## Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `baseRate` | Minimum borrow rate at 0% utilization | 2% |
| `rateSlope` | Additional borrow rate at 100% utilization | 10% |
| `reserveFactor` | Protocol fee on borrow interest | 0.1 (10%) |

## Implementation

See `lib/lending/markets.ts` for the implementation of these formulas.

Key functions:
- `calculateUtilization(totalSupply, totalBorrow)`
- `calculateBorrowRate(utilization, baseRate, rateSlope)`
- `calculateSupplyRate(borrowApr, utilization, reserveFactor)`
- `deriveMarketRates(params)` — combines all three

## Testing

See `lib/lending/markets.test.ts` for comprehensive unit tests covering:
- Normal operating ranges
- Boundary conditions (zero supply, zero borrow, fully utilized)
- Over-utilization clamping
- Negative input handling
- Numeric precision and rounding stability
