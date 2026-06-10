/**
 * Global setup: logs in once and saves auth state to e2e/.auth/user.json.
 * Tests that need auth use `storageState: 'e2e/.auth/user.json'` in their project config.
 *
 * Requires environment variables (or .env.e2e file):
 *   E2E_TEST_EMAIL    — test account email
 *   E2E_TEST_PASSWORD — test account password
 *
 * If credentials are absent, setup is skipped and authenticated tests will be skipped.
 * Tries sign-in first; if that fails, falls back to sign-up (account creation).
 */
import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.e2e if present (never committed — for local test credentials)
const envFile = path.resolve(__dirname, '../.env.e2e');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

export default async function globalSetup(_config: FullConfig) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    console.log('[global-setup] E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — skipping auth setup.');
    return;
  }

  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:8080/auth');
  await page.waitForLoadState('networkidle');

  // Dismiss cookie banner if present
  const acceptBtn = page.getByRole('button', { name: 'Accept' });
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForTimeout(300);
  }

  // Try sign-in first
  await page.getByRole('button', { name: /already have an account/i }).click();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // Check if sign-in succeeded within 5s; if not, fall back to sign-up
  const signedIn = await page.waitForURL(/\/dashboard/, { timeout: 5000 }).then(() => true).catch(() => false);

  if (!signedIn) {
    console.log('[global-setup] Sign-in failed — trying sign-up (new account)...');
    await page.goto('http://localhost:8080/auth');
    await page.waitForLoadState('networkidle');

    const acceptBtn2 = page.getByRole('button', { name: 'Accept' });
    if (await acceptBtn2.isVisible()) await acceptBtn2.click();

    // Page starts in sign-up mode
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  }

  await page.context().storageState({ path: path.join(authDir, 'user.json') });
  console.log('[global-setup] Auth state saved.');
  await browser.close();
}
