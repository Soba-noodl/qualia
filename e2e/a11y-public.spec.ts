import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PUBLIC_ROUTES = [
  '/home',
  '/auth',
  '/pricing',
  '/changelog',
  '/showcase',
  '/contact',
  '/privacy',
  '/terms',
] as const;

// Routes with known brand-color contrast issues that are an accepted
// design tradeoff. Exclude color-contrast there until the brand palette
// is revised. Other rules still run.
const COLOR_CONTRAST_EXCLUSIONS: Record<string, boolean> = {
  '/showcase': true, // hero gradient
};

test.describe('A11y — public routes (axe-core smoke)', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} has no serious or critical a11y violations`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const builder = new AxeBuilder({ page }).withTags([
        'wcag2a',
        'wcag2aa',
        'wcag21a',
        'wcag21aa',
      ]);

      if (COLOR_CONTRAST_EXCLUSIONS[route]) {
        builder.disableRules(['color-contrast']);
      }

      const results = await builder.analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );

      // Print non-blocking violations for visibility (moderate/minor).
      const informational = results.violations.filter(
        (v) => v.impact !== 'serious' && v.impact !== 'critical',
      );
      if (informational.length > 0) {
        console.log(`[a11y info] ${route}: ${informational.length} non-blocking violations`);
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
        throw new Error(
          `${route}: ${blocking.length} serious/critical a11y violations:\n${formatted}\n` +
          `  See https://dequeuniversity.com/rules/axe/ for fixes.`,
        );
      }

      expect(blocking).toHaveLength(0);
    });
  }
});
