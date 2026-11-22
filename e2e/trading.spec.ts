import { test, expect } from "@playwright/test";
import { setupFreighterMock, mockHorizonAccount } from "./fixtures/freighter";

const TEST_ADDRESS = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

test.describe("Demo Trading Flows", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("full demo trading flow: supply -> borrow within limit -> borrow over limit rejected -> repay -> withdraw -> reload persistence", async ({
    page,
  }) => {
    // Connect wallet first
    await setupFreighterMock(page, { status: "connected", address: TEST_ADDRESS });
    await mockHorizonAccount(page, { address: TEST_ADDRESS, funded: true });

    await page.goto("/markets");
    await page.getByRole("button", { name: /Connect Freighter/i }).first().click();
    await expect(page.getByText("GA5ZSEJY...K4KZVN")).toBeVisible();

    // 1. Select USDC trade button
    const usdcRow = page.locator("tr").filter({ hasText: "USDC" });
    await usdcRow.getByRole("button", { name: "Trade" }).click();

    // Ensure Trade panel appears
    await expect(page.getByRole("heading", { name: "USDC" })).toBeVisible();

    // Supply 100 USDC
    await page.getByRole("button", { name: "Supply", exact: true }).click();
    const amountInput = page.getByRole("textbox", { name: /Amount in USDC/i });
    await amountInput.fill("100");
    await page.getByRole("button", { name: "Confirm Supply" }).click();

    // Verify success status
    await expect(page.getByRole("status")).toHaveText(/Supply of 100 USDC recorded \(demo ledger\)\./);

    // 2. Select XLM and borrow within limit
    const xlmRow = page.locator("tr").filter({ hasText: "XLM" });
    await xlmRow.getByRole("button", { name: "Trade" }).click();
    await expect(page.getByRole("heading", { name: "XLM" })).toBeVisible();

    await page.getByRole("button", { name: "Borrow", exact: true }).click();
    const xlmInput = page.getByRole("textbox", { name: /Amount in XLM/i });
    // XLM price is $0.12. 100 USDC collateral (LTV 0.8) allows up to $80 borrow limit.
    // 50 XLM = $6, well within $80 limit.
    await xlmInput.fill("50");
    await page.getByRole("button", { name: "Confirm Borrow" }).click();
    await expect(page.getByRole("status")).toHaveText(/Borrow of 50 XLM recorded \(demo ledger\)\./);

    // 3. Rejection 1: Try to borrow over limit
    // Try to borrow 1,000,000 XLM
    await xlmInput.fill("1000000");
    await page.getByRole("button", { name: "Confirm Borrow" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Borrow exceeds your borrowing limit. Supply more collateral."
    );

    // 4. Rejection 2: Try to repay more than borrowed
    await page.getByRole("button", { name: "Repay", exact: true }).click();
    await xlmInput.fill("100"); // currently borrowed is 50
    await page.getByRole("button", { name: "Confirm Repay" }).click();
    await expect(page.getByRole("status")).toHaveText("Cannot repay more than borrowed.");

    // 5. Repay the 50 XLM borrowed
    await xlmInput.fill("50");
    await page.getByRole("button", { name: "Confirm Repay" }).click();
    await expect(page.getByRole("status")).toHaveText(/Repay of 50 XLM recorded \(demo ledger\)\./);

    // 6. Withdraw from USDC supply
    await usdcRow.getByRole("button", { name: "Trade" }).click();
    await expect(page.getByRole("heading", { name: "USDC" })).toBeVisible();

    // Rejection 3: Try to withdraw more than supplied
    await page.getByRole("button", { name: "Withdraw", exact: true }).click();
    const usdcInput = page.getByRole("textbox", { name: /Amount in USDC/i });
    await usdcInput.fill("200");
    await page.getByRole("button", { name: "Confirm Withdraw" }).click();
    await expect(page.getByRole("status")).toHaveText("Cannot withdraw more than supplied.");

    // Valid withdraw: withdraw 40 USDC
    await usdcInput.fill("40");
    await page.getByRole("button", { name: "Confirm Withdraw" }).click();
    await expect(page.getByRole("status")).toHaveText(/Withdraw of 40 USDC recorded \(demo ledger\)\./);

    // 7. Verify demo positions persist across reload
    // Remaining USDC supply should be 60.0000
    await expect(usdcRow).toContainText("+60");

    await page.reload();

    // Re-connect wallet (since wallet connection in React state is per-session)
    await page.getByRole("button", { name: /Connect Freighter/i }).first().click();
    await expect(page.getByText("GA5ZSEJY...K4KZVN")).toBeVisible();

    // Re-verify after reload that persisted positions for TEST_ADDRESS are loaded
    const usdcRowAfter = page.locator("tr").filter({ hasText: "USDC" });
    await expect(usdcRowAfter).toContainText("+60");
  });
});
