# E2E: markets browse journey

Playwright coverage for the public markets table.

Spec: [`test/e2e/markets-browse.spec.ts`](../test/e2e/markets-browse.spec.ts)

## Scenario

1. Stub `GET /api/markets` with a deterministic 4-asset fixture (XLM, USDC, BTC, ETH).
2. Open `/markets` and assert the table loads with all four assets.
3. Sort by **Borrow APR** (asc → BTC first; desc → XLM first).
4. Filter to `USDC` and assert single-row details (APRs) — this is the “asset drill-down” available on the current UI (there is no separate asset detail route yet).
5. Clear filter and restore full list.
6. Filter to a non-matching symbol and assert the empty-filter state, then clear.

## Fixtures

Inline JSON in the spec (`MARKETS_FIXTURE`). No shared DB. Isolated from other e2e files via per-test `page.route`.

## Running

```bash
npx playwright test test/e2e/markets-browse.spec.ts --project=chromium
```

Requires the app reachable at `PLAYWRIGHT_BASE_URL` (default `http://localhost:3000`) or the config `webServer` to start `npm run dev`.
