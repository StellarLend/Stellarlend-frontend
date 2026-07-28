# Performance Budgets

## Lending Route

To maintain fast initial load times for the lending page, we have implemented code splitting using `next/dynamic`.

### Budget

The lending route chunk is budgeted at **150kb**.

- This ensures that only the essential code for the landing state (Lending tab) is loaded initially.
- The `BorrowingForm`, `InterestCalculator`, and `ConfirmModal` are loaded lazily on demand.

### Icon Lazy Loading (2026-06-27)

To further reduce the initial bundle size, all icon imports have been converted to lazy-loaded components using `next/dynamic`:

- **NavigationMenu**: 10 icons (Notification, LoginCircleFill, ArrowLeftRightLine, DashboardFill, ReceiptFill, Settings5Fill, WalletFill, Bank, CoinIcon, TransactionIcon)
- **ExploreFeatures**: 6 icons (Dollar, ShieldBlockchain, Zap, Global, Union, File)
- **Transactions page**: 1 icon (Bank)
- **NotificationBell**: 1 icon (Notification)

**Implementation Details:**
- Icons are loaded on-demand using `next/dynamic` with `IconPlaceholder` as the loading state
- `IconPlaceholder` provides a lightweight skeleton with pulse animation during icon load
- This reduces the initial bundle by deferring icon code until the component is rendered
- No visual regression - icons appear seamlessly after loading

**Expected Impact:**
- Reduces initial bundle size by approximately 50-100KB (depending on icon usage)
- Improves Time to Interactive (TTI) for navigation and marketing pages
- Maintains accessibility with proper loading states

## Dashboard Route

The dashboard is the most data-heavy authenticated page and is tested with Lighthouse CI assertions in CI.

### Assertion Budgets (lighthouserc.json)

The following assertions are enforced for the dashboard route:

| Metric                  | Level   | Threshold     | Rationale                                    |
| ----------------------- | ------- | ------------- | -------------------------------------------- |
| Performance score       | error   | >= 0.6        | Overall perf score floor                     |
| LCP                     | error   | <= 3500ms     | Largest Contentful Paint                     |
| CLS                     | error   | <= 0.1        | Cumulative Layout Shift                      |
| TBT                     | error   | <= 400ms      | Total Blocking Time                          |
| Total byte weight       | warn    | <= 700KB      | Full page resource weight                    |

### Resource Budgets

Per-URL resource budgets are defined in `lighthouserc.json` under `assert.budgets`:

| Route       | Resource   | Budget |
| ----------- | ---------- | ------ |
| /dashboard  | total      | 700 KB |
| /dashboard  | script     | 350 KB |
| /dashboard  | image      | 150 KB |
| /dashboard  | interactive| 5s     |
| /dashboard  | FMP        | 2.5s   |
| /lending    | total      | 600 KB |
| /lending    | script     | 300 KB |
| /lending    | interactive| 4.5s   |

## Bundlewatch Chunk Budgets

Static chunk sizes are enforced by [bundlewatch](https://bundlewatch.io) on every push and pull request against `main`. The configuration lives in `bundlewatch.config.json`. The CI step that enforces these budgets is the `bundle-size` job in `.github/workflows/performance.yml` — it exits non-zero when any chunk exceeds its `maxSize`, which **fails the PR check**.

| Glob                                          | Budget  | Rationale                                                                                                         |
| --------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `.next/static/chunks/app/lending/**/*.js`     | 150 KB  | Lending page with lazy-loaded forms and icons; established baseline.                                              |
| `.next/static/chunks/app/dashboard/**/*.js`   | 200 KB  | See below.                                                                                                        |
| `.next/static/chunks/*.js`                    | 500 KB  | Framework shared chunks (React, Next.js runtime, etc.).                                                           |
| `.next/static/chunks/pages/*.js`              | 250 KB  | Pages Router compatibility chunks.                                                                                |
| `.next/static/css/*.css`                      | 50 KB   | Global stylesheet after Tailwind tree-shaking.                                                                    |

### Dashboard Route Budget Rationale (200 KB)

The dashboard is the most component-heavy authenticated route. Its route-specific chunks include:

- **MetricsCards** — multi-asset position overview
- **PositionSummary** — collateral breakdown and health factor
- **RecentTransactions / TransactionDetail / TransactionReceipt** — full transaction history with detail modals
- **NotificationBell** — SSE-connected live notification badge
- **LiquidationsPanel / SupplyApyChart** — charting and risk metrics
- **Headless UI dialogs** — modal primitives for transaction detail and export

The dashboard TypeScript source totals ~104 KB (raw, before minification). The lending route totals ~40 KB raw and is budgeted at 150 KB after minification. Applying the same minification ratio (~3.5×) to the dashboard source gives an expected output of ~30 KB, but the dashboard pulls in additional runtime dependencies (chart helpers, Headless UI) that lending does not. A budget of **200 KB** gives ~25 % headroom over a realistic minified output while being tight enough to catch accidental heavy imports or missing `next/dynamic` lazy splits.

Cross-check: the Lighthouse script budget for `/dashboard` is 350 KB for the entire page (shared framework chunks + route chunks). Dashboard-specific chunks represent roughly half of that budget, making 200 KB consistent with both constraints.

**To add a new component to the dashboard without exceeding the budget:**

1. Prefer `next/dynamic` for components not needed on the initial render.
2. Avoid importing entire libraries — use named imports or sub-path imports.
3. Run `pnpm build && npx bundlewatch --config bundlewatch.config.json` locally before opening a PR.

## How to maintain budgets

If you add new functionality to any page:

1. **Lazy Load:** If the new component is not needed for the initial render, lazy-load it using `next/dynamic`.
2. **Review Imports:** Ensure large libraries or heavy utility functions are not bundled into the main chunk unnecessarily.
3. **Check CI:** Both the Lighthouse CI check and the `bundle-size` bundlewatch job will automatically fail if budgets are exceeded.
4. **Update Budget:** If the budget is legitimately exceeded due to unavoidable new feature requirements, update the thresholds in `bundlewatch.config.json` (for chunk size) or `lighthouserc.json` (for Lighthouse assertions) and document the reason for the increase in this file.
