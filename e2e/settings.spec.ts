import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('shows settings page when authenticated', async ({ page }) => {
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('displays user email', async ({ page }) => {
    // Email should be shown (read-only)
    const email = process.env.E2E_TEST_EMAIL;
    if (email) {
      await expect(page.getByText(email)).toBeVisible();
    } else {
      // Just check some email-like text is present
      await expect(page.locator('body')).toContainText('@');
    }
  });

  test('shows integration section', async ({ page }) => {
    await page.getByRole('tab', { name: 'Integrations' }).click();
    await page.waitForLoadState('networkidle');
    // At least one integration option should be visible
    await expect(page.getByRole('button', { name: /notion|figma|google drive/i }).first()).toBeVisible();
  });

  test('shows language toggle inside Account tab', async ({ page }) => {
    // Language was moved from its own tab into the Account tab (teams v1 restructure).
    // The language picker is now a Radix Select (combobox) whose displayed value is
    // the current language label ("English" or "Italiano"), not a toggle of buttons.
    const langTab = page.getByRole('tab', { name: /^language$/i });
    if (await langTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await langTab.click();
      await page.waitForLoadState('networkidle');
    }
    await expect(page.getByRole('combobox').filter({ hasText: /english|italiano/i })).toBeVisible({ timeout: 5_000 });
  });

  test('shows Team tab', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /^team$/i })).toBeVisible();
  });

  test('Team tab shows create-team or manage-team UI', async ({ page }) => {
    // The Settings page re-renders ~300ms after networkidle (lazy profile fetch).
    // Keep clicking Team until it stays selected, then assert content.
    await expect(async () => {
      await page.getByRole('tab', { name: /^team$/i }).click();
      await expect(page.getByRole('tab', { name: /^team$/i })).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
    }).toPass({ timeout: 10_000, intervals: [500] });

    await expect(page.getByText('You don\'t have a team yet').or(page.getByText(/team name/i))).toBeVisible({ timeout: 8_000 });
  });

  test('shows sign out button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign out|log out/i })).toBeVisible();
  });

  test('sign out redirects to /auth', async ({ page }) => {
    await page.getByRole('button', { name: /sign out|log out/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/(auth|home)/);
  });
});
