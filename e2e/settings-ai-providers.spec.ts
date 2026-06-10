/**
 * Settings → AI Providers tab (BYOK) tests.
 *
 * Verifies the BYOK UI surfaces in /settings ?tab=ai-providers without
 * ever pasting a real working key. The success path is intentionally not
 * exercised; only the validation/error path is asserted.
 *
 * Source: src/components/settings/AiProvidersSettings.tsx
 *
 * Covers:
 *   1. AI Providers tab is reachable from /settings
 *   2. Each provider section (Gemini, OpenAI/GPT) is visible
 *   3. "Add key" / paste input UI is present for at least one provider
 *   4. Pasting an invalid key surfaces an inline format error
 *   5. The "best on Gemini" quality banner is visible in the tab
 *   6. Frame caps copy (Gemini 50 / GPT 35) is visible
 */
import { test, expect } from '@playwright/test';

test.describe('Settings → AI Providers (BYOK)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings?tab=ai-providers');
    await page.waitForLoadState('networkidle');
  });

  test('AI Providers tab is reachable and content renders', async ({ page }) => {
    const tab = page.getByRole('tab', { name: /ai providers|provider ia/i });
    await expect(tab).toBeVisible({ timeout: 5_000 });

    // Re-click in case the lazy profile fetch reset the active tab.
    await expect(async () => {
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
    }).toPass({ timeout: 10_000, intervals: [500] });

    // Liability banner is the first thing rendered inside the tab.
    await expect(
      page.getByText(/you're responsible for what you use|sei responsabile/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('each provider section is visible with its name', async ({ page }) => {
    // Provider names are rendered as semibold text in each ProviderCard header.
    await expect(page.getByText('Google Gemini', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('OpenAI GPT', { exact: true })).toBeVisible();
  });

  test('add-key input UI is present for at least one provider', async ({ page }) => {
    // For un-configured providers, the password input is shown by default.
    // Gemini's placeholder starts with "AIza…", OpenAI's "sk-proj-…".
    const anyKeyInput = page
      .locator('input[type="password"][placeholder^="AIza"], input[type="password"][placeholder^="sk-proj-"]')
      .first();
    await expect(anyKeyInput).toBeVisible({ timeout: 5_000 });

    // The associated Save & test button is also present.
    await expect(
      page.getByRole('button', { name: /save & test|salva e testa/i }).first(),
    ).toBeVisible();
  });

  test('pasting an invalid key surfaces an inline format error', async ({ page }) => {
    // Find the Gemini input by its known placeholder. If it's not present
    // (e.g. user already has a Gemini key on file), fall back to OpenAI's.
    const geminiInput = page.locator('input[type="password"][placeholder^="AIza"]').first();
    const openaiInput = page.locator('input[type="password"][placeholder^="sk-proj-"]').first();

    let targetInput = geminiInput;
    let expectedProviderName = /Google Gemini/i;

    if (!(await geminiInput.isVisible({ timeout: 2_000 }).catch(() => false))) {
      if (await openaiInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        targetInput = openaiInput;
        expectedProviderName = /OpenAI GPT/i;
      } else {
        test.skip(true, 'No empty BYOK input visible for invalid-key validation test');
        return;
      }
    }

    // Obviously-fake key. The product validates via a per-provider regex
    // (e.g. /^AIza[A-Za-z0-9_-]+$/ for Gemini) before ever calling the
    // backend, so this never touches a real provider endpoint.
    await targetInput.fill('not-a-real-key');

    // Click the Save & test button in the same row as our target input.
    const saveBtn = targetInput
      .locator('xpath=following-sibling::button')
      .filter({ hasText: /save & test|salva e testa/i })
      .first();
    await saveBtn.click();

    // Inline error format string is t("byokInvalidKeyFormat") =
    //   "Key format doesn't match {provider}'s expected pattern" (en)
    //   "Il formato della chiave non corrisponde al pattern atteso di {provider}" (it)
    const errorMsg = page.getByText(/key format doesn't match|formato della chiave non corrisponde/i).first();
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });
    await expect(errorMsg).toContainText(expectedProviderName);
  });

  test('quality banner ("best on Gemini") is visible', async ({ page }) => {
    await expect(
      page.getByText(/best results on gemini|risultati migliori con gemini/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('frame caps copy is visible (50 Gemini / 35 GPT)', async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/50 frames? on gemini.*35 on gpt|50 frame su gemini.*35 su gpt/i);
  });
});
