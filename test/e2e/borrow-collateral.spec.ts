import { test, expect, type Page } from "@playwright/test";

test.describe("Borrow with Collateral Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Stub markets api
    await page.route("**/api/markets?asset=XLM", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          markets: [
            { asset: "XLM", supplyApr: 8.5, borrowApr: 12.0 },
            { asset: "USDC", supplyApr: 6.0, borrowApr: 10.5 },
          ],
        }),
      });
    });

    // Stub prices api
    await page.route("**/api/prices?assets=*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          prices: {
            XLM: 0.12,
            USDC: 1.0,
            BTC: 65000.0,
            ETH: 3500.0,
          },
        }),
      });
    });
  });

  test("should complete the borrow-with-collateral journey successfully", async ({ page }) => {
    await page.goto("/lending");

    // 1. Verify wallet is connected (displayed in TopNav)
    await expect(page.getByLabel("Connected wallet")).toBeVisible();
    await expect(page.getByLabel("Connected wallet")).toContainText("Ga2j6...f5g3");

    // 2. Switch to the "Borrow" tab
    await page.getByRole("tab", { name: "Borrow Assets" }).click();
    await expect(page.getByRole("heading", { name: "Borrow Against Collateral" })).toBeVisible();

    // 3. Select USDC as the borrow asset
    const borrowAssetBox = page.getByRole("listbox", { name: "Asset to Borrow" });
    await borrowAssetBox.getByRole("option", { name: "USDC" }).click();

    // 4. Enter borrow amount
    const amountInput = page.getByLabel("Amount to Borrow");
    await amountInput.fill("100");

    // 5. Select XLM as collateral
    const collateralSection = page.locator('div:has(> label:text-is("Collateral Asset"))');
    await collateralSection.locator("button").filter({ hasText: "XLM" }).click();

    // 6. Verify required collateral auto-populates (100 * 1.5 = 150 XLM)
    const collateralAmountInput = page.getByLabel("Collateral Amount");
    await expect(collateralAmountInput).toHaveValue("150.00");

    // Verify initial health factor is shown (critical due to 150 XLM at $0.12 vs 100 USDC at $1.0)
    // 150 * 0.12 / (100 * 1.2) = 0.15x
    await expect(page.getByText("0.15x")).toBeVisible();
    await expect(page.getByText("Critical")).toBeVisible();

    // 7. Adjust collateral to be healthy (e.g. 3000 XLM)
    // 3000 * 0.12 / (100 * 1.2) = 3.00x (Healthy)
    await collateralAmountInput.fill("3000");
    await expect(page.getByText("3.00x")).toBeVisible();
    await expect(page.getByText("Healthy")).toBeVisible();

    // 8. Select loan duration
    await page.getByRole("button", { name: "1 Month" }).click();

    // Stub the transaction submission and polling status
    await page.route("**/api/tx/submit", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "submitted", hash: "abc123hash" }),
      });
    });

    let pollCount = 0;
    await page.route("**/api/tx/status/abc123hash", async (route) => {
      pollCount++;
      if (pollCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "PENDING" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "SUCCESS" }),
        });
      }
    });

    // 9. Click "Review Loan Request"
    await page.getByRole("button", { name: "Review Loan Request" }).click();

    // 10. Verify confirmation modal details
    const dialog = page.getByRole("dialog", { name: "Confirm Borrowing Transaction" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("100.00 USDC")).toBeVisible();
    await expect(dialog.getByText("3,000.00 XLM")).toBeVisible();

    // 11. Agree to terms and click Confirm
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirm Borrowing" }).click();

    // 12. Observe status toasts
    const toast = page.getByRole("status");
    await expect(toast).toContainText("Transaction submitted");
    await expect(toast).toContainText("Completed");
  });

  test("should handle insufficient collateral and validation errors", async ({ page }) => {
    await page.goto("/lending");
    await page.getByRole("tab", { name: "Borrow Assets" }).click();

    const amountInput = page.getByLabel("Amount to Borrow");
    await amountInput.fill("100");

    const collateralAmountInput = page.getByLabel("Collateral Amount");

    // Case A: Collateral below 150% minimum
    await collateralAmountInput.fill("50");
    await page.getByRole("button", { name: "Review Loan Request" }).click();
    await expect(page.getByText("Collateral must meet the 150% minimum")).toBeVisible();

    // Case B: Insufficient collateral balance (exceeds wallet balance)
    // XLM balance is 3750
    await collateralAmountInput.fill("5000");
    await page.getByRole("button", { name: "Review Loan Request" }).click();
    await expect(page.getByText("Insufficient collateral balance")).toBeVisible();
  });

  test("should support back-navigation / cancel mid-flow", async ({ page }) => {
    await page.goto("/lending");
    await page.getByRole("tab", { name: "Borrow Assets" }).click();

    await page.getByLabel("Amount to Borrow").fill("100");
    await page.getByLabel("Collateral Amount").fill("3000");
    await page.getByRole("button", { name: "1 Month" }).click();

    // Open confirm modal
    await page.getByRole("button", { name: "Review Loan Request" }).click();
    const dialog = page.getByRole("dialog", { name: "Confirm Borrowing Transaction" });
    await expect(dialog).toBeVisible();

    // Click cancel
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();

    // Verify inputs are still preserved
    await expect(page.getByLabel("Amount to Borrow")).toHaveValue("100.00");
    await expect(page.getByLabel("Collateral Amount")).toHaveValue("3,000.00");
  });

  test("should handle network error on transaction submission", async ({ page }) => {
    await page.goto("/lending");
    await page.getByRole("tab", { name: "Borrow Assets" }).click();

    await page.getByLabel("Amount to Borrow").fill("100");
    await page.getByLabel("Collateral Amount").fill("3000");
    await page.getByRole("button", { name: "1 Month" }).click();

    // Open confirm modal
    await page.getByRole("button", { name: "Review Loan Request" }).click();
    const dialog = page.getByRole("dialog", { name: "Confirm Borrowing Transaction" });
    await expect(dialog).toBeVisible();

    // Agree to terms
    await dialog.getByRole("checkbox").check();

    // Stub a network error
    await page.route("**/api/tx/submit", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Internal Server Error" } }),
      });
    });

    // Click Confirm
    await dialog.getByRole("button", { name: "Confirm Borrowing" }).click();

    // Verify error toast
    const toast = page.getByRole("status");
    await expect(toast).toContainText("Submission failed");
  });
});
