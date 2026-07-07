import { test as base, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const authFile = path.join(__dirname, '../.auth/user.json');

/**
 * `authTest` — use this instead of `test` for authenticated scenarios.
 * It skips the test when no auth state is available (i.e. no E2E credentials configured).
 */
export const authTest = base.extend({
  // eslint-disable-next-line no-empty-pattern
  storageState: async ({}, use) => {
    if (!fs.existsSync(authFile)) {
      test.skip(true, 'No auth state found. Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to enable.');
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(authFile);
  },
});

export { expect };

// Re-export plain test for mixed files
const { test } = base;
export { test };
