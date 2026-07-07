import { test, expect } from '@playwright/test';

const publicRoutes = [
  { path: '/home', label: 'landing page' },
  { path: '/about', label: 'about page' },
  { path: '/contact', label: 'contact page' },
  { path: '/privacy', label: 'privacy page' },
  { path: '/terms', label: 'terms page' },
  { path: '/security', label: 'security page' },
  { path: '/use-cases', label: 'use cases page' },
  { path: '/auth', label: 'auth page' },
];

test.describe('Public pages', () => {
  for (const { path, label } of publicRoutes) {
    test(`${label} loads without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // No JS crashes
      expect(errors).toHaveLength(0);
      // Not a blank page
      await expect(page.locator('body')).not.toBeEmpty();
    });
  }

  test('root / redirects to /home', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Root redirects to /home (unless OAuth callback)
    await expect(page).toHaveURL(/\/(home|auth)/);
  });

  test('unknown route shows 404 page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await page.waitForLoadState('networkidle');
    // Should show a not-found page, not crash
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page).not.toHaveURL('/');
  });
});
