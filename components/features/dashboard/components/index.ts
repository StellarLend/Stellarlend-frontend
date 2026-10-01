/**
 * Public barrel for the dashboard feature components.
 *
 * Invariants (enforced by `./index.test.tsx`):
 *
 * 1. This module exposes exactly the components below plus the type-only
 *    `TimeWindow` re-export — no default export and no internal helpers.
 *    Adding or removing a binding changes the public API for every consumer
 *    and must ship with a compatibility plan (update EXPECTED_EXPORTS in the
 *    test in the same PR).
 * 2. Every value binding is the *identical* reference to the source module's
 *    export, so importing through this barrel and through the deep path share
 *    one module instance (duplicate instances break hook/context identity).
 *    Never alias two keys to the same module.
 * 3. `TimeWindow` is exported with `export type` and must stay erased at
 *    runtime, so JavaScript consumers never receive an `undefined` binding.
 * 4. Evaluating this module is side-effect free: no network, storage, or
 *    browser-only access at import time, so it is safe to import during server
 *    rendering and safe to import repeatedly/concurrently.
 * 5. Consumers cannot overwrite a binding, and reading an unknown member yields
 *    `undefined` rather than throwing.
 */
export { default as MetricsCards } from './MetricsCards';
export { default as SearchResults } from './SearchResults';
export { TransactionsSummaryHeader } from './TransactionsSummaryHeader';
export { default as LiquidationsPanel } from './LiquidationsPanel';
export { default as PositionSummary } from './PositionSummary';
export { default as NextPaymentDue } from './NextPaymentDue';
export { default as TransactionDetail } from './TransactionDetail';
export { default as TransactionReceipt } from './TransactionReceipt';
export { default as NetWorthTrend } from './NetWorthTrend';
export { default as FilterPresets } from './FilterPresets';
export type { TimeWindow } from '@/hooks/usePositionHistory';
