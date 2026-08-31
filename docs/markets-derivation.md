# Market rate and utilization derivation

How the lending UI obtains and displays supply/borrow APRs and utilization.

Sources:

- Pure helpers: [`lib/lending/markets.ts`](../lib/lending/markets.ts)
- React hook: [`hooks/useMarketRates.ts`](../hooks/useMarketRates.ts)
- Server stub: [`lib/markets/repository.ts`](../lib/markets/repository.ts)
- Tests: [`lib/lending/markets.test.ts`](../lib/lending/markets.test.ts)

## Data flow

```
Soroban lending pool (future) ──► lib/markets/repository.fetchMarkets
                                           │
                                           ▼
                                   GET /api/markets
                                           │
                                           ▼
                              hooks/useMarketsData (30s cache)
                                           │
                                           ▼
                              hooks/useMarketRates(asset)
                                           │
                                           ▼
                              BorrowingForm / markets views
```

`lib/lending/markets.ts` re-exports `useMarketRates` for the lending feature
surface and owns the pure numeric helpers that pin display contracts.

## Utilization

```
utilization = clamp( totalBorrow / totalSupply , 0, 1 )
```

| Input condition                         | Result | Rationale                                      |
| --------------------------------------- | ------ | ---------------------------------------------- |
| `totalSupply > 0`, `0 < totalBorrow ≤ S`| `B/S`  | Normal pool.                                   |
| `totalSupply ≤ 0`                       | `0`    | Empty / inverted pool — nothing to utilise.    |
| `totalBorrow ≤ 0`                       | `0`    | Single-sided liquidity (supply only).          |
| `totalBorrow > totalSupply`             | `1`    | Over-utilised / accounting lag — clamp, no NaN.|
| Non-finite input                        | `0`    | Fail closed for display.                       |

Display precision: **4 decimal places** (`roundUtilization` / repository stub).

```ts
deriveRoundedUtilization(3, 1)   // 0.3333
deriveRoundedUtilization(1000, 1001) // 1
deriveRoundedUtilization(0, 50)  // 0
```

## APR selection

`useMarketRates(asset)` (and `selectBorrowApr`) look up a row by
case-insensitive asset symbol and return `borrowApr`.

| Condition                                      | Result |
| ---------------------------------------------- | ------ |
| Asset found, finite numeric `borrowApr`        | that value (including `0`) |
| Asset missing / empty / whitespace             | `null` + error string in the hook |
| `borrowApr` non-numeric or non-finite          | `null` |

Supply APR uses the same selection rules via `selectSupplyApr`.

Display precision for stub APRs: **2 decimal places** (`roundApr` /
`toFixed(2)` in the repository).

## Solvency invariant

For every baseline market the borrow APR is strictly above the supply APR.
That spread is what keeps the pool solvent; an inversion is treated as a bug
by the repository tests and by
`lib/lending/markets.test.ts`.

## Rounding direction

Rounding goes through JavaScript `Number.prototype.toFixed`, which uses
half-up for the common midpoints this codebase hits (`1.225` → `1.23`).
Re-rounding an already-rounded APR is idempotent — `roundApr(roundApr(x)) ===
roundApr(x)` for the values we display.

## What this issue does *not* change

- No change to `useMarketRates` runtime behaviour.
- No change to the Soroban stub in `lib/markets/repository.ts`.
- No new network calls. Tests exercise pure helpers only.
