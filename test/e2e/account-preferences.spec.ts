import { test, expect } from '@playwright/test';

const DEFAULT_PREFERENCES = {
  userId: 'test-user',
  locale: 'en-US',
  displayCurrency: 'USD',
  notifications: { email: true, push: true, sms: false, inApp: true },
  updatedAt: null,
};

const VALID_LOCALES = ['en-US', 'es', 'fr', 'ja', 'zh-CN', 'ko', 'pt-BR', 'de', 'it', 'ru', 'ar'];
const VALID_CURRENCIES = ['USD', 'EUR', 'JPY', 'GBP', 'XLM', 'BTC', 'ETH', 'CNY', 'KRW', 'BRL'];

test.describe('Account Preferences E2E', () => {
  let storedPreferences: typeof DEFAULT_PREFERENCES;
  let validationErrors: Record<string, string> | null;

  test.beforeEach(async ({ page }) => {
    storedPreferences = { ...DEFAULT_PREFERENCES, updatedAt: null };
    validationErrors = null;

    await page.route('**/api/account/preferences', async (route) => {
      const request = route.request();

      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(storedPreferences),
        });
        return;
      }

      if (request.method() === 'PUT') {
        if (validationErrors) {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ errors: validationErrors }),
          });
          return;
        }

        const body = JSON.parse(request.postData() || '{}');

        const errors: Record<string, string> = {};
        if (body.locale && !VALID_LOCALES.includes(body.locale)) {
          errors.locale = `Invalid locale: ${body.locale}`;
        }
        if (body.displayCurrency && !VALID_CURRENCIES.includes(body.displayCurrency)) {
          errors.displayCurrency = `Invalid currency: ${body.displayCurrency}`;
        }

        if (Object.keys(errors).length > 0) {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ errors }),
          });
          return;
        }

        storedPreferences = {
          ...storedPreferences,
          locale: body.locale ?? storedPreferences.locale,
          displayCurrency: body.displayCurrency ?? storedPreferences.displayCurrency,
          notifications: body.notifications
            ? { ...storedPreferences.notifications, ...body.notifications }
            : storedPreferences.notifications,
          updatedAt: new Date().toISOString(),
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(storedPreferences),
        });
      }
    });

    await page.goto('/account/preferences');
  });

  test('should display default preferences on load', async ({ page }) => {
    await expect(page.getByTestId('preferences-form')).toBeVisible();

    await expect(page.getByTestId('locale-select')).toHaveValue('en-US');
    await expect(page.getByTestId('currency-select')).toHaveValue('USD');

    await expect(page.getByTestId('notification-toggle-email')).toBeChecked();
    await expect(page.getByTestId('notification-toggle-push')).toBeChecked();
    await expect(page.getByTestId('notification-toggle-sms')).not.toBeChecked();
    await expect(page.getByTestId('notification-toggle-inApp')).toBeChecked();
  });

  test('should change values, save successfully, and persist after reload', async ({ page }) => {
    await expect(page.getByTestId('preferences-form')).toBeVisible();

    await page.selectOption('[data-testid="locale-select"]', 'fr');
    await page.selectOption('[data-testid="currency-select"]', 'EUR');

    await page.getByTestId('notification-toggle-email').click();
    await page.getByTestId('notification-toggle-sms').click();

    await page.getByTestId('save-preferences-btn').click();

    await expect(page.getByText(/Preferences saved/i)).toBeVisible();

    await page.reload();

    await expect(page.getByTestId('preferences-form')).toBeVisible();
    await expect(page.getByTestId('locale-select')).toHaveValue('fr');
    await expect(page.getByTestId('currency-select')).toHaveValue('EUR');
    await expect(page.getByTestId('notification-toggle-email')).not.toBeChecked();
    await expect(page.getByTestId('notification-toggle-sms')).toBeChecked();
  });

  test('should show inline validation errors on 422 response', async ({ page }) => {
    validationErrors = {
      locale: 'Unsupported locale value',
    };

    await page.getByTestId('save-preferences-btn').click();

    await expect(page.getByTestId('locale-error')).toBeVisible();
    await expect(page.getByTestId('locale-error')).toHaveText('Unsupported locale value');
    await expect(page.getByText(/Validation failed/i)).toBeVisible();
  });

  test('should handle API failure gracefully on initial load', async ({ page }) => {
    await page.unroute('**/api/account/preferences');
    await page.route('**/api/account/preferences', async (route) => {
      await route.fulfill({ status: 500 });
    });

    await page.goto('/account/preferences');

    await expect(page.getByText(/Failed to load preferences/i)).toBeVisible();
  });
});
