/**
 * e2e: footer-links.spec.ts
 *
 * Asserts that every internal link rendered in the site footer resolves to a
 * non-404 response. External links (http/https) and fragment-only anchors (#…)
 * are skipped — the test focuses exclusively on internal Next.js routes.
 *
 * Run in isolation:
 *   npx playwright test footer-links --project=chromium
 */

import { test, expect } from '@playwright/test';

// All internal hrefs that appear in Footer.tsx's footerLinks object, plus the
// two inline privacy/terms links in the newsletter consent copy.
const INTERNAL_FOOTER_LINKS = [
  // Product
  '/features',
  '/pricing',
  '/security',
  // Company
  '/about',
  '/blog',
  '/careers',
  '/contact',
  // Resources
  '/docs',
  '/api-docs',
  '/audits',
  '/faq',
  // Legal
  '/terms',
  '/privacy',
  '/cookies',
  '/disclaimer',
] as const;

test.describe('Footer links — no 404s', () => {
  test('footer renders on the home page with all expected link columns', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Spot-check that at least the four column headings are present.
    for (const heading of ['Product', 'Company', 'Resources', 'Legal']) {
      await expect(footer.getByText(heading, { exact: true })).toBeVisible();
    }
  });

  // One test per route so failures are reported individually.
  for (const href of INTERNAL_FOOTER_LINKS) {
    test(`${href} returns 200 (not 404)`, async ({ page }) => {
      const response = await page.goto(href);

      // page.goto() returns null only when there is no navigation (e.g. same-
      // page anchor). All our routes produce a full navigation so this should
      // never be null.
      expect(response).not.toBeNull();

      // The page must not be a 404. Next.js also signals 404s via the status
      // code, so checking both the HTTP status and the absence of the default
      // Next.js "404 | This page could not be found" text is robust.
      expect(response!.status()).not.toBe(404);

      await expect(page.locator('body')).not.toContainText('This page could not be found');
      await expect(page.locator('body')).not.toContainText('404');
    });
  }

  test('footer internal links are reachable by clicking from the home page', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');

    // Collect all internal <a> hrefs from the footer (exclude external URLs and
    // fragment-only anchors).
    const hrefs = await footer.locator('a[href]').evaluateAll((anchors) =>
      anchors
        .map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? '')
        .filter((href) => href.startsWith('/') && !href.startsWith('//'))
    );

    // Every route in INTERNAL_FOOTER_LINKS must appear at least once.
    for (const expected of INTERNAL_FOOTER_LINKS) {
      expect(hrefs).toContain(expected);
    }
  });
});
