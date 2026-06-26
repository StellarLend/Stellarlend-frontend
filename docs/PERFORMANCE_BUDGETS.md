# Performance Budgets

## Lending Route

To maintain fast initial load times for the lending page, we have implemented code splitting using `next/dynamic`.

### Budget

The lending route chunk is budgeted at **150kb**.

- This ensures that only the essential code for the landing state (Lending tab) is loaded initially.
- The `BorrowingForm`, `InterestCalculator`, and `ConfirmModal` are loaded lazily on demand.

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

## How to maintain budgets

If you add new functionality to any page:

1. **Lazy Load:** If the new component is not needed for the initial render, lazy-load it using `next/dynamic`.
2. **Review Imports:** Ensure large libraries or heavy utility functions are not bundled into the main chunk unnecessarily.
3. **Check CI:** The Lighthouse CI check will automatically fail if assertion budgets are exceeded.
4. **Update Budget:** If the budget is legitimately exceeded due to unavoidable new feature requirements, update the thresholds in `lighthouserc.json` and document the reason for the increase in this file.
