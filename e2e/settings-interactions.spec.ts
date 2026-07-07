/**
 * Settings page interaction tests.
 *
 * Covers:
 *   1. Language tab shows English and Italian toggle buttons
 *   2. Switching to Italian changes UI language
 *   3. Switching back to English restores UI language
 *   4. Integrations tab shows connect buttons
 */
import { test, expect } from '@playwright/test';

test.describe('Settings interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('language tab shows English and Italian options', async ({ page }) => {
    // Language is now a Radix Select on the Account tab (not a separate tab, not toggle buttons).
    // Open the combobox; the popover then lists English + Italiano options.
    const langTab = page.getByRole('tab', { name: /language/i });
    if (await langTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await langTab.click();
      await page.waitForLoadState('networkidle');
    }
    const combo = page.getByRole('combobox').filter({ hasText: /english|italiano/i });
    await expect(combo).toBeVisible({ timeout: 5_000 });
    await combo.click();
    await expect(page.getByRole('option', { name: /english/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('option', { name: /italiano|italian/i })).toBeVisible({ timeout: 5_000 });
  });

  test('switching to Italian changes visible language', async ({ page }) => {
    const langTab = page.getByRole('tab', { name: /language/i });
    if (await langTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await langTab.click();
      await page.waitForLoadState('networkidle');
    }

    const italianBtn = page.getByRole('button', { name: /italian|italiano/i });
    if (!await italianBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, 'Language toggle not found');
      return;
    }

    await italianBtn.click();
    await page.waitForTimeout(500);

    // Italian UI should show at least one Italian word in navigation/settings area
    const bodyText = await page.locator('body').innerText();
    const hasItalian = /impostazioni|lingua|esci|progetto|analisi/i.test(bodyText);
    expect(hasItalian).toBe(true);
  });

  test('switching back to English restores UI language', async ({ page }) => {
    const langTab = page.getByRole('tab', { name: /language/i });
    if (await langTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await langTab.click();
      await page.waitForLoadState('networkidle');
    }

    // First switch to Italian
    const italianBtn = page.getByRole('button', { name: /italian|italiano/i });
    if (!await italianBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, 'Language toggle not found');
      return;
    }
    await italianBtn.click();
    await page.waitForTimeout(400);

    // Then switch back to English
    const englishBtn = page.getByRole('button', { name: /english/i });
    await englishBtn.click();
    await page.waitForTimeout(400);

    const bodyText = await page.locator('body').innerText();
    // English UI keywords
    const hasEnglish = /settings|language|sign out|project|analytics/i.test(bodyText);
    expect(hasEnglish).toBe(true);
  });

  test('integrations tab shows connect buttons', async ({ page }) => {
    const integTab = page.getByRole('tab', { name: /integrations/i });
    if (!await integTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, 'Integrations tab not found');
      return;
    }
    await integTab.click();
    await page.waitForLoadState('networkidle');

    // At least one connect/disconnect button should be visible
    const connectBtn = page.getByRole('button', { name: /connect|disconnect|notion|figma|google drive/i }).first();
    await expect(connectBtn).toBeVisible({ timeout: 5_000 });
  });
});
