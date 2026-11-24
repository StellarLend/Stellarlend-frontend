import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
  { path: '/', name: 'Home' },
  { path: '/markets', name: 'Markets' },
  { path: '/docs', name: 'Docs' },
];

for (const { path, name } of routes) {
  test(`${name} page (${path}) should have no serious or critical accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    const seriousOrCriticalViolations = accessibilityScanResults.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical'
    );

    expect(seriousOrCriticalViolations).toEqual([]);
  });
}

test('Markets page (/markets) should have no serious or critical accessibility violations at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/markets');
  await page.waitForLoadState('domcontentloaded');

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

  const seriousOrCriticalViolations = accessibilityScanResults.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical'
  );

  expect(seriousOrCriticalViolations).toEqual([]);
});
