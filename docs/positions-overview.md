# Positions overview grid

Dashboard component that lists all borrow positions from `usePositions` and
lets users sort by risk (health factor) or size.

Source: [`PositionsOverviewGrid.tsx`](../components/features/dashboard/components/PositionsOverviewGrid.tsx)

Tests: [`PositionsOverviewGrid.test.tsx`](../components/features/dashboard/components/PositionsOverviewGrid.test.tsx)

## Data

- Reads `hooks/usePositions().positions` (`BorrowPosition[]`).
- No new API endpoint.
- Optional props (`positions`, `isLoading`, `error`, `onRetry`) override the hook for tests.

## Sort keys

| Key | Default direction | Meaning |
| --- | --- | --- |
| `health` | ascending | **Riskiest first** (lowest health factor) |
| `size` | descending | Largest amount first |

- Column headers are buttons with `aria-sort` (`ascending` / `descending` / `none`).
- Clicking the active column flips direction; switching columns applies the default for that key.
- Ties break on `asset`, then `id`.
- Missing health sorts as `+Infinity` under health-asc (appears last when riskiest-first).
- Missing / non-finite size treats as `0`.

## States

| State | UI |
| --- | --- |
| Loading | `aria-busy` section + status text |
| Empty | `EmptyState` “No open positions” |
| Error | `EmptyState` tone=error + Try again |
| Ready | Sortable table with `HealthFactorBadge` per row |

## Mounting

Mounted on the dashboard via `app/dashboard/DashboardClient.tsx` below the
metrics strip so users can triage risk without leaving the home view.
