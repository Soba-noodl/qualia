import type { Page } from '@playwright/test';

/**
 * Mark all driver.js tour steps as complete in localStorage for the current user.
 * Call this after navigation, before interacting with the page.
 */
export async function markTourComplete(page: Page) {
  await page.evaluate(() => {
    const allDone = JSON.stringify({
      dashboard: true,
      projectCreated: true,
      projectView: true,
      auditCreation: true,
      results: true,
      analytics: true,
    });
    const PREFIX = 'qualia_tutorial_completed';
    const keys = Object.keys(localStorage);

    let userId: string | null = null;
    for (const key of keys) {
      if (key.includes('auth-token') || key.includes('supabase')) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
          userId = parsed?.user?.id ?? parsed?.data?.user?.id ?? parsed?.session?.user?.id ?? null;
          if (userId) break;
        } catch { /* ignore */ }
      }
    }

    if (userId) localStorage.setItem(`${PREFIX}_${userId}`, allDone);
    keys.filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.setItem(k, allDone));
  });
}

/**
 * Click through or close the driver.js tour popover if it is currently visible,
 * then forcibly remove any remaining driver.js DOM elements (overlay, highlights).
 * Safe to call even when no tour is active.
 */
export async function closeTour(page: Page) {
  for (let i = 0; i < 8; i++) {
    const popover = page.locator('#driver-popover-content');
    if (!await popover.isVisible({ timeout: 600 }).catch(() => false)) break;

    // The driver-overlay SVG intercepts pointer events — use JS click to bypass it entirely
    const dismissed = await page.evaluate(() => {
      // Try close (×) button first
      for (const sel of ['.driver-popover-close-btn', '#driver-popover-close-btn',
                         '[aria-label="Close"]', '.driver-popover-close']) {
        const btn = document.querySelector<HTMLElement>(sel);
        if (btn) { btn.click(); return true; }
      }
      // Fall back to Next / Done / Finish — use startsWith to handle "Next →", "Next→", etc.
      const popoverEl = document.querySelector('#driver-popover-content');
      if (!popoverEl) return false;
      const navBtn = Array.from(popoverEl.querySelectorAll<HTMLElement>('button'))
        .find(b => {
          const txt = b.textContent?.trim() ?? '';
          return ['Next', 'Done', 'Finish'].some(l => txt === l || txt.startsWith(l));
        });
      if (navBtn) { navBtn.click(); return true; }
      return false;
    });
    if (!dismissed) break;
    await page.waitForTimeout(350);
  }

  // Forcibly remove any lingering driver.js DOM elements (overlay SVG, popover, highlights).
  // These can persist even after the popover is dismissed and block pointer events.
  await page.evaluate(() => {
    document.querySelectorAll(
      '#driver-popover-content, .driver-popover, .driver-overlay, ' +
      '[id^="driver-highlighted-element"], .driver-active-element'
    ).forEach(el => (el as HTMLElement).remove());
  });
}

/**
 * Combined helper: mark tour done in localStorage then close any visible popover.
 * Waits 900ms to let any delayed tour timers (max 800ms) fire before dismissing.
 * The page must already be loaded before calling this.
 */
export async function dismissTour(page: Page) {
  await markTourComplete(page);
  // All tours use setTimeout delays (500–800ms). Wait longer than the max so any
  // pending timers fire before we try to close them.
  await page.waitForTimeout(900);
  await closeTour(page);
}
