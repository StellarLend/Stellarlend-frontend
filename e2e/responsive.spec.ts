import { test, expect, Page } from '@playwright/test';

const VIEWPORTS: Array<{ width: number; height: number; label: string }> = [
  { width: 360, height: 800, label: '360' },
  { width: 390, height: 844, label: '390' },
  { width: 768, height: 1024, label: '768' },
];

const ROUTES = ['/', '/markets', '/docs'];

async function getHorizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const width = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    return Math.max(0, width - window.innerWidth);
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`viewport ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ROUTES) {
      test(`no horizontal overflow on ${route}`, async ({ page }) => {
        await page.goto(route, { waitUntil: 'networkidle' });
        await page.waitForLoadState('networkidle');
        const overflow = await getHorizontalOverflow(page);
        expect(overflow, `horizontal overflow on ${route} at ${viewport.width}px`).toBeLessThanOrEqual(1);
      });
    }
  });
}

test.describe('markets trade sheet', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens and closes the trade sheet from a market card', async ({ page }) => {
    await page.goto('/markets', { waitUntil: 'networkidle' });

    const tradeButtons = page.getByTestId('market-card-trade');
    await expect(tradeButtons.first()).toBeVisible();

    const scrollYbefore = await page.evaluate(() => window.scrollY);
    await tradeButtons.first().click();

    const sheet = page.getByTestId('trade-sheet');
    await expect(sheet).toBeVisible();

    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    if (box && viewport) {
      expect(box.y).toBeLessThan(viewport.height);
      expect(box.y + box.height).toBeGreaterThan(0);
    }

    const closeButton = page.getByTestId('trade-sheet-close');
    await closeButton.click();
    await expect(sheet).hidden();

    const scrollYAfter = await page.evaluate(() => window.scrollY);
    expect(Math.abs(scrollYAfter - scrollYbefore)).toBeLessThanOrEqual(2);
  });
});
