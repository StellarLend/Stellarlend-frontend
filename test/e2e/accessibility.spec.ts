/**
 * Accessibility integration tests for the account pages using @axe-core/playwright.
 *
 * These tests ensure that the account pages (/account/profile and /account/notifications)
 * meet WCAG 2.0/2.1 Level A and AA accessibility requirements by running an automated
 * axe-core scan on each page.
 *
 * Related issue: #642
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Mock authentication cookies so account pages can load without a real auth session.
 */
async function setupAuthCookie(page: import('@playwright/test').Page) {
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
}

test.describe('Account Pages – axe-core Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Stub any API calls that account pages make so we get a fully rendered UI
    // even when the dev server has no real backend.
    await page.route('**/api/account/preferences', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'test-user',
          locale: 'en-US',
          displayCurrency: 'USD',
          notifications: { email: true, push: true, sms: false, inApp: true },
          updatedAt: null,
        }),
      })
    );

    await page.route('**/api/account/profile', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: '2024-01-01T00:00:00.000Z',
        }),
      })
    );

    await setupAuthCookie(page);
  });

  test('/account/profile – should have no automatically detectable WCAG 2.1 AA accessibility violations', async ({
    page,
  }) => {
    await page.goto('/account/profile');

    // Wait for meaningful content to render before scanning.
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Attach violation details to the test report for easier debugging.
    if (results.violations.length > 0) {
      const summary = results.violations
        .map(
          (v) =>
            `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
            v.nodes
              .map((n) => `  → ${n.target.join(', ')}`)
              .join('\n')
        )
        .join('\n\n');
      // Log violations so they appear in the test output.
      console.error('Accessibility violations on /account/profile:\n', summary);
    }

    expect(results.violations).toEqual([]);
  });

  test('/account/notifications – should have no automatically detectable WCAG 2.1 AA accessibility violations', async ({
    page,
  }) => {
    await page.goto('/account/notifications');

    // Wait for meaningful content to render before scanning.
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Attach violation details to the test report for easier debugging.
    if (results.violations.length > 0) {
      const summary = results.violations
        .map(
          (v) =>
            `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
            v.nodes
              .map((n) => `  → ${n.target.join(', ')}`)
              .join('\n')
        )
        .join('\n\n');
      console.error('Accessibility violations on /account/notifications:\n', summary);
    }

    expect(results.violations).toEqual([]);
  });
});
