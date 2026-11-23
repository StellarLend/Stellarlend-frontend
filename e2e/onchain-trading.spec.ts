import { test, expect } from "@playwright/test";
import { setupFreighterMock, mockHorizonAccount } from "./fixtures/freighter";
import { mockSorobanRpc, type SorobanScenario } from "./fixtures/soroban";

const TEST_ADDRESS = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

test.describe("On-Chain Trading Flows", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("onchain supply increases position", async ({ page }) => {
    let scenario: SorobanScenario = {
      position: { collateral: 0n, debt: 0n, healthFactor: 100_000_000n },
    };

    await setupFreighterMock(page, { status: "connected", address: TEST_ADDRESS });
    await mockHorizonAccount(page, { address: TEST_ADDRESS, funded: true, nativeBalance: "1000.0000000" });
    await mockSorobanRpc(page, () => scenario);

    await page.goto("/markets");
    await page.getByRole("button", { name: /Connect Freighter/i }).first().click();
    await expect(page.getByText("GA5ZSEJY...K4KZVN")).toBeVisible();

    // 1. Open trade for XLM (on-chain market)
    const xlmRow = page.locator("tr").filter({ hasText: "XLM" });
    await xlmRow.getByRole("button", { name: "Trade" }).click();
    await expect(page.getByRole("heading", { name: "XLM" })).toBeVisible();

    // 2. Supply 100 XLM
    await page.getByRole("button", { name: "Supply", exact: true }).click();
    const supplyInput = page.getByRole("textbox", { name: /Amount in XLM/i });
    await supplyInput.fill("100");

    const confirmSupplyBtn = page.getByRole("button", { name: /Confirm Supply/i });
    await confirmSupplyBtn.click();

    // Assert status progression: pending -> confirmed
    const statusEl = page.locator('[role="status"]');
    await expect(statusEl).toBeVisible();
    await expect(statusEl).toHaveText(/Transaction confirmed\./);

    // Update mock position after supply
    scenario = {
      position: { collateral: 100_000_0000000n, debt: 0n, healthFactor: 100_000_000n },
    };

    // 3. Borrow 50 XLM
    await page.getByRole("button", { name: "Borrow", exact: true }).click();
    const borrowInput = page.getByRole("textbox", { name: /Amount in XLM/i });
    await borrowInput.fill("50");
    await page.getByRole("button", { name: /Confirm Borrow/i }).click();

    await expect(statusEl).toHaveText(/Transaction confirmed\./);

    // Update mock position after borrow
    scenario = {
      position: { collateral: 100_000_0000000n, debt: 50_000_0000000n, healthFactor: 20_000n },
    };

    // 4. Repay 50 XLM
    await page.getByRole("button", { name: "Repay", exact: true }).click();
    const repayInput = page.getByRole("textbox", { name: /Amount in XLM/i });
    await repayInput.fill("50");
    await page.getByRole("button", { name: /Confirm Repay/i }).click();

    await expect(statusEl).toHaveText(/Transaction confirmed\./);

    // Update mock position after repay
    scenario = {
      position: { collateral: 100_000_0000000n, debt: 0n, healthFactor: 100_000_000n },
    };

    // 5. Withdraw 40 XLM
    await page.getByRole("button", { name: "Withdraw", exact: true }).click();
    const withdrawInput = page.getByRole("textbox", { name: /Amount in XLM/i });
    await withdrawInput.fill("40");
    await page.getByRole("button", { name: /Confirm Withdraw/i }).click();

    await expect(statusEl).toHaveText(/Transaction confirmed\./);
  });

  test("onchain borrow failure shows error", async ({ page }) => {
    const scenario: SorobanScenario = {
      position: { collateral: 100_000_0000000n, debt: 0n, healthFactor: 100_000_000n },
      failSend: true,
    };

    await setupFreighterMock(page, { status: "connected", address: TEST_ADDRESS });
    await mockHorizonAccount(page, { address: TEST_ADDRESS, funded: true, nativeBalance: "1000.0000000" });
    await mockSorobanRpc(page, () => scenario);

    await page.goto("/markets");
    await page.getByRole("button", { name: /Connect Freighter/i }).first().click();
    await expect(page.getByText("GA5ZSEJY...K4KZVN")).toBeVisible();

    const xlmRow = page.locator("tr").filter({ hasText: "XLM" });
    await xlmRow.getByRole("button", { name: "Trade" }).click();
    await expect(page.getByRole("heading", { name: "XLM" })).toBeVisible();

    await page.getByRole("button", { name: "Borrow", exact: true }).click();
    const borrowInput = page.getByRole("textbox", { name: /Amount in XLM/i });
    await borrowInput.fill("10");
    await page.getByRole("button", { name: /Confirm Borrow/i }).click();

    // Verify failure status is displayed
    const statusEl = page.locator('[role="status"]');
    await expect(statusEl).toBeVisible();
    await expect(statusEl).toHaveText(/Transaction failed\.|Soroban RPC rejected the transaction\./);
  });
});
