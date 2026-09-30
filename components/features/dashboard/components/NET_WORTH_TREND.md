# NetWorthTrend Component

## Purpose

The `NetWorthTrend` component displays historical portfolio net worth data on the dashboard, providing users with context about how their portfolio value has changed over time. It calculates and visualizes the absolute change, percentage change, and trend direction based on historical snapshots.

## Architecture

```
components/features/dashboard/components/NetWorthTrend.tsx
hooks/usePositionHistory.ts
lib/utils/format.ts
```

### Component Hierarchy

- `NetWorthTrend` - Main component that orchestrates data fetching and rendering
- Uses `usePositionHistory` hook for API interaction
- Leverages existing design system tokens from `constants/design-tokens.ts`

### Props

```typescript
interface NetWorthTrendProps {
  window?: TimeWindow;           // Default: "7d"
  onWindowChange?: (window: TimeWindow) => void;
}
```

### State Management

- `window`: Current time window selection (24h, 7d, 30d)
- Derived state via `useMemo` for calculated trend values to prevent unnecessary recalculations

## API Usage

The component fetches data from `/api/positions/history` via the `usePositionHistory` hook.

### Request Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| from | timestamp | Start of time range (calculated from window) |
| to | timestamp | End of time range (now) |
| interval | '1h' | Time bucketing interval |

### Response Structure

```typescript
interface SnapshotHistoryResponse {
  walletAddress: string;
  snapshots: Array<{
    timestamp: number;
    supplied: number;
    borrowed: number;
    effectiveSupplyApy: number;
    effectiveBorrowApy: number;
  }>;
  interval: Interval;
  bucketCount: number;
}
```

The hook transforms this into `NetWorthSnapshot` with computed `netWorth = supplied - borrowed`.

## Calculation Logic

### Net Worth Value

For each snapshot:
```
netWorth = supplied - borrowed
```

### Delta (Absolute Change)

```
delta = latestSnapshot.netWorth - firstSnapshot.netWorth
```

### Percentage Change

```
percentChange = ((latest - first) / first) * 100
```

With division-by-zero handling: when `firstSnapshot.netWorth === 0`, percent change defaults to `0`.

### Trend Direction

| Condition | Direction | Icon | Color |
|-----------|-----------|------|-------|
| delta > 0 | up | TrendingUp | success (#097C4C) |
| delta < 0 | down | TrendingDown | danger (#ef4444) |
| delta == 0 | flat | ArrowRight | neutral (#AAABAB) |

## Edge Cases

### Empty History

When no snapshots exist:
- Displays informative empty state
- Message: "No historical portfolio data available yet. Your trend will appear once snapshots have been recorded."

### Single Snapshot

When only one snapshot exists:
- Displays current value
- Shows "Single snapshot — trend will appear after more data"
- Delta and percent are not meaningful with single data point

### Division-by-Zero

When first snapshot netWorth is 0:
- Percent change returns 0 (no infinite values)
- No crash or NaN display

### Window with No Matching Snapshots

Handled by API returning empty snapshots array, which renders the empty state.

### Loading State

Skeleton-like loading placeholders matching the card layout structure.

### Error State

Graceful error message without crashing the dashboard:
- "Failed to load net worth trend. Please try again later."

## Testing

Tests located in `NetWorthTrend.test.tsx` cover:

- Loading state rendering
- Error state handling
- Empty history state
- Single snapshot state
- Positive trend (latest > first)
- Negative trend (latest < first)
- Flat trend (latest == first)
- Division-by-zero handling
- Window selector functionality
- Color application for each trend type
- onWindowChange callback invocation

### Running Tests

```bash
npm run test
# or
npm run test:coverage
```

### Mock Strategy

The `usePositionHistory` hook is mocked to provide controlled `NetWorthTrendData` responses, allowing testing of each state independently of API availability.