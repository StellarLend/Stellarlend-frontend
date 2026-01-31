import { test, expect, type Page } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }: { page: Page }) => {
    await page.goto('/');
    
    // Check that the page loads
    await expect(page).toHaveTitle(/Stellarlend/);
    
    // Check for main navigation
    await expect(page.locator('nav')).toBeVisible();
    
    // Check for main content
    await expect(page.locator('main')).toBeVisible();
  });

  test('should have working navigation', async ({ page }: { page: Page }) => {
    await page.goto('/');
    
    // Test navigation links (adjust selectors based on your actual navigation)
    const navLinks = page.locator('nav a');
    const count = await navLinks.count();
    
    expect(count).toBeGreaterThan(0);
    
    // Test that links are clickable
    for (let i = 0; i < Math.min(count, 3); i++) {
      const link = navLinks.nth(i);
      await expect(link).toBeVisible();
    }
  });

  test('should be responsive', async ({ page }: { page: Page }) => {
    await page.goto('/');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have accessible elements', async ({ page }: { page: Page }) => {
    await page.goto('/');
    
    // Check for proper heading structure
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    
    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  });
});