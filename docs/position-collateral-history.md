# Position Collateral Ratio History

`PositionSummary` renders a collateral ratio history chart so borrowers can see
whether their collateral-to-debt ratio is drifting toward liquidation.

## Data source

The chart uses the existing `/api/positions/history?interval=1d` endpoint. It
reads the snapshot shape from `lib/positions/snapshot.ts` and derives each point
as:

```text
collateral ratio = supplied / borrowed
```

Snapshots without positive supplied or borrowed values are ignored because they
cannot produce a meaningful finite ratio.

## Liquidation reference

The chart draws a dashed `1.00x` reference line. A latest ratio at or below this
line is marked as being at the liquidation threshold, matching the current
PositionSummary health-band boundary where health factors below `1.0` are
critical.

## States

The component handles:

- loading while the history request is in flight;
- empty when no usable snapshot ratio exists;
- error when the existing history endpoint fails;
- single-snapshot histories;
- reduced-motion users by disabling inline SVG transitions.
