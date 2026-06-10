import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Unauthenticated tests (auth page, public pages, redirect checks)
    {
      name: 'unauthenticated',
      testMatch: [
        '**/smoke.spec.ts',
        '**/auth.spec.ts',
        '**/public-pages.spec.ts',
        '**/protected-routes.spec.ts',
        '**/changelog.spec.ts',
        '**/showcase.spec.ts',
        '**/contact-form.spec.ts',
        '**/email-preferences.spec.ts',
        '**/a11y-public.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    // Authenticated tests — require E2E_TEST_EMAIL + E2E_TEST_PASSWORD
    {
      name: 'authenticated',
      testMatch: [
        '**/dashboard.spec.ts',
        '**/settings.spec.ts',
        '**/settings-interactions.spec.ts',
        '**/settings-ai-providers.spec.ts',
        '**/settings-privacy-consent.spec.ts',
        '**/project.spec.ts',
        '**/audit-flow.spec.ts',
        '**/audit-detail.spec.ts',
        '**/analytics.spec.ts',
        '**/new-project.spec.ts',
        '**/figma-integration.spec.ts',
        '**/figma-auth.spec.ts',
        '**/teams.spec.ts',
        '**/delete-account.spec.ts',
        '**/a11y-authed.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
