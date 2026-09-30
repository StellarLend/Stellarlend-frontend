# Markets repository contract

The data-access layer behind the markets API.

Source: [`lib/markets/repository.ts`](../lib/markets/repository.ts).
Types: [`lib/markets/types.ts`](../lib/markets/types.ts).
Tests: [`lib/markets/repository.test.ts`](../lib/markets/repository.test.ts).

## Current status: documented stub

`fetchMarkets` does not talk to the chain yet. It simulates ~200 ms of Soroban
RPC latency and returns representative per-asset values with small random
jitter, standing in for a `get_reserve_data(asset_address)` call against the
lending pool contract. The steps to wire up the real call are listed in the
doc comment on the function itself.

The tests pin the *contract* — envelope shape, per-asset lookup, ordering,
rounding, and value invariants — rather than the specific numbers, so swapping
the stub for a live call is a drop-in replacement rather than a silent change in
behaviour.

## API

```ts
fetchMarkets(assets: AssetSymbol[]): Promise<MarketsResponse>
```

There is a single read entry point. There is **no** `upsert`, no read-by-symbol,
and no local store: the pool is the source of truth and this module is
read-only. Writes happen on-chain, not here.

### Response envelope

```ts
{
  markets: AssetMarket[],
  timestamp: string,   // ISO-8601, e.g. 2026-07-30T09:21:44.512Z
  source: string,      // 'Soroban RPC stub (server relay)'
}
```

`source` is surfaced verbatim by consumers so stub data is distinguishable from
live data. Changing that string is a visible contract change, and is the marker
to flip when the real RPC call lands.

### Per-asset row

`AssetMarket` — exactly these six fields:

| Field         | Meaning                                     | Notes                          |
| ------------- | ------------------------------------------- | ------------------------------ |
| `asset`       | The `AssetSymbol` this row describes        | Echoes the requested symbol    |
| `supplyApr`   | Supply rate, percent                        | Rounded to 2dp                 |
| `borrowApr`   | Borrow rate, percent                        | Rounded to 2dp; always > supply |
| `utilization` | Borrowed share of supply, **0..1 ratio**    | Rounded to 4dp; clamped to 0..1 |
| `totalSupply` | Total supplied, base units                  | Not jittered                   |
| `totalBorrow` | Total borrowed, base units                  | Not jittered; ≤ `totalSupply`  |

`utilization` is a ratio, not a percentage. Multiply by 100 at the presentation
layer.

## Invariants

These hold for every returned row and are asserted by the tests:

- `borrowApr > supplyApr` — the spread is what keeps the pool solvent; an
  inversion is a real bug, not jitter.
- `0 <= utilization <= 1`, clamped even at the extremes of the random range.
- `0 <= totalBorrow <= totalSupply`, and `totalSupply > 0`.
- APRs are rounded to 2dp and `utilization` to 4dp. The route serialises these
  straight to JSON, so unrounded floats would leak long decimal tails into the
  API response.

## Ordering

The result maps 1:1 over the input array:

- Rows come back in **requested order**, not a canonical or sorted order.
- Duplicate symbols are **not** de-duplicated — asking for `['XLM', 'XLM']`
  returns two rows.
- An empty request returns an empty `markets` array with a well-formed envelope,
  so callers need no special case.

Ordering is stable across calls; only the rate fields fluctuate.

## Jitter

Only `supplyApr`, `borrowApr`, and `utilization` fluctuate between calls:

- APRs move by `(Math.random() - 0.5) * 0.1`, i.e. **±0.05** around the baseline
  before rounding.
- `utilization` moves by `(Math.random() - 0.5) * 0.01`, then is clamped to 0..1.

Balances (`totalSupply`, `totalBorrow`) are returned unchanged, so the dashboard
does not show drifting TVL between polls. The baseline table is never mutated in
place — values do not random-walk away from their starting points over time.

## Unknown symbols

`fetchMarkets` **throws a `TypeError`** for a symbol with no baseline entry, and
one unknown entry rejects the whole batch.

This is deliberate: failing loudly beats emitting a row of `NaN` APRs that would
render as garbage in the UI. Validate with `isAssetSymbol()` from
[`types/enums.ts`](../types/enums.ts) at the route boundary before calling in.

## Latency

The simulated ~200 ms delay is paid **once per call**, not once per asset — so
batching assets into a single `fetchMarkets` call is strictly cheaper than
looping. Tests drive this with fake timers rather than waiting in real time.

## Running the tests

```bash
npx vitest run --project server-unit lib/markets/repository.test.ts
```
