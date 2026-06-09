/**
 * Analytics page tests.
 *
 * Covers:
 *   1. Page renders metric cards (big numbers grid)
 *   2. Charts section is visible
 *   3. Score by project card is present
 *   4. Recent audits card is present
 *   5. Navigation back to dashboard works
 */
import { test, expect } from '@playwright/test';
import { dismissTour } from './helpers/tour';

test.describe('Analytics page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
  });

  test('renders the analytics page', async ({ page }) => {
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('metric cards grid is visible', async ({ page }) => {
    await expect(page.locator('[data-tour="analytics-big-numbers"]')).toBeVisible({ timeout: 8_000 });
  });

  test('charts section is visible', async ({ page }) => {
    await expect(page.locator('[data-tour="analytics-charts"]')).toBeVisible({ timeout: 8_000 });
  });

  test('score by project card is visible', async ({ page }) => {
    await expect(page.locator('[data-tour="analytics-score-by-project"]')).toBeVisible({ timeout: 8_000 });
  });

  test('recent audits card is visible', async ({ page }) => {
    await expect(page.locator('[data-tour="analytics-recent-audits"]')).toBeVisible({ timeout: 8_000 });
  });

  test('navigates back to dashboard', async ({ page }) => {
    // Use JS click to bypass driver.js tour overlay
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>('[aria-label="Go back"]') ??
        Array.from(document.querySelectorAll<HTMLElement>('button'))
          .find(b => /go back|back/i.test(b.textContent ?? ''));
      btn?.click();
    });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
