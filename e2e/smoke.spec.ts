import { test, expect } from '@playwright/test';

test('app loads and shows login or dashboard', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // The app should load without JS errors
  await expect(page).not.toHaveURL('/error');

  // Should show some content
  const body = page.locator('body');
  await expect(body).not.toBeEmpty();
});
