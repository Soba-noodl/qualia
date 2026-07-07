/**
 * Settings → Privacy tab (cookie / PostHog consent) tests.
 *
 * Verifies the visible state machine of the consent controls in
 * /settings ?tab=privacy without asserting on localStorage directly.
 *
 * Source:
 *   - src/pages/Settings.tsx (Privacy TabsContent, lines 761-801)
 *   - src/lib/posthog.ts (acceptCookies / declineCookies / resetCookieBanner)
 *
 * State machine (visible only):
 *   consent === 'true'  → "Withdraw cookie consent" + "Reset cookie banner"
 *   consent === 'false' → "Allow analytics cookies" + "Reset cookie banner"
 *   consent === null    → "Allow analytics cookies" (no Reset button)
 *
 * Covers:
 *   1. Privacy tab is reachable and content renders
 *   2. Consent state controls (accept / revoke / reset) are visible
 *   3. Clicking revoke flips the visible button text and description copy
 *   4. After revoke, clicking reset removes the Reset button (saved choice cleared)
 */
import { test, expect } from '@playwright/test';

// Locator helpers tied to the i18n strings shipped in
// src/utils/translations/settings.ts (en + it).
const cookieConsentLabel = (page: import('@playwright/test').Page) =>
  page.getByText(/analytics cookies|cookie analitici/i).first();

const withdrawBtn = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /withdraw cookie consent|revoca consenso cookie/i });

const allowBtn = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /allow analytics cookies|consenti cookie analitici/i });

const resetBtn = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /reset cookie banner|resetta il banner cookie/i });

const manageLink = (page: import('@playwright/test').Page) =>
  page.getByRole('link', { name: /cookie preferences|preferenze cookie/i });

async function gotoPrivacyTab(page: import('@playwright/test').Page) {
  await page.goto('/settings?tab=privacy');
  await page.waitForLoadState('networkidle');

  // Settings re-renders ~300ms after networkidle (lazy profile fetch). Mirror
  // the pattern used in e2e/settings.spec.ts for Team-tab interactions.
  const tab = page.getByRole('tab', { name: /^privacy$/i });
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 10_000, intervals: [500] });
}

async function ensureConsentAccepted(page: import('@playwright/test').Page) {
  // Seed deterministic state regardless of what storageState had cached.
  // Done in the page context so it lands in the right origin's localStorage.
  await page.evaluate(() => {
    localStorage.setItem('cookie-consent', 'true');
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  const tab = page.getByRole('tab', { name: /^privacy$/i });
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 10_000, intervals: [500] });
}

test.describe('Settings → Privacy (cookie consent)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPrivacyTab(page);
  });

  test('Privacy tab is reachable and content renders', async ({ page }) => {
    await expect(cookieConsentLabel(page)).toBeVisible({ timeout: 5_000 });

    // The cookie preferences link to /cookies is always rendered, regardless
    // of consent state — a good stability anchor for "content rendered".
    await expect(manageLink(page)).toBeVisible();
  });

  test('consent state controls are visible (allow or revoke + reset)', async ({ page }) => {
    // At least one of {Withdraw, Allow} must be visible. Reset may be present
    // depending on whether a saved decision exists in storageState.
    const anyToggle = withdrawBtn(page).or(allowBtn(page));
    await expect(anyToggle.first()).toBeVisible({ timeout: 5_000 });
  });

  test('clicking revoke flips the visible state', async ({ page }) => {
    await ensureConsentAccepted(page);

    // Pre-condition: Withdraw button is visible, Allow button is not.
    await expect(withdrawBtn(page)).toBeVisible({ timeout: 5_000 });
    await expect(allowBtn(page)).toHaveCount(0);

    await withdrawBtn(page).click();

    // Post-condition: Allow button replaces Withdraw, and the description
    // copy switches to t("cookieConsentNotGranted").
    await expect(allowBtn(page)).toBeVisible({ timeout: 5_000 });
    await expect(withdrawBtn(page)).toHaveCount(0);
    await expect(
      page.getByText(/analytics cookies are currently disabled|cookie analitici sono attualmente disattivati/i),
    ).toBeVisible();
  });

  test('after revoke, clicking reset clears the saved choice (Reset button hides)', async ({ page }) => {
    await ensureConsentAccepted(page);

    // Revoke first → leaves saved choice as 'false', so Reset stays visible.
    await withdrawBtn(page).click();
    await expect(allowBtn(page)).toBeVisible({ timeout: 5_000 });
    await expect(resetBtn(page)).toBeVisible();

    // resetCookieBanner() removes 'cookie-consent' from localStorage. The
    // component then re-renders without the Reset button because the
    // condition (hasCookieConsent || cookie-consent === 'false') becomes false.
    await resetBtn(page).click();

    // The "Allow" button is still visible (no decision = not granted),
    // but the Reset button must disappear — that's the visible state change.
    await expect(allowBtn(page)).toBeVisible({ timeout: 5_000 });
    await expect(resetBtn(page)).toHaveCount(0);
  });
});
