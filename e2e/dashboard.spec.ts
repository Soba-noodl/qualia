import { test, expect } from '@playwright/test';
import { dismissTour } from './helpers/tour';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
  });

  test('shows dashboard page when authenticated', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    // New project button should be visible
    await expect(page.locator('[data-tour="create-project"]')).toBeVisible();
  });

  test('opens new project dialog', async ({ page }) => {
    await page.locator('[data-tour="create-project"]').click();
    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('new project dialog has scope options', async ({ page }) => {
    await page.locator('[data-tour="create-project"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Should show scope options
    await expect(page.getByText(/whole product/i).first()).toBeVisible();
  });

  test('settings button navigates to /settings', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).or(page.locator('[aria-label="settings"]')).click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('analytics button navigates to /analytics', async ({ page }) => {
    await page.locator('[data-tour="statistics"]').or(page.getByRole('link', { name: /analytics/i })).first().click();
    await expect(page).toHaveURL(/\/analytics/);
  });

  test('project cards are clickable', async ({ page }) => {
    const firstCard = page.locator('[data-tour="project-card"]').first();
    const cardCount = await firstCard.count();
    if (cardCount === 0) {
      test.skip();
      return;
    }
    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/project\//);
  });
});
