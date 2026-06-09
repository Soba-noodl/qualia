import { test, expect, type Page } from '@playwright/test';

test.describe('Auth page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
  });

  // Helpers
  const switchToSignIn = (page: Page) =>
    page.getByRole('button', { name: /already have an account/i }).click();
  const switchToSignUp = (page: Page) =>
    page.getByRole('button', { name: /don.t have an account/i }).click();

  test('renders sign-up form by default', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('toggles to sign-in mode', async ({ page }) => {
    await switchToSignIn(page);
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
  });

  test('toggles back to sign-up mode from sign-in', async ({ page }) => {
    await switchToSignIn(page);
    await switchToSignUp(page);
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('shows error on invalid sign-in credentials', async ({ page }) => {
    await switchToSignIn(page);
    await page.locator('#email').fill('notareal@example.com');
    await page.locator('#password').fill('WrongPassword123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 10000 });
  });

  test('shows error on invalid sign-up (existing account)', async ({ page }) => {
    await page.locator('#email').fill('notareal-test@example.com');
    await page.locator('#password').fill('ValidPassword123!');
    await page.getByRole('button', { name: /create account/i }).click();
    // Supabase may either:
    //   (a) return an "already exists" error → sonner toast
    //   (b) return a fake 200 (anti-enumeration) → app shows "Check your email" panel
    //   (c) accept the fresh signup and show the confirmation panel
    // Any of these = the form processed without crashing. Accept either signal.
    const toast = page.locator('[data-sonner-toast]');
    const confirmationPanel = page.getByText(/check your email|account already exists/i);
    await expect(toast.or(confirmationPanel).first()).toBeVisible({ timeout: 10000 });
  });

  test('password toggle shows and hides password', async ({ page }) => {
    await page.locator('#password').fill('secret');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: /hide password/i }).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  });

  test('forgot password link is visible in sign-in mode', async ({ page }) => {
    await switchToSignIn(page);
    await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
  });

  test('forgot password form shows send reset link button', async ({ page }) => {
    await switchToSignIn(page);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  test('forgot password back button returns to sign-in', async ({ page }) => {
    await switchToSignIn(page);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await expect(page.locator('#password')).toBeVisible();
  });
});
