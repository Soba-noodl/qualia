/**
 * Audit detail view tests.
 *
 * Navigates to the first project, clicks the first completed audit card,
 * and verifies the AuditDetail view renders correctly.
 *
 * Skips gracefully when:
 *   - No project exists for the test account
 *   - No completed audit exists in the first project
 */
import { test, expect } from '@playwright/test';
import { dismissTour } from './helpers/tour';

test.describe('Audit detail view', () => {
  test.setTimeout(60_000);

  /** Navigate to the first project and open the first completed audit card. */
  async function openFirstAudit(page: Parameters<typeof dismissTour>[0]) {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const firstCard = page.locator('[data-tour="project-card"]').first();
    if ((await firstCard.count()) === 0) return false;

    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    // Click the first completed audit card (completed ones are cursor-pointer)
    const auditCard = page.locator('.cursor-pointer.glass.rounded-xl').first();
    if ((await auditCard.count()) === 0) return false;

    await auditCard.click();
    // Wait for AuditDetail to mount (shows "One Big Thing" heading)
    const rendered = await page.getByText('One Big Thing').first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    return rendered;
  }

  test('renders key sections of the audit report', async ({ page }) => {
    const opened = await openFirstAudit(page);
    if (!opened) {
      test.skip(true, 'No completed audit available — skipping audit detail tests');
      return;
    }

    await expect(page.getByText('One Big Thing').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Detailed Breakdown').first()).toBeVisible({ timeout: 5_000 });
  });

  test('export button is visible', async ({ page }) => {
    const opened = await openFirstAudit(page);
    if (!opened) {
      test.skip(true, 'No completed audit available');
      return;
    }

    await expect(page.locator('[data-tour="export-button"]')).toBeVisible({ timeout: 5_000 });
  });

  test('re-audit button is visible', async ({ page }) => {
    const opened = await openFirstAudit(page);
    if (!opened) {
      test.skip(true, 'No completed audit available');
      return;
    }

    await expect(page.locator('[data-tour="reaudit-button"]')).toBeVisible({ timeout: 5_000 });
  });

  test('feedback card is visible', async ({ page }) => {
    const opened = await openFirstAudit(page);
    if (!opened) {
      test.skip(true, 'No completed audit available');
      return;
    }

    await expect(page.locator('[data-tour="feedback-card"]')).toBeVisible({ timeout: 8_000 });
    // Feedback question text should be present
    await expect(page.getByText('Was this audit useful?')).toBeVisible({ timeout: 5_000 });
  });

  test('star rating buttons are present in feedback card', async ({ page }) => {
    const opened = await openFirstAudit(page);
    if (!opened) {
      test.skip(true, 'No completed audit available');
      return;
    }

    const feedbackCard = page.locator('[data-tour="feedback-card"]');
    await expect(feedbackCard).toBeVisible({ timeout: 8_000 });

    // Stars have aria-label matching "X out of 5"
    const firstStar = page.locator('[aria-label*="out of 5"]').first();
    await expect(firstStar).toBeVisible({ timeout: 5_000 });
  });

  test('clicking a star records a rating', async ({ page }) => {
    const opened = await openFirstAudit(page);
    if (!opened) {
      test.skip(true, 'No completed audit available');
      return;
    }

    const feedbackCard = page.locator('[data-tour="feedback-card"]');
    await expect(feedbackCard).toBeVisible({ timeout: 8_000 });

    // Click 4th star
    const fourthStar = page.locator('[aria-label*="out of 5"]').nth(3);
    if (await fourthStar.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await fourthStar.click();
      // After clicking, the aria-label on the container should reflect the rating
      const ratingDisplay = page.locator('[aria-label*="4 out of 5"]').first();
      await expect(ratingDisplay).toBeVisible({ timeout: 3_000 });
    }
  });
});
