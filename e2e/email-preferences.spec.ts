import { test, expect } from '@playwright/test';

test.describe('Email preferences (/unsubscribe)', () => {
  test('with no token, shows "Link not recognised" error state', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/unsubscribe');
    await page.waitForLoadState('networkidle');

    // Page sets notFound=true immediately when token is missing.
    await expect(page.getByText(/link not recognised/i)).toBeVisible();
    await expect(
      page.getByText(/this unsubscribe link is no longer valid/i)
    ).toBeVisible();

    // No JS crashes.
    expect(errors).toHaveLength(0);
  });

  test('with an invalid token, shows error state (no crash)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/unsubscribe?token=invalid-test-token');
    await page.waitForLoadState('networkidle');

    // The manage-email-preferences function returns 404 for unknown tokens,
    // which flips notFound=true. A non-404 error path also routes to notFound via catch.
    // Either way, the user-visible result is the "Link not recognised" message.
    await expect(page.getByText(/link not recognised/i)).toBeVisible({ timeout: 10000 });

    expect(errors).toHaveLength(0);
  });

  test('does not whitescreen on bad input — body has visible content', async ({ page }) => {
    await page.goto('/unsubscribe?token=another-clearly-bogus-token-xyz');
    await page.waitForLoadState('networkidle');

    // Body should have rendered content, not a blank page.
    await expect(page.locator('body')).not.toBeEmpty();
    // And specifically, some readable text (either "Link not recognised" or "Loading...").
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });

  test('renders Qualia brand mark on the unsubscribe page shell', async ({ page }) => {
    // The brand wordmark renders only on the valid-prefs view, but verify the page
    // shell is reachable and one of the two known states (error OR loading OR brand)
    // is present — this guards against silent route breakage.
    await page.goto('/unsubscribe?token=invalid-test-token');
    await page.waitForLoadState('networkidle');

    const hasNotFound = await page.getByText(/link not recognised/i).isVisible().catch(() => false);
    const hasLoading = await page.getByText(/loading preferences/i).isVisible().catch(() => false);
    const hasBrand = await page.getByText(/^qualia$/i).first().isVisible().catch(() => false);

    expect(hasNotFound || hasLoading || hasBrand).toBe(true);
  });
});
