import { test, expect } from '@playwright/test';

const protectedRoutes = ['/dashboard', '/analytics', '/settings'];

test.describe('Protected routes', () => {
  for (const route of protectedRoutes) {
    test(`${route} redirects unauthenticated users to /auth`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/auth/);
    });
  }

  test('/project/:id redirects unauthenticated users to /auth', async ({ page }) => {
    await page.goto('/project/some-fake-id');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/auth/);
  });
});
