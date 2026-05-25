import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { dismissTour } from './helpers/tour';

// Issue-severity chips are intentionally color-coded; document as exclusion.
const COLOR_CONTRAST_EXCLUSIONS: Record<string, boolean> = {
  '/audit/:id': true,
};

async function assertNoBlockingViolations(page: Page, label: string, excludeContrast = false) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (excludeContrast) builder.disableRules(['color-contrast']);
  const results = await builder.analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const informational = results.violations.filter(
    (v) => v.impact !== 'serious' && v.impact !== 'critical',
  );
  if (informational.length > 0) {
    console.log(`[a11y info] ${label}: ${informational.length} non-blocking violations`);
    for (const v of informational) {
      console.log(`  - ${v.id} (${v.impact}): ${v.help}`);
    }
  }
  if (blocking.length > 0) {
    const formatted = blocking
      .map((v) => {
        const nodes = v.nodes
          .slice(0, 3)
          .map((n) => `      ${n.target.join(' > ')}`)
          .join('\n');
        return `  - ${v.id} (${v.impact}) — ${v.help}\n${nodes}`;
      })
      .join('\n');
    throw new Error(`${label}: ${blocking.length} serious/critical a11y violations:\n${formatted}`);
  }
  expect(blocking).toHaveLength(0);
}

test.describe('A11y — authenticated routes (axe-core smoke)', () => {
  test('/dashboard has no serious or critical a11y violations', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await assertNoBlockingViolations(page, '/dashboard');
  });

  test('/settings has no serious or critical a11y violations', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await assertNoBlockingViolations(page, '/settings');
  });

  test('/project/:id has no serious or critical a11y violations', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    const card = page.locator('[data-tour="project-card"]').first();
    if (!await card.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'No project on test account to navigate to');
      return;
    }
    await card.click();
    await page.waitForLoadState('networkidle');
    await assertNoBlockingViolations(page, '/project/:id');
  });

  test('/audit/:id has no serious or critical a11y violations', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    const card = page.locator('[data-tour="project-card"]').first();
    if (!await card.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'No project on test account to navigate to');
      return;
    }
    await card.click();
    await page.waitForLoadState('networkidle');
    const auditLink = page.locator('a[href^="/audit/"]').first();
    if (!await auditLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'No audit on test account to navigate to');
      return;
    }
    await auditLink.click();
    await page.waitForLoadState('networkidle');
    await assertNoBlockingViolations(page, '/audit/:id', COLOR_CONTRAST_EXCLUSIONS['/audit/:id']);
  });
});
