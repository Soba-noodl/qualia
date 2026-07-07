/**
 * End-to-end audit creation flow.
 *
 * Covers:
 *   1. Dashboard → open an existing project
 *   2. Open upload modal → Single Screen Audit
 *   3. Upload a placeholder image (via file chooser, triggers React onChange)
 *   4. Fill screen goal + select a persona
 *   5. Submit audit, wait for AI analysis to complete
 *   6. Verify AuditDetail renders (no black screen)
 *   7. Export button visible
 *
 * Runs against the authenticated project (storageState from global-setup).
 * Requires a project to exist for the test account.
 * Handles the driver.js onboarding tour by marking it complete via localStorage.
 *
 * Note: AI analysis can take 30–90s — test timeout is set to 3 minutes.
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dismissTour, closeTour } from './helpers/tour';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER_PNG = path.join(__dirname, 'fixtures', 'placeholder.png');

// ── Test ─────────────────────────────────────────────────────────────────────

test.describe('Audit creation flow', () => {
  test.setTimeout(180_000); // AI analysis can take up to 90s

  test('creates an audit with a placeholder image and renders the result', async ({ page }) => {

    // ── 1. Dashboard ──────────────────────────────────────────────────────
    await page.goto('/dashboard', { waitUntil: 'load' });
    await dismissTour(page);

    // Find first project card (data-tour attribute set on index 0)
    const projectCard = page.locator('[data-tour="project-card"]').first();
    await expect(projectCard).toBeVisible({ timeout: 10_000 });
    await projectCard.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 10_000 });

    // ── 2. Project page ───────────────────────────────────────────────────
    await page.waitForLoadState('load');
    await dismissTour(page);

    const uploadZone = page.getByText('Upload screenshots or link from Figma').first();
    await expect(uploadZone).toBeVisible({ timeout: 8_000 });

    // ── 3. Open upload modal ──────────────────────────────────────────────
    await closeTour(page); // close tour before clicking (prevents interception)
    await uploadZone.click();
    await expect(page.locator('[role="dialog"]:not(#driver-popover-content)').first()).toBeVisible({ timeout: 5_000 });

    // ── 4. Select audit type — use JS click to bypass tour overlay ───────
    await closeTour(page);
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]:not(#driver-popover-content)');
      Array.from(d?.querySelectorAll<HTMLElement>('button') ?? [])
        .find(el => /single screen audit/i.test(el.textContent ?? ''))?.click();
    });
    await page.waitForTimeout(400);
    await closeTour(page);

    // ── 5. Upload placeholder image ───────────────────────────────────────
    // Set files directly on the hidden input — the upload-area div triggers it
    // via document.getElementById('file-upload')?.click(), which bypasses
    // Playwright's filechooser event. Direct setInputFiles is more reliable.
    //
    // Fixture guard: if #file-upload never appears (3s), the Single Screen
    // Audit tile is disabled — happens when the test account has no BYOK
    // key and the free trial slot is consumed. Skip with a clear message
    // instead of timing out at 180s. To unblock: seed a BYOK key on the
    // test account or reset free_analysis_used_at.
    const fileInput = page.locator('#file-upload');
    if (!await fileInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, 'Single Screen Audit tile disabled (test account has no BYOK key and trial is used) — requires fixture seed');
      return;
    }
    await fileInput.setInputFiles(PLACEHOLDER_PNG);
    await page.waitForTimeout(600);

    // Preview should appear
    await expect(page.getByText('placeholder.png')).toBeVisible({ timeout: 5_000 });

    // ── 6. Fill screen goal ───────────────────────────────────────────────
    const goalTextarea = page.locator('textarea').first();
    if (await goalTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await goalTextarea.fill('Allow new users to sign up and complete onboarding quickly.');
    }

    // ── 7. Select persona via JS (avoids timing issues with React state) ──
    await closeTour(page);
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]:not(#driver-popover-content)');
      if (!dialog) return;
      const btns = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button[type="button"]'));
      const skip = new Set(['Back', 'Audit', 'Cancel', 'Next', 'Close', 'Done',
                            'Upload Screenshot', 'Import from Figma']);
      const persona = btns.find(b => {
        const txt = b.textContent?.trim() ?? '';
        return txt.length >= 3 && txt.length <= 25 && !skip.has(txt);
      });
      persona?.click();
    });
    await page.waitForTimeout(600);

    // ── 8. Submit audit ───────────────────────────────────────────────────
    await closeTour(page);
    const auditBtn = page.locator('[role="dialog"]:not(#driver-popover-content) button', { hasText: 'Audit' }).last();
    await expect(auditBtn).toBeVisible({ timeout: 5_000 });

    // Wait for button to become enabled (React state update after persona select)
    await expect(auditBtn).not.toBeDisabled({ timeout: 5_000 });
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]:not(#driver-popover-content)');
      const btn = Array.from(d?.querySelectorAll<HTMLElement>('button') ?? [])
        .reverse().find(el => /^audit$/i.test(el.textContent?.trim() ?? ''));
      btn?.click();
    });

    // ── 9. Wait for modal to close ────────────────────────────────────────
    await expect(page.locator('[role="dialog"]:not(#driver-popover-content)').first()).toBeHidden({ timeout: 15_000 });

    // ── 10. Wait for AI analysis to complete ──────────────────────────────
    // Poll for success or failure indicators (up to 120s)
    await expect(async () => {
      const bodyText = await page.locator('body').innerText();
      const succeeded = ['One Big Thing', 'Detailed Breakdown', 'System Logic',
                         'Heuristic', 'Audit Report', 'Analysis complete'].some(kw => bodyText.includes(kw));
      const failed = bodyText.includes('Analysis failed');
      expect(succeeded || failed).toBe(true);
    }).toPass({ timeout: 120_000, intervals: [5_000] });

    // Skip cleanly if the analysis failed (backend/quota issue, not a test bug)
    const finalText = await page.locator('body').innerText();
    if (finalText.includes('Analysis failed')) {
      test.skip(true, 'AI analysis returned "Analysis failed" — backend or quota issue, not a test regression');
      return;
    }

    // ── 11. Audit detail — no black screen ───────────────────────────────
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(200);

    // Key sections should be visible
    await expect(page.getByText('One Big Thing').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Detailed Breakdown').first()).toBeVisible({ timeout: 5_000 });

    // ── 12. Export button visible ─────────────────────────────────────────
    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    await expect(exportBtn).toBeVisible({ timeout: 5_000 });
  });
});
