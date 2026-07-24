import { test, expect } from '@playwright/test';

/**
 * End‑to‑end tests for the account deletion flow.
 *
 * The flow consists of three API interactions:
 * 1. POST /api/account/delete/challenge – returns a challenge code.
 * 2. POST /api/account/delete – expects the challenge code.
 *
 * The UI is expected to have:
 *   - A button with data-testid="delete-account-button" that opens the deletion modal.
 *   - An input with data-testid="challenge-input" for the user to enter the challenge.
 *   - A confirm button with data-testid="confirm-delete-button".
 *   - After successful deletion the page redirects to '/' and the user is logged out.
 */

// Helper to mock the challenge endpoint
function mockChallenge(route: any, challengeCode: string, expiresInMs = 60000) {
  const now = Date.now();
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      challenge: challengeCode,
      expiresAt: now + expiresInMs,
    }),
  });
}

// Helper to mock the deletion endpoint
function mockDelete(route: any, expectedChallenge: string, success = true) {
  route.request().postDataJSON().then((data) => {
    const { challenge } = data;
    const status = success && challenge === expectedChallenge ? 200 : 400;
    const body = success && challenge === expectedChallenge
      ? { message: 'Account deleted' }
      : { error: 'Invalid or expired challenge' };
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

test.describe('Account Deletion Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept the challenge request and provide a deterministic code
    await page.route('**/api/account/delete/challenge', async (route) => {
      mockChallenge(route, '123456');
    });

    // Intercept the delete request – default to success, individual tests can override
    await page.route('**/api/account/delete', async (route) => {
      mockDelete(route, '123456');
    });

    // Start from a logged‑in state – assume a helper cookie is set
    await page.context().addCookies([
      {
        name: 'auth-token',
        value: 'dummy-auth-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
    await page.goto('/settings'); // page where delete button lives
  });

  test('happy‑path deletion succeeds', async ({ page }) => {
    await page.getByTestId('delete-account-button').click();
    // UI should show the challenge code input
    await expect(page.getByTestId('challenge-input')).toBeVisible();

    // Enter the correct challenge returned by the mocked API
    await page.getByTestId('challenge-input').fill('123456');
    await page.getByTestId('confirm-delete-button').click();

    // Expect successful redirect to home and logged‑out state
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('login-button')).toBeVisible();
  });

  test('wrong challenge is rejected', async ({ page }) => {
    // Override delete route for this test to reject wrong challenge
    await page.unroute('**/api/account/delete');
    await page.route('**/api/account/delete', async (route) => {
      mockDelete(route, '123456', false);
    });

    await page.getByTestId('delete-account-button').click();
    await page.getByTestId('challenge-input').fill('000000'); // wrong code
    await page.getByTestId('confirm-delete-button').click();

    // UI should display an error message and stay on the settings page
    await expect(page.getByText(/invalid or expired challenge/i)).toBeVisible();
    await expect(page).toHaveURL('/settings');
  });

  test('expired challenge is rejected', async ({ page }) => {
    // Mock challenge that expires immediately
    await page.unroute('**/api/account/delete/challenge');
    await page.route('**/api/account/delete/challenge', async (route) => {
      mockChallenge(route, '123456', 0); // expiresAt = now
    });
    // Delete endpoint still expects the same code but will be considered expired by UI logic
    await page.unroute('**/api/account/delete');
    await page.route('**/api/account/delete', async (route) => {
      mockDelete(route, '123456', false);
    });

    await page.getByTestId('delete-account-button').click();
    await page.getByTestId('challenge-input').fill('123456');
    await page.getByTestId('confirm-delete-button').click();

    await expect(page.getByText(/invalid or expired challenge/i)).toBeVisible();
    await expect(page).toHaveURL('/settings');
  });
});
