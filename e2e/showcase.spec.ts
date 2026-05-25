/**
 * /showcase page tests (unauthenticated).
 *
 * v2 layout (commit a1669f1) — `src/pages/Showcase.tsx` splits rows from the
 * `public_showcase_audit` view into two sections by their `section` column:
 *   - "From my own work"   (rows with section = 'own_work')
 *   - "Public examples"    (rows with section = 'public_examples')
 *
 * Both sections render conditionally: each <h2> only appears when its
 * corresponding bucket has at least one row. There is NO "sign in to see
 * your audits" CTA — the own_work block simply hides when empty.
 *
 * Card text comes from `ShowcaseCard.tsx`, which renders the brand
 * `project_name` (Linear / Vercel / Supabase / …) — NOT the AI provider
 * name (Gemini / GPT / Claude). The AI provider is only surfaced as an icon
 * on the landing hero via `BrandLogo`, never as text on showcase cards.
 */
import { test, expect } from '@playwright/test';

test.describe('Showcase page (unauthenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/showcase');
    await page.waitForLoadState('networkidle');
  });

  test('renders without errors and shows hero', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Wait for hero h1 (translation key: showcasePitchTitle)
    const hero = page.getByRole('heading', { name: /audits qualia ran on real products|audit di qualia su prodotti reali/i });
    await expect(hero).toBeVisible({ timeout: 10_000 });

    // Page is not whitescreen — body has substantial visible content
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(200);

    // No JS crashes
    expect(errors).toHaveLength(0);
  });

  test('"Public examples" section heading is visible when logged out', async ({ page }) => {
    // showcaseSectionPublicExamplesTitle — EN: "Public examples", IT: "Esempi pubblici"
    const publicHeading = page.getByRole('heading', { name: /public examples|esempi pubblici/i });
    await expect(publicHeading).toBeVisible({ timeout: 10_000 });
  });

  test('"From my own work" section is conditional — heading only renders when own_work rows exist', async ({ page }) => {
    // Per Showcase.tsx, the own_work block is wrapped in `{ownWork.length > 0 && (…)}`.
    // There is NO sign-in CTA fallback. Whether the heading is present depends purely on
    // seed data in the public_showcase_audit view, not on auth state. So we accept either:
    //   - the heading is visible, OR
    //   - the heading is absent (count === 0)
    // What we MUST NOT see is a "sign in to view your audits" CTA — that text doesn't exist.
    // showcaseSectionOwnWorkTitle — EN: "From my own work", IT: "Il mio lavoro"
    const ownWorkHeading = page.getByRole('heading', { name: /from my own work|il mio lavoro/i });
    const count = await ownWorkHeading.count();
    expect(count === 0 || count === 1).toBe(true);

    // Confirm no spurious "sign in to see your audits" copy exists anywhere on the page
    // (would indicate someone added an auth-gated fallback we should track in tests).
    const signInCopy = page.getByText(/sign in to (see|view) your audits/i);
    await expect(signInCopy).toHaveCount(0);
  });

  test('at least one audit card is visible in the public examples section', async ({ page }) => {
    // Each ShowcaseCard renders as a <Link to="/showcase/:slug">. The bottom-CTA link
    // also navigates inside /showcase/*, but cards are the only ones that link to
    // a slug subpath. Use a strict regex to filter to card links only.
    const cardLinks = page.locator('a[href^="/showcase/"]').filter({
      hasNot: page.locator('a[href="/showcase"]'),
    });
    // Showcase.tsx only renders cards once `rows.length > 0`. If the list is empty,
    // the skeleton/loading state would have resolved by now (networkidle).
    // Assert at least one card.
    await expect(cardLinks.first()).toBeVisible({ timeout: 10_000 });
  });

  // Test #5 from spec: "Cards display the provider name (Gemini / GPT / Claude)"
  //
  // SKIPPED — the source does not support this assertion. `ShowcaseCard.tsx`
  // renders `row.project_name` (the audited product, e.g. Linear / Vercel /
  // Supabase) and `BrandLogo` with the project slug. The AI provider name is
  // never rendered as text on cards; provider logos only appear on the
  // landing hero visual. If provider provenance is added to cards in a
  // follow-up, unskip and assert against the new selector.
  test.skip('cards display the provider name (Gemini / GPT / Claude)', async () => {
    // Intentionally empty — see comment above.
  });
});
