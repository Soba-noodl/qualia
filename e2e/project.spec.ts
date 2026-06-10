import { test, expect } from '@playwright/test';
import { dismissTour } from './helpers/tour';

test.describe('Project page', () => {
  let projectUrl: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const firstCard = page.locator('[data-tour="project-card"]').first();
    const hasProject = (await firstCard.count()) > 0;

    if (!hasProject) {
      test.skip();
      return;
    }

    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/project\//);
    projectUrl = page.url();

    await dismissTour(page);
  });

  test('shows project page with upload zone', async ({ page }) => {
    await expect(page.getByText(/upload screenshots/i)).toBeVisible();
  });

  test('shows project context card', async ({ page }) => {
    await expect(page.getByText(/project context/i)).toBeVisible();
  });

  test('upload zone opens modal', async ({ page }) => {
    await page.getByText(/upload screenshots/i).click();
    await expect(page.locator('[role="dialog"]:not(#driver-popover-content)').first()).toBeVisible();
  });

  test('upload modal shows audit type options', async ({ page }) => {
    await page.getByText(/upload screenshots/i).click();
    await expect(page.locator('[role="dialog"]:not(#driver-popover-content)').first()).toBeVisible();
    await expect(page.getByText(/single screen/i).first()).toBeVisible();
  });

  test('upload modal shows Flow Analysis option', async ({ page }) => {
    await page.getByText(/upload screenshots/i).click();
    await expect(page.locator('[role="dialog"]:not(#driver-popover-content)').first()).toBeVisible();
    await expect(page.getByText(/flow analysis/i).first()).toBeVisible();
  });

  test('upload modal shows Prototype Audit option', async ({ page }) => {
    await page.getByText(/upload screenshots/i).click();
    await expect(page.locator('[role="dialog"]:not(#driver-popover-content)').first()).toBeVisible();
    await expect(page.getByText(/prototype audit/i).first()).toBeVisible();
  });

  test('prototype crawl URL form rejects non-Figma URLs', async ({ page }) => {
    await page.getByText(/upload screenshots/i).click();
    const dialog = page.locator('[role="dialog"]:not(#driver-popover-content)').first();
    await expect(dialog).toBeVisible();

    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]:not(#driver-popover-content)');
      Array.from(d?.querySelectorAll<HTMLElement>('button') ?? [])
        .find(el => /prototype audit/i.test(el.textContent ?? ''))?.click();
    });
    const urlInput = dialog.locator('input[type="url"], input[type="text"]').first();
    if (!await urlInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, 'URL input not found in Prototype Crawl step');
      return;
    }
    await urlInput.fill('https://example.com/not-figma');
    await urlInput.press('Tab');
    await expect(dialog.getByText(/valid figma url/i)).toBeVisible({ timeout: 3_000 });
  });

  test('back button returns to dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /go back|back/i }).or(page.locator('[aria-label="Go back"]')).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
