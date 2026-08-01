import { test, expect, type Page } from "@playwright/test";

const MARKETS_FIXTURE = {
  markets: [
    {
      asset: "XLM",
      supplyApr: 8.5,
      borrowApr: 12.0,
      utilization: 0.71,
      totalSupply: 2_500_000,
      totalBorrow: 1_775_000,
    },
    {
      asset: "USDC",
      supplyApr: 5.2,
      borrowApr: 7.8,
      utilization: 0.65,
      totalSupply: 10_000_000,
      totalBorrow: 6_500_000,
    },
    {
      asset: "BTC",
      supplyApr: 2.1,
      borrowApr: 4.5,
      utilization: 0.47,
      totalSupply: 500_000,
      totalBorrow: 235_000,
    },
    {
      asset: "ETH",
      supplyApr: 3.8,
      borrowApr: 6.2,
      utilization: 0.58,
      totalSupply: 1_200_000,
      totalBorrow: 696_000,
    },
  ],
  timestamp: "2026-07-30T12:00:00.000Z",
  source: "e2e-fixture",
};

async function stubMarkets(page: Page) {
  await page.route("**/api/markets**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MARKETS_FIXTURE),
    });
  });
}

test.describe("Markets browse journey", () => {
  test.beforeEach(async ({ page }) => {
    await stubMarkets(page);
  });

  test("loads markets and shows all fixture assets", async ({ page }) => {
    await page.goto("/markets");

    await expect(page.getByRole("heading", { name: "Markets" })).toBeVisible();
    await expect(page.getByTestId("markets-table")).toBeVisible();

    for (const market of MARKETS_FIXTURE.markets) {
      await expect(page.getByText(market.asset, { exact: true }).first()).toBeVisible();
    }

    await expect(page.getByText(/showing 4 of 4 markets/i)).toBeVisible();
  });

  test("sorts by borrow APR when the column header is toggled", async ({
    page,
  }) => {
    await page.goto("/markets");
    await expect(page.getByTestId("markets-table")).toBeVisible();

    // Default sort is asset asc. Toggle Borrow APR → asc, then desc.
    const borrowHeader = page.getByRole("button", { name: /borrow apr/i });
    await borrowHeader.click();

    // Ascending borrow: BTC (4.5) should appear before XLM (12.0) in the desktop table.
    const table = page.locator("table").first();
    await expect(table).toBeVisible();
    const firstAssetAsc = table.locator("tbody tr").first();
    await expect(firstAssetAsc).toContainText("BTC");

    await borrowHeader.click(); // desc
    const firstAssetDesc = table.locator("tbody tr").first();
    await expect(firstAssetDesc).toContainText("XLM");
  });

  test("filters to a single asset and clears back to full list", async ({
    page,
  }) => {
    await page.goto("/markets");
    await expect(page.getByTestId("markets-table")).toBeVisible();

    const filter = page.getByLabel(/filter markets by asset/i);
    await filter.fill("USDC");

    await expect(page.getByText(/showing 1 of 4 markets/i)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText("USDC", { exact: true }).first()).toBeVisible();
    // Other assets should not remain visible in the filtered result count path.
    await expect(page.getByTestId("markets-filter-empty")).toHaveCount(0);

    // "Drill into" the asset row: filtered table exposes the asset's APR details.
    await expect(page.getByText("7.80%").first()).toBeVisible();
    await expect(page.getByText("5.20%").first()).toBeVisible();

    await page.getByRole("button", { name: /clear market filter/i }).click();
    await expect(page.getByText(/showing 4 of 4 markets/i)).toBeVisible();
  });

  test("shows empty filter state for a non-matching query", async ({
    page,
  }) => {
    await page.goto("/markets");
    await expect(page.getByTestId("markets-table")).toBeVisible();

    await page.getByLabel(/filter markets by asset/i).fill("NOTANASSET");
    await expect(page.getByTestId("markets-filter-empty")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/no matching markets/i)).toBeVisible();

    await page.getByRole("button", { name: /clear filter/i }).click();
    await expect(page.getByText(/showing 4 of 4 markets/i)).toBeVisible();
  });
});
