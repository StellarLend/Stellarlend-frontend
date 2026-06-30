# MetricsCards – Asset Filter

## Overview

`MetricsCards` renders the dashboard summary cards (balance, borrow, supply) followed by a
per-asset breakdown section. An **asset filter/search bar** sits above the asset grid so users
can narrow to a specific asset by symbol or name.

## UI

```
[ 🔍 Search assets…                         ] [x]   Showing 2 of 4
┌──────────┐  ┌──────────┐
│ XLM      │  │ USDC     │
│ Stellar… │  │ USD Coin │
└──────────┘  └──────────┘
```

## Behaviour

| Scenario | Result |
|---|---|
| No query | All registry assets shown; "Showing N of N" |
| Symbol match (case-insensitive) | Filtered list; count updates |
| Name match (case-insensitive) | Filtered list; count updates |
| No match | Empty-state message with inline _Clear filter_ link |
| Clear button (×) | Resets query; all assets visible again |

## Keyboard Accessibility

- The search input has an associated `<label>` (visually hidden via `sr-only`), so screen
  readers announce _"Filter assets"_.
- The clear (×) button is a focusable `<button>` with `aria-label="Clear filter"`.
- The asset count region uses `aria-live="polite"` so screen readers announce filter updates.

## Asset Data

Assets come from `lib/assets/registry.ts` → `getAssets()`. If the registry throws (e.g.
malformed JSON), the component catches the error and renders an empty list without crashing.

## Files

| File | Purpose |
|---|---|
| `MetricsCards.tsx` | Component implementation |
| `MetricsCards.filter.test.tsx` | Unit tests for the filter feature |
| `METRICS_FILTER.md` | This document |

## Tests

Run the filter-specific suite:

```bash
npm test -- MetricsCards
```

Covered cases: accessible label · showing X of Y · symbol filter · name filter ·
no-match empty state · clear-filter button · empty-state inline clear ·
single-asset list · registry error fallback.
