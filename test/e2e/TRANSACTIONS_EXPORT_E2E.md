# Transactions CSV Export — E2E Test Guide

## Overview

`test/e2e/transactions-export.spec.ts` provides end-to-end coverage for the
transactions CSV export feature exposed at `GET /api/transactions/export`.

Network responses are **stubbed via `page.route()`** so the suite is fully
deterministic and runnable without a live backend.

---

## Scenarios Covered

| # | Scenario | What is asserted |
|---|----------|-----------------|
| 1 | **Button visibility** | `Export CSV` button renders on `/dashboard/transactions` |
| 2 | **Download triggered** | Clicking the button fires a browser download; suggested filename matches `transactions*.csv` |
| 3 | **CSV header** | First row of the downloaded file equals `ID,Type,Amount,Asset,Date,Time,Status` |
| 4 | **Filter scoping** | When `?status=Completed` is active, every data row in the CSV has `Status = Completed` |
| 5 | **Empty export** | A filtered result with no matches yields a file containing only the header row |
| 6 | **Large export** | 100-row export downloads fully without truncation |
| 7 | **Export failure** | A 500 response from the API does not crash the page or throw uncaught JS errors |

---

## Running the Suite

```bash
# Run only this spec against the default (Chromium) project
npx playwright test test/e2e/transactions-export.spec.ts

# Run against all configured browsers
npx playwright test test/e2e/transactions-export.spec.ts --project=chromium --project=firefox --project=webkit

# Run with the Playwright UI (interactive)
npx playwright test test/e2e/transactions-export.spec.ts --ui

# Show the HTML report after a run
npx playwright show-report .next/playwright-report
```

The suite requires no running server — `page.route()` intercepts all
`/api/transactions/export*` requests at the network layer.

---

## How Stubbing Works

Each test calls one of three helper functions defined at the top of the spec:

| Helper | Behaviour |
|--------|-----------|
| `stubExport(page, rows)` | Returns a 200 CSV built from `rows` |
| `stubEmptyExport(page)` | Returns a 200 CSV with the header only |
| `stubExportError(page)` | Returns a 500 JSON error body |

The filter-scoping test uses an inline route handler that inspects the
`status` query parameter and selects the matching row set, simulating real
server-side filtering.

---

## CSV Column Contract

The export API (`app/api/transactions/export/route.ts`) delegates serialisation
to `lib/transactions/csv.ts → serializeTransactionsToCSV()`. The expected
columns are:

```
ID, Type, Amount, Asset, Date, Time, Status
```

All fields are double-quoted and formula-injection characters (`= + - @ \t \r`)
are prefixed with a single quote per RFC 4180.

---

## Edge Cases

- **Empty result set** — header row only; no blank trailing line.
- **Large export** — 100 rows; verifies the download stream is not silently truncated.
- **Server error** — `Export CSV` button remains interactive; no uncaught page
  exceptions related to the export operation.
