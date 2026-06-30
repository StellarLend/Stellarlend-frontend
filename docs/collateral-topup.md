# Collateral Top-Up Shortcut

`BorrowingForm` includes a target-health shortcut that helps borrowers choose a
collateral amount without guessing. The user can select a preset target health
factor or enter a custom target, then apply the computed collateral amount to the
form.

## Computation

The shortcut reuses the lending health model in `lib/lending/health.ts` instead
of duplicating protocol math in the component.

```text
target collateral units =
  loan amount * borrow asset USD price * liquidation threshold * target health
  / collateral asset USD price
```

The liquidation threshold is the same `LIQUIDATION_THRESHOLD_RATIO` used by
`calculateProjectedBorrowHealth`, so the displayed preview and the shortcut stay
aligned.

## Bounds

Custom targets are clamped to `MIN_TARGET_HEALTH_FACTOR` and
`MAX_TARGET_HEALTH_FACTOR`. This keeps accidental inputs such as `0`, negative
values, or extremely large numbers from producing misleading suggestions.

If the selected target requires more collateral than the wallet balance, the
shortcut shows the full target but applies the available balance. Existing
submission validation still blocks undercollateralized requests.

If the current collateral already reaches the target, the top-up amount is shown
as zero and applying the shortcut keeps the current collateral amount.
