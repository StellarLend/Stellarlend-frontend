import { test, expect } from "@playwright/test";
import { setupFreighterMock, mockHorizonAccount } from "./fixtures/freighter";

const TEST_ADDRESS = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

test.describe("Wallet Connection Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and cookies before each test
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test("scenario 1: shows not installed message when Freighter is not detected", async ({ page }) => {
    await setupFreighterMock(page, { status: "not_installed" });
    await page.goto("/markets");

    // Click Connect Freighter
    const connectBtn = page.getByRole("button", { name: /Connect Freighter/i }).first();
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // Verify not detected message
    await expect(
      page.getByText("Freighter wallet not detected. Install it from freighter.app, or keep browsing in demo mode.")
    ).toBeVisible();
  });

  test("scenario 2: shows declined message when user declines connection", async ({ page }) => {
    await setupFreighterMock(page, { status: "declined" });
    await page.goto("/markets");

    const connectBtn = page.getByRole("button", { name: /Connect Freighter/i }).first();
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // Verify declined message
    await expect(page.getByText("Wallet connection was declined.")).toBeVisible();
  });

  test("scenario 3: connects successfully and displays funded balance", async ({ page }) => {
    await setupFreighterMock(page, { status: "connected", address: TEST_ADDRESS });
    await mockHorizonAccount(page, { address: TEST_ADDRESS, funded: true, nativeBalance: "250.5000000" });

    await page.goto("/markets");

    const connectBtn = page.getByRole("button", { name: /Connect Freighter/i }).first();
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // Verify address is displayed in shortened form: GA5ZSEJY...K4KZVN (slice 0,8 ... -6)
    await expect(page.getByText("GA5ZSEJY...K4KZVN")).toBeVisible();
    await expect(page.getByText("250.50 XLM")).toBeVisible();

    // Disconnect button in header
    const disconnectBtn = page.getByRole("button", { name: "GA5Z...KZVN" });
    await expect(disconnectBtn).toBeVisible();

    // Click disconnect
    await disconnectBtn.click();
    await expect(page.getByText("Demo mode (no wallet connected)")).toBeVisible();
  });

  test("scenario 3b: connects successfully with unfunded account", async ({ page }) => {
    await setupFreighterMock(page, { status: "connected", address: TEST_ADDRESS });
    await mockHorizonAccount(page, { address: TEST_ADDRESS, funded: false });

    await page.goto("/markets");

    const connectBtn = page.getByRole("button", { name: /Connect Freighter/i }).first();
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    await expect(page.getByText("GA5ZSEJY...K4KZVN")).toBeVisible();
    await expect(page.getByText("0.00 (unfunded on testnet) XLM")).toBeVisible();
  });
});
