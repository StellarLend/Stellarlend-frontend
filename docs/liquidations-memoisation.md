# LiquidationsPanel memoisation

Row-level health and liquidation price calculations should be memoised so
dashboard price ticks do not re-render unaffected rows. Prefer `useMemo` keyed
by `(positionId, priceSnapshot)` and stable callback refs for action handlers.

Profile with React DevTools Profiler before/after when adding new derived columns.
