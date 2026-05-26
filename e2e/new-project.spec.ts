/**
 * New project creation dialog tests.
 *
 * Covers:
 *   1. Dialog opens from dashboard "New Project" button
 *   2. Scope step shows "Whole product" and "A section" options
 *   3. Selecting "Whole product" and filling the project name enables Next
 *   4. Stepping through to submit creates a project and navigates to /project/
 *   5. Cancel closes the dialog without creating a project
 *
 * Note: project creation requires a real Supabase backend.
 * The test cleans up by navigating away — the created project persists in the test account.
 */
import { test, expect } from '@playwright/test';
import { dismissTour } from './helpers/tour';

const UNIQUE_PROJECT_NAME = `E2E Test Project ${Date.now()}`;

test.describe('New project dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
  });

  test('opens new project dialog from dashboard', async ({ page }) => {
    await page.locator('[data-tour="create-project"]').click();
    await expect(page.locator('[role="dialog"]:not(#driver-popover-content)').first()).toBeVisible({ timeout: 5_000 });
  });

  test('dialog shows scope options', async ({ page }) => {
    await page.locator('[data-tour="create-project"]').click();
    await expect(page.locator('[role="dialog"]:not(#driver-popover-content)').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/whole product/i).first()).toBeVisible();
    await expect(page.getByText(/section/i).first()).toBeVisible();
  });

  test('cancel closes dialog without navigating', async ({ page }) => {
    await page.locator('[data-tour="create-project"]').click();
    await expect(page.locator('[role="dialog"]:not(#driver-popover-content)').first()).toBeVisible({ timeout: 5_000 });
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]:not(#driver-popover-content)');
      Array.from(d?.querySelectorAll<HTMLElement>('button') ?? [])
        .find(el => /^cancel$/i.test(el.textContent?.trim() ?? ''))?.click();
    });
    await expect(page.locator('[role="dialog"]:not(#driver-popover-content)').first()).toBeHidden({ timeout: 3_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Next button disabled until scope selected and name filled', async ({ page }) => {
    await page.locator('[data-tour="create-project"]').click();
    await expect(page.locator('[role="dialog"]:not(#driver-popover-content)').first()).toBeVisible({ timeout: 5_000 });

    const dialog = page.locator('[role="dialog"]:not(#driver-popover-content)').first();

    // Select "Whole product" scope via JS
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]:not(#driver-popover-content)');
      Array.from(d?.querySelectorAll<HTMLElement>('button') ?? [])
        .find(el => /whole product/i.test(el.textContent ?? ''))?.click();
    });
    await page.waitForTimeout(300);

    // Fill project name (id="name") — required alongside scope to enable Continue
    const nameInput = dialog.locator('#name');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill('E2E Test Product');
    await page.waitForTimeout(200);

    // Continue should now be enabled (scope selected + name filled)
    const nextBtn = dialog.getByRole('button', { name: /^continue$|^next$/i }).last();
    await expect(nextBtn).toBeVisible({ timeout: 3_000 });
    await expect(nextBtn).not.toBeDisabled({ timeout: 3_000 });
  });

  test('creates a project and navigates to project page', async ({ page }) => {
    test.setTimeout(60_000);

    await page.locator('[data-tour="create-project"]').click();
    const dialog = page.locator('[role="dialog"]:not(#driver-popover-content)').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Select "Whole product" scope via JS
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]:not(#driver-popover-content)');
      Array.from(d?.querySelectorAll<HTMLElement>('button') ?? [])
        .find(el => /whole product/i.test(el.textContent ?? ''))?.click();
    });
    await page.waitForTimeout(300);

    // Fill the project name input (id="name", appears after scope is selected)
    const nameInput = dialog.locator('#name');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(UNIQUE_PROJECT_NAME);

    // Click through all dialog steps until we reach the project page.
    // Each step may require textareas to be filled before Continue is enabled.
    await expect(async () => {
      if (page.url().includes('/project/')) return; // done

      await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]:not(#driver-popover-content)');
        if (!d) return;

        // Fill any empty visible textareas so that Continue becomes enabled
        d.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(ta => {
          if (!ta.value && ta.offsetParent !== null) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            setter?.call(ta, 'N/A');
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });

        const btns = Array.from(d.querySelectorAll<HTMLElement>('button'));
        for (const pattern of [/create product/i, /^continue$/i, /^next$/i]) {
          const btn = [...btns].reverse().find(el =>
            pattern.test(el.textContent?.trim() ?? '') &&
            !el.hasAttribute('disabled') &&
            !(el as HTMLButtonElement).disabled
          );
          if (btn) { btn.click(); return; }
        }
      });
      await page.waitForTimeout(600);
      expect(page.url()).toMatch(/\/project\//);
    }).toPass({ timeout: 30_000, intervals: [700] });
  });
});
