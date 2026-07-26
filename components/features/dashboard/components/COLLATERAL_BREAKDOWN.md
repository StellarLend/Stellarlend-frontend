# Collateral Breakdown Panel

**Component:** `components/features/dashboard/components/CollateralBreakdown.tsx`

Renders inside `PositionSummary` as a sub-panel showing how a borrower's collateral is distributed across assets.

## Data Flow

```
/api/positions
  └─ usePositions()          (hooks/usePositions.ts)
  └─ deriveCollateralShares() (hooks/usePositions.ts)
  └─ useCollateralShares()    (hooks/usePositions.ts)
       └─ CollateralBreakdown (renders in PositionSummary)
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `shares` | `CollateralShare[]` | Per-asset collateral shares |
| `isLoading` | `boolean` | Shows skeleton when true |

## CollateralShare Shape

```ts
interface CollateralShare {
  asset: string;     // e.g. "XLM"
  usdValue: number;  // raw USD value
  share: number;     // integer 0-100; all shares sum to exactly 100
}
```

## Rounding

Percentages are derived via **largest-remainder** method so the displayed shares always sum to exactly 100%.

## States

| State | Render |
|-------|--------|
| Loading | Three `<Skeleton>` rows |
| No collateral | "No collateral posted" empty state |
| Data | Accessible `<table>` with Asset / USD Value / Share columns |

## Accessibility

- `<table aria-label="Collateral allocation breakdown">` — screen-reader context
- Column headers use `scope="col"`
- Each data row has `tabIndex={0}` and `aria-label` summarising the row
- Asset name resolved from `lib/assets/registry.ts`; falls back to symbol

## Tests

`CollateralBreakdown.test.tsx` covers:
- `deriveCollateralShares` unit tests (empty, zero, single asset, 3-way split, largest-remainder, missing metadata)
- Component rendering (loading, empty, table headers, row values, percentages)
- Accessibility (tabIndex, aria-label on rows, scope attributes)

```bash
pnpm exec vitest run --project accessibility components/features/dashboard/components/CollateralBreakdown.test.tsx
```
