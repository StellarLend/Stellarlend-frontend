import { test, expect } from "@playwright/test";

test.describe("Lending transaction progress", () => {
  test("submits a lend transaction and updates the progress stepper through building, submitted, and confirmed", async ({
    page,
  }) => {
    let statusPollCount = 0;

    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            user: {
              walletAddress: "G".padEnd(56, "A"),
            },
          },
        }),
      });
    });

    await page.route("**/api/markets?asset=XLM", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          markets: [{ asset: "XLM", supplyApr: 8.5, borrowApr: 12 }],
        }),
      });
    });

    await page.route("**/api/prices**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prices: [] }),
      });
    });

    await page.route("**/api/quote", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: { dailyEarnings: 0.0233, totalEarnings: 0.7 },
        }),
      });
    });

    await page.route("**/api/tx/submit", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "submitted",
          hash: "lend-progress-hash",
        }),
      });
    });

    await page.route("**/api/tx/status/lend-progress-hash", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      statusPollCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: statusPollCount === 1 ? "PENDING" : "SUCCESS",
          hash: "lend-progress-hash",
        }),
      });
    });

    await page.addInitScript(() => {
      window.sessionStorage.setItem("walletAddress", "G".padEnd(56, "A"));
    });

    await page.goto("/lending");

    await page.getByLabel("Amount to Lend").fill("100");
    await page.getByRole("button", { name: "Review Lending Offer" }).click();

    await expect(
      page.getByRole("dialog", { name: "Confirm Lending Transaction" }),
    ).toBeVisible();
    await page.getByRole("checkbox").check();

    const progress = page.getByRole("region", { name: "Transaction progress" });
    await page.getByRole("button", { name: "Confirm Lending" }).click();

    await expect(progress.locator('[data-step="building"]')).toHaveAttribute(
      "data-state",
      "current",
    );
    await expect(progress.locator('[data-step="submitted"]')).toHaveAttribute(
      "data-state",
      "current",
    );
    await expect(progress.locator('[data-step="confirmed"]')).toHaveAttribute(
      "data-state",
      "current",
    );
  });
});
