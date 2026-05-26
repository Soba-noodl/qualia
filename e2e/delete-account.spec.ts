/**
 * Delete-account UI tests (authenticated).
 *
 * Verifies the Settings → Danger Zone tab and the confirmation dialog
 * opened by the destructive trigger.
 *
 * CRITICAL: this spec MUST NOT actually delete the test account. The
 * shared test account backs every other authenticated spec and the
 * storageState in `e2e/.auth/user.json`. The final
 * "Delete my account" AlertDialogAction is GUARDED by typing the literal
 * string "DELETE" into the confirm input (`deleteConfirmText !== "DELETE"`
 * in Settings.tsx#handleDeleteAccount). These tests never type that
 * sentinel and never click the confirm action — they only:
 *   - open the dialog
 *   - assert the scary copy is present
 *   - click Cancel to dismiss
 *
 * Source: src/pages/Settings.tsx (tab `value="danger"`, AlertDialog at the
 * bottom of the file). Translation keys:
 *   - dangerSection            → "Danger Zone" / "Zona pericolosa"
 *   - deleteAccount            → "Delete account" trigger button
 *   - deleteAccountConfirmTitle→ "Delete your account?"
 *   - deleteAccountConfirmDesc → "This will permanently delete your account..."
 *   - deleteAccountButton      → "Delete my account" (the GUARDED confirm)
 *   - cancel                   → "Cancel" / "Annulla"
 */
import { test, expect } from '@playwright/test';

test.describe('Delete account UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('Danger Zone tab is reachable from /settings', async ({ page }) => {
    const dangerTab = page.getByRole('tab', { name: /danger zone|zona pericolosa/i });
    await expect(dangerTab).toBeVisible({ timeout: 10_000 });

    // Click and confirm the tab activates. Settings.tsx re-renders ~300ms after
    // networkidle (lazy profile fetch); retry until the click sticks.
    await expect(async () => {
      await dangerTab.click();
      await expect(dangerTab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
    }).toPass({ timeout: 10_000, intervals: [500] });

    // Still on /settings (tab change does not navigate)
    await expect(page).toHaveURL(/\/settings/);
  });

  test('Delete-account trigger button is visible inside Danger Zone', async ({ page }) => {
    const dangerTab = page.getByRole('tab', { name: /danger zone|zona pericolosa/i });
    await expect(async () => {
      await dangerTab.click();
      await expect(dangerTab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
    }).toPass({ timeout: 10_000, intervals: [500] });

    // Trigger button uses the `deleteAccount` translation. Match both EN/IT and
    // exclude the longer "Delete my account" confirm string by anchoring.
    const trigger = page.getByRole('button', { name: /^(delete account|elimina account)$/i });
    await expect(trigger).toBeVisible({ timeout: 5_000 });
    await expect(trigger).toBeEnabled();
  });

  test('Clicking the trigger opens a confirmation dialog with the warning copy', async ({ page }) => {
    const dangerTab = page.getByRole('tab', { name: /danger zone|zona pericolosa/i });
    await expect(async () => {
      await dangerTab.click();
      await expect(dangerTab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
    }).toPass({ timeout: 10_000, intervals: [500] });

    const trigger = page.getByRole('button', { name: /^(delete account|elimina account)$/i });
    await trigger.click();

    // AlertDialog title (deleteAccountConfirmTitle): "Delete your account?" / "Eliminare il tuo account?"
    const dialogTitle = page.getByRole('alertdialog').getByText(/delete your account\?|eliminare il tuo account\?/i);
    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });

    // Description (deleteAccountConfirmDesc): contains "permanently delete" / "permanentemente"
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(/permanently delete|permanentemente/i);

    // Type DELETE confirmation placeholder is present (deleteAccountTypePlaceholder)
    const confirmInput = dialog.getByPlaceholder(/type DELETE|scrivi DELETE/i);
    await expect(confirmInput).toBeVisible();

    // The destructive confirm button exists but is DISABLED until "DELETE" is typed.
    // We assert disabled state but do NOT enable it or click it — the test account
    // must survive this run.
    const confirmButton = dialog.getByRole('button', { name: /delete my account|elimina il mio account/i });
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeDisabled();
  });

  test('Cancel button closes the dialog without deleting', async ({ page }) => {
    const dangerTab = page.getByRole('tab', { name: /danger zone|zona pericolosa/i });
    await expect(async () => {
      await dangerTab.click();
      await expect(dangerTab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
    }).toPass({ timeout: 10_000, intervals: [500] });

    const trigger = page.getByRole('button', { name: /^(delete account|elimina account)$/i });
    await trigger.click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Click Cancel — this is the AlertDialogCancel button (translation key: cancel).
    const cancelBtn = dialog.getByRole('button', { name: /^(cancel|annulla)$/i });
    await cancelBtn.click();

    // Dialog should be gone
    await expect(page.getByRole('alertdialog')).toHaveCount(0, { timeout: 5_000 });

    // Still on /settings (no navigation, no sign-out)
    await expect(page).toHaveURL(/\/settings/);

    // Account still active: sign-out button (from the header) is still visible,
    // confirming we're still authenticated. If the account had been deleted,
    // handleDeleteAccount would have called signOut() and navigated to /home.
    await expect(page.getByRole('button', { name: /sign out|log out|esci/i })).toBeVisible();
  });
});
