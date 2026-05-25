import { test, expect } from '@playwright/test';

test.describe('Contact form (/contact)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
  });

  test('renders name, email, and message fields', async ({ page }) => {
    await expect(page.locator('#contact-name')).toBeVisible();
    await expect(page.locator('#contact-email')).toBeVisible();
    await expect(page.locator('#contact-message')).toBeVisible();
    // Submit button is present
    await expect(page.locator('form button[type="submit"]')).toBeVisible();
  });

  test('submit button is disabled while fields are empty', async ({ page }) => {
    // Component disables submit until name + email + message are all non-empty.
    const submit = page.locator('form button[type="submit"]');
    await expect(submit).toBeDisabled();

    // Filling only name + message (no email) should still leave it disabled.
    await page.locator('#contact-name').fill('Playwright Tester');
    await page.locator('#contact-message').fill('e2e test ping — please ignore');
    await expect(submit).toBeDisabled();
  });

  test('invalid email format blocks submission via native validation', async ({ page }) => {
    // The email input is type="email"; browser-native validation rejects bad formats.
    await page.locator('#contact-name').fill('Playwright Tester');
    await page.locator('#contact-email').fill('not-a-valid-email');
    await page.locator('#contact-message').fill('e2e test ping — please ignore');

    const emailInput = page.locator('#contact-email');
    // Native constraint validation API reports invalid for malformed email values.
    const isInvalid = await emailInput.evaluate(
      (el) => (el as HTMLInputElement).validity.valid === false
    );
    expect(isInvalid).toBe(true);

    // Clicking submit should NOT navigate or clear the form (form stays put due to native validation).
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('#contact-name')).toHaveValue('Playwright Tester');
    await expect(page.locator('#contact-message')).toHaveValue('e2e test ping — please ignore');
  });

  test('submits successfully with valid input and shows success toast', async ({ page }) => {
    // ONE real submission per run — sends through the live `send-contact` Edge Function.
    // Operator: messages tagged with "playwright-test@qualia-test.local" are safe to ignore.
    await page.locator('#contact-name').fill('Playwright Tester');
    await page.locator('#contact-email').fill('playwright-test@qualia-test.local');
    await page.locator('#contact-message').fill('e2e test ping — please ignore');

    const submit = page.locator('form button[type="submit"]');
    await expect(submit).toBeEnabled();
    await submit.click();

    // Success surfaces as a Sonner toast (component calls toast.success on 2xx).
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 15000 });

    // On success, the form clears its fields.
    await expect(page.locator('#contact-name')).toHaveValue('', { timeout: 10000 });
    await expect(page.locator('#contact-email')).toHaveValue('', { timeout: 10000 });
    await expect(page.locator('#contact-message')).toHaveValue('', { timeout: 10000 });
  });
});
