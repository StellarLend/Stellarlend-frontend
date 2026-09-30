# AssetSelector inline price tooltip

## Overview

`AssetSelector` shows a spot-price tooltip on each asset row in the dropdown. Prices come from the public [`GET /api/prices`](../../../app/api/prices/route.ts) route and are formatted with [`formatCurrency`](../../../lib/utils/format.ts).

Users can hover or keyboard-focus an option to see the current price without leaving lend/borrow forms.

## Behavior

- **Trigger:** Hover and keyboard focus on each asset option (via [`Tooltip`](../../atoms/Tooltip/Tooltip.tsx)).
- **Formatting:** `$` + `formatCurrency(price)` (for example `$0.12`, `$65,000.00`).
- **Loading:** Tooltip shows `Loading price...` while the first fetch is in flight. Selection remains enabled.
- **Errors:** If `/api/prices` fails and no cached value exists for a symbol, the tooltip shows `Price unavailable`.
- **Caching:** Client-side session cache in [`usePrices`](../../../hooks/usePrices.ts) mirrors the server TTL (5 seconds). Fresh entries are reused; stale entries are shown immediately and refreshed in the background when the dropdown opens.

## Data flow

```text
AssetSelector
  └─ usePrices(assetSymbols)
       └─ GET /api/prices?assets=XLM,USDC,...
            └─ session cache (5s TTL)
                 └─ Tooltip content per row
```

## Access control

`/api/prices` is a public route. No wallet session or API keys are required for the tooltip.

## Testing

```bash
npm test -- AssetSelector
npm test -- usePrices
```

Coverage targets:

- Successful price fetch and formatting
- Fetch failure → `Price unavailable`
- Stale cache refresh
- Keyboard focus tooltip
- Selection while prices load
- Rapid open/close without redundant fetches

## Related files

| File | Role |
| --- | --- |
| `components/shared/ui/AssetSelector.tsx` | Dropdown UI and tooltip wiring |
| `hooks/usePrices.ts` | Session cache + `/api/prices` client helper |
| `components/shared/ui/__tests__/AssetSelector.price.test.tsx` | Component price-tooltip tests |
| `hooks/usePrices.test.ts` | Hook and cache unit tests |
