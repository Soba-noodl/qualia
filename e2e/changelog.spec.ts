import { test, expect } from '@playwright/test';

test.describe('Changelog page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/changelog');
    await page.waitForLoadState('networkidle');
  });

  test('loads without JS errors and renders the latest entry title', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Latest entry title (May 24, 2026 — currently v10.0 BYOK release)
    await expect(
      page.getByText('Bring Your Own Key, complete privacy overhaul').first()
    ).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test('desktop sidebar nav lists month sections', async ({ page }) => {
    // Sidebar <aside> contains a <nav> with anchor links to each month section.
    // It's hidden on small screens via lg:hidden on the mobile nav; the aside
    // itself is rendered at all viewports — only its sticky positioning is lg+.
    const sidebar = page.locator('aside nav');
    await expect(sidebar).toBeVisible();

    // At least one month label should be present as an anchor link
    const monthLink = sidebar.locator('a[href^="#"]').first();
    await expect(monthLink).toBeVisible();
    await expect(monthLink).toHaveText(/\w+ \d{4}/);
  });

  test('mobile jump-nav select is present with month options', async ({ page }) => {
    const select = page.locator('#changelog-nav-select');
    await expect(select).toHaveCount(1);

    // First real option (skipping the disabled placeholder) should target a month section id
    const optionValues = await select.locator('option').evaluateAll((els) =>
      (els as HTMLOptionElement[]).map((el) => el.value).filter((v) => v.length > 0)
    );
    expect(optionValues.length).toBeGreaterThan(0);
    expect(optionValues[0]).toMatch(/^[a-z]+-\d{4}$/);
  });

  test('shows an "Updated:" label followed by a date', async ({ page }) => {
    // The header renders: "{Updated}: {date}" — e.g. "Updated: May 24, 2026"
    await expect(page.getByText(/Updated:\s*\w+\s+\d{1,2},\s*\d{4}/)).toBeVisible();
  });
});
