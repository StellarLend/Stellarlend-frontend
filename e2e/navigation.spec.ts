import { test, expect } from "@playwright/test";

test.describe("Site Navigation", () => {
  test("navigation between /, /markets, and /docs", async ({ page }) => {
    // 1. Start at home /
    await page.goto("/");
    await expect(page).toHaveURL(/\/($|en\/?$)/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lend and borrow on Stellar");

    // 2. Navigate to /markets via nav header link
    const marketsNavLink = page.getByRole("link", { name: /^Markets$/i });
    await expect(marketsNavLink).toBeVisible();
    await marketsNavLink.click();

    await expect(page).toHaveURL(/\/markets/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Markets");

    // 3. Navigate to /docs via nav link
    const docsNavLink = page.getByRole("link", { name: /^Docs$/i });
    await expect(docsNavLink).toBeVisible();
    await docsNavLink.click();

    await expect(page).toHaveURL(/\/docs/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Documentation");

    // 4. Navigate back to Home via brand link
    const brandLink = page.getByRole("link", { name: /Stellar/i }).first();
    await brandLink.click();
    await expect(page).toHaveURL(/\/($|en\/?$)/);
  });
});
