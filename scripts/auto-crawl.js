#!/usr/bin/env node
/**
 * auto-crawl.js — Qualia Auto-Audit Crawler (Gemini-driven agentic mode)
 *
 * Instead of a dumb link crawler, this uses Gemini Vision in a loop:
 *   1. Take a screenshot of the current state
 *   2. Ask Gemini "what should I click next to explore this app?"
 *   3. Playwright clicks it
 *   4. Repeat until MAX_SCREENSHOTS or Gemini says done
 *
 * Works for any web app — Gemini understands dashboards, SPAs, modals,
 * tabs, sidebars, etc. No hardcoded selectors.
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const AUDIT_ID = process.env.AUDIT_ID;

const MAX_SCREENSHOTS = 30; // capture budget — images sent to analysis
const MAX_NAV_STEPS = 60;   // navigation budget — total Gemini decisions allowed
const GEMINI_RPM_LIMIT = 12; // stay under 15 RPM — reserve 3 for analysis retries
const VIEWPORT = { width: 1440, height: 900 };
const NAV_TIMEOUT = 30_000;
const IDLE_TIMEOUT = 10_000;
const RENDER_WAIT = 2_000;
const MAX_FAILURES = 6; // consecutive Gemini-click failures before stopping

// Simple per-minute rate limiter for Gemini navigation calls
const geminiCallTimestamps = [];
async function geminiRateLimit() {
  const now = Date.now();
  // Drop timestamps older than 60s
  while (geminiCallTimestamps.length > 0 && now - geminiCallTimestamps[0] > 60_000) {
    geminiCallTimestamps.shift();
  }
  if (geminiCallTimestamps.length >= GEMINI_RPM_LIMIT) {
    const oldestInWindow = geminiCallTimestamps[0];
    const waitMs = 60_000 - (now - oldestInWindow) + 500; // +500ms safety margin
    console.log(`  [rate limit] ${geminiCallTimestamps.length} calls in last 60s — waiting ${Math.ceil(waitMs/1000)}s`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  geminiCallTimestamps.push(Date.now());
}

// Words that indicate destructive, session-ending, or zero-value actions — skip these
const DANGEROUS_KEYWORDS = [
  "sign out", "log out", "logout", "signout",
  "delete account", "cancel account", "cancel subscription",
  "delete project", "delete audit", "delete workspace",
  // Legal/policy pages: zero UX audit value, burn budget
  "terms of service", "terms of use", "privacy policy", "cookie policy",
  "legal notice", "gdpr", "imprint",
];

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !AUDIT_ID) {
  console.error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, AUDIT_ID");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const EDGE_BASE = `${SUPABASE_URL}/functions/v1`;

let STORAGE_PREFIX = `auto-crawl/${AUDIT_ID}`;

// ---------------------------------------------------------------------------
// Infra helpers
// ---------------------------------------------------------------------------

let lastCheckpointMsg = "";

async function markFailed(reason) {
  // Include last checkpoint so we can diagnose failures without log access
  const fullMsg = lastCheckpointMsg ? `${reason} | debug: ${lastCheckpointMsg}` : reason;
  await supabase
    .from("audits")
    .update({ status: "failed", error_message: fullMsg })
    .eq("id", AUDIT_ID);
}

async function fetchCrawlConfig() {
  const res = await fetch(`${EDGE_BASE}/crawl-config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ audit_id: AUDIT_ID }),
  });
  if (!res.ok) throw new Error(`crawl-config failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function callAnalyzeCrawl(screenshotPaths, crawlUrl) {
  const res = await fetch(`${EDGE_BASE}/analyze-crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ audit_id: AUDIT_ID, screenshot_paths: screenshotPaths, crawl_url: crawlUrl }),
  });
  if (!res.ok) throw new Error(`analyze-crawl failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function uploadScreenshot(buffer, storagePath) {
  // Retry once on failure (handles transient network/storage errors)
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await supabase.storage
      .from("screenshots")
      .upload(storagePath, buffer, { contentType: "image/png", upsert: true });
    if (!error) return;
    if (attempt === 1) {
      console.warn(`  Upload attempt 1 failed (${error.message}) — retrying in 3s`);
      await new Promise((r) => setTimeout(r, 3000));
    } else {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }
}

// Write a status checkpoint to the audit row so we can debug failures from outside
async function checkpoint(msg) {
  console.log(`[checkpoint] ${msg}`);
  lastCheckpointMsg = msg;
  try {
    await supabase.from("audits").update({ error_message: msg }).eq("id", AUDIT_ID);
  } catch { /* non-critical — never crash the crawl over a checkpoint write */ }
}

async function waitForSettle(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: IDLE_TIMEOUT }).catch(() => {});
  // Skip networkidle — Supabase realtime connections mean it never fires
  await page.waitForFunction(
    () => document.body && document.body.innerText.trim().length > 20,
    { timeout: 5000 }
  ).catch(() => {});
  await page.waitForTimeout(RENDER_WAIT);
}

/**
 * After a screenshot is taken, dismiss any active tour overlay so Gemini
 * sees the clean product UI on the next step. We snap first — so the tour
 * overlay IS captured as audit data — then clear it.
 *
 * Targets:
 *   - driver.js popovers (used by Qualia + any driver.js app)
 *   - TourBridge callouts (Qualia-specific, aria-label="Dismiss")
 *
 * Explicitly skips [role="dialog"] — real modals with forms/content are never touched.
 */
async function dismissActiveTour(page) {
  const tourSelectors = [
    // driver.js close button (×) — destroys the active tour
    ".driver-popover-close-btn",
    // TourBridge floating callout dismiss
    'button[aria-label="Dismiss"]:not([role="dialog"] *)',
  ];

  for (const sel of tourSelectors) {
    try {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && await el.isVisible({ timeout: 300 })) {
        await el.click();
        await page.waitForTimeout(400); // let dismiss animation complete
        console.log(`  Dismissed tour overlay: ${sel}`);
        return;
      }
    } catch { /* not present, skip */ }
  }
}

async function capture(page, index, label, screenshotPaths, force = false) {
  if (screenshotPaths.length >= MAX_SCREENSHOTS) return null;
  try {
    // Skip loading/blank states — if the page has virtually no text it's a spinner or redirect
    // force=true bypasses this check (used for the very first landing screenshot)
    const textLength = await page.evaluate(() => (document.body?.innerText ?? "").trim().length).catch(() => 999);
    if (!force && textLength < 80) {
      console.log(`  Skipped blank/loading state: "${label}" (${textLength} chars)`);
      return null;
    }

    const buffer = await page.screenshot({ fullPage: false }); // viewport only for speed
    const storagePath = `${STORAGE_PREFIX}/${String(index).padStart(2, "0")}_${label}.png`;
    await uploadScreenshot(buffer, storagePath);
    screenshotPaths.push(storagePath);
    console.log(`  [${screenshotPaths.length}/${MAX_SCREENSHOTS}] Captured: ${label}`);
    return buffer;
  } catch (err) {
    console.warn(`  Failed to capture ${label}:`, err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gemini-driven navigation
// ---------------------------------------------------------------------------

async function askGeminiNavigation(geminiApiKey, screenshotBuffer, history, currentUrl, screenshotsRemaining, sameUrlStreak, visitedUrls = new Set()) {
  await geminiRateLimit();
  const base64 = screenshotBuffer.toString("base64");

  const historyText = history.length > 0
    ? `Already acted (do NOT repeat these): ${history.join(" | ")}`
    : "Nothing done yet — you have barely started.";

  // Inject urgency cues based on budget and exploration state
  let budgetWarning = "";
  if (screenshotsRemaining <= 5) {
    budgetWarning = `\n⚠️ CRITICAL: Only ${screenshotsRemaining} capture slots left. Use "capture":false liberally — only fire the shutter on primary sections or flows you haven't seen yet. Skip all secondary nav, settings sub-pages, and modal details.`;
  } else if (screenshotsRemaining <= 10) {
    budgetWarning = `\n⚠️ LOW CAPTURE BUDGET: ${screenshotsRemaining} shots left. Prefer "capture":false for pass-through steps. Prioritize unseen primary sections and key transactional flows.`;
  }

  let streakWarning = "";
  if (sameUrlStreak >= 3) {
    streakWarning = `\n⚠️ SAME PAGE FOR ${sameUrlStreak} CLICKS: You're burning budget on in-page interactions. Unless you're mid-onboarding on the very first visit, navigate to a PRIMARY NAV section you haven't seen yet. Escape any modal/overlay and move on.`;
  }

  const actionsText = history.length > 0
    ? `Actions taken so far: ${history.length} (a thorough audit needs 20–40 actions — you are ${history.length < 10 ? "just getting started" : history.length < 20 ? "mid-exploration" : "well into coverage"})`
    : "Actions taken so far: 0 — you have barely started. Do NOT return done.";

  const prompt = `ROLE: You are the navigation module of Qualia, an elite UX audit system. You are driving a headless browser through a live product to capture every distinct screen, state, and interaction surface for a 4-engine design analysis (System Logic, Heuristics, Cognitive Load, Interaction Cost).

Your decisions directly determine the quality of the audit. Every screenshot you choose to capture — or fail to capture — shapes the final report. Treat this with the same rigour a senior QA lead would apply before a product launch review.

CURRENT STATE:
URL: ${currentUrl}
Screenshots remaining: ${screenshotsRemaining} / 30
${actionsText}
${historyText}
Already-captured URLs (navigating to these will NOT produce a new screenshot — choose something else): ${visitedUrls.size > 0 ? [...visitedUrls].join(", ") : "none yet"}${budgetWarning}${streakWarning}

YOUR MISSION: Maximum meaningful coverage of distinct, important product screens. Not random clicking — deliberate, breadth-first exploration. Use your navigation budget to reach screens worth capturing, and your screenshot budget only on screens that are genuinely valuable.

BUDGET PHILOSOPHY: You have a fixed number of shots. Spend them like a photographer on assignment — prioritize the core product surfaces that will make or break the audit. Onboarding and tutorials are worth 2-3 shots maximum; the core product is worth the rest.

CARDINAL RULE — BREADTH BEFORE DEPTH:
Always prefer visiting an unseen primary section over exploring a sub-tab or detail of a section already captured.
If you are on a detail/sub-page (an audit report, a settings panel, a profile page, a single record view):
  → Take the screenshot, then immediately navigate BACK to a primary nav section you haven't visited yet.
  → Do NOT click through every tab on a detail page before returning to cover primary nav breadth.
  → A detail page earns exactly ONE screenshot (its overview). Sub-tabs earn shots only after ALL primary sections are covered.
Think of it as a tree: go wide at each level before going deep. You must visit every branch of the top level before descending into any single branch.

DECISION HIERARCHY — apply the first rule that matches what you see on screen:

0. AUTHENTICATION FORMS (absolute highest priority — only when credentials are available)
   If you see a login/signup form, an email or password input field, or an SSO routing screen:
   → Complete the login immediately: fill_email → fill_password → click the submit button.
   → If you see "Continue without SSO", "Use password", or similar — click it first, THEN fill_password.
   → If you see a CAPTCHA / reCAPTCHA / bot challenge — you cannot solve it. This IS valuable UX audit data (friction). Capture this screen, then explore any public pages accessible without login. Do NOT return "done" just because auth is blocked.
   → If you see an OTP/verification code input — you cannot complete this. Explore public pages instead.

1. CONSENT & FRICTION BLOCKERS
   Cookie banners, GDPR consent dialogs, permission prompts, age gates — these block everything behind them.
   → Click "Accept", "Accept all", "I agree", "Allow", or "Decline" (whichever is the primary action) immediately.
   These screens ARE audit data — they represent real friction every user faces before they can use the product.

2. ONBOARDING & PRODUCT TOURS — efficient pass only
   If a tutorial overlay, product tour, onboarding checklist, or welcome modal is visible on first encounter:
   → Click through it: "Next", "Continue", "Get started", "Show me". Fill forms with plausible data. Pick the most common option.
   → BUT: cap yourself at 3 onboarding clicks maximum. After 3, move on even if the tour isn't finished.
   → Onboarding is worth capturing the entry and exit — not every step. Abandonment data matters; 6-step tutorial minutiae does not.

3. EMPTY STATES & ZERO-DATA SCREENS
   If a section shows an empty state ("No projects yet", "Nothing here", "Get started by creating..."):
   → Click the primary CTA — it reveals the creation flow, which is critical audit data.

4. PRIMARY NAVIGATION (when no overlay is blocking)
   Sidebar items, top nav links, main tabs, section headers.
   → Visit every section not in history. Navigate breadth-first: all top-level sections before drilling into one.
   → This is the highest-value zone. Maximise time here.
   → If you are currently on a detail/sub-page, navigate BACK to primary nav before clicking anything else.

5. PRIMARY CTAs & ACTION BUTTONS
   "Create", "New", "Add", "Upload", "Connect", "Invite", "Start" buttons that open a new screen, panel, or modal.
   → Click the most prominent one visible to reveal transactional flows.
   → Only do this if you've already visited all visible primary nav sections, OR the CTA is the primary action on an empty state.

6. MODALS & DRAWERS (when one is open)
   → Interact: fill visible inputs with fill_text, click the primary action button.
   → Do NOT close without interacting. Do NOT submit destructive actions.

7. LIST ITEMS & CARDS (breadth-aware)
   First item in any list, table, or card grid — but ONLY if all primary nav sections are already covered.
   → Click into it once to capture the detail screen. Then return to primary nav — do NOT explore its sub-tabs.

8. SECONDARY NAVIGATION (last resort)
   Tabs, sub-nav, settings categories, detail-page tab strips.
   → Only after every primary section AND at least one list item detail screen has been captured.
   → If budget is below 5 shots, skip secondary nav entirely.

ESCAPE HATCH — if this page has nothing actionable:
If the current page appears stuck (no unvisited nav items, no unclicked CTAs, empty state with no primary action, or you've already interacted with everything visible), do NOT return "done". Instead: navigate BACK to a primary section not yet in history. Look for a home/dashboard link, a sidebar nav item, or navigate to the app root URL. "I can't find anything here" means "go somewhere else", not "stop".

HARD RULES:
- NEVER repeat an element or action already in the history list.
- NEVER click: "Delete", "Remove", "Disconnect", "Deactivate", "Sign out", "Log out", "Cancel account", "Cancel subscription".
- NEVER click legal/policy links: "Terms", "Privacy Policy", "Cookie Policy", "Terms of Service", "Legal", "GDPR", "Imprint". These pages contain only legal text — zero UX audit value.
- NEVER click a link just because it appears inside a form's checkbox or footnote. Inline legal links in "I agree to [Terms]" are traps — ignore them entirely.
- If the page appears to be a loading screen (spinner only, blank, or very little visible content), navigate away — do NOT return "done".

WHEN YOU MAY RETURN "done":
You are ONLY allowed to return "done" if ALL of the following are true:
  1. screenshotsRemaining ≤ 5, OR actions taken ≥ 30
  2. You have visited every visible primary nav section (sidebar, top nav, main tabs)
  3. You have captured at least one create/new/add flow
  4. You have visited a settings or account/profile page
If ANY condition is unmet and you have shots remaining, you MUST find something else to explore. "I've seen enough" is not valid. Use remaining shots on secondary nav, settings sub-pages, or a second list item detail.

SCREENSHOT DISCIPLINE — "capture" field (default true):
Every action can include "capture": false to navigate WITHOUT taking a screenshot.
Use "capture": false when:
- You are clicking through an intermediate step to REACH something worth capturing (e.g., opening a submenu, clicking "Next" in a multi-step wizard, dismissing a confirm dialog, clicking a menu item that reveals a sub-menu)
- The current screen is a near-duplicate of one already captured (same layout, different data)
- You are completing an auth step that has no standalone audit value
Use "capture": true (or omit it) when:
- You land on a genuinely distinct screen — a new primary section, a new modal, an empty state, a key flow step
- The screen reveals something a UX auditor would care about that hasn't been captured yet

AVAILABLE ACTIONS — respond with exactly one of these JSON shapes:
{"action":"click","element":"exact visible text","capture":true,"reason":"one sentence"}
{"action":"click","element":"exact visible text","capture":false,"reason":"why this is a pass-through, not worth a shot"}
{"action":"fill_email","capture":false,"reason":"completing auth — not independently valuable"}
{"action":"fill_password","capture":false,"reason":"completing auth"}
{"action":"fill_text","element":"label or placeholder","value":"realistic value","capture":false,"reason":"one sentence"}
{"action":"done","reason":"one sentence explaining why exploration is complete"}

Respond with valid JSON only — no markdown, no explanation outside the JSON.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/png", data: base64 } },
          ]}],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.1 },
        }),
      }
    );

    if (!res.ok) {
      console.warn(`  Gemini nav API error: ${res.status}`);
      return { action: "done", reason: "Gemini API error" };
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const finish = data.candidates?.[0]?.finishReason ?? "?";
    console.log(`  Gemini raw (finish=${finish}): ${text.slice(0, 150)}`);

    // 1. Try direct parse
    try { return JSON.parse(text.trim()); } catch {}

    // 2. Extract first {...} block (greedy — handles nested content)
    const block = text.match(/\{[\s\S]*\}/);
    if (block) { try { return JSON.parse(block[0]); } catch {} }

    // 3. Pull action + element via field-level regexes (handles truncated responses)
    const actionMatch = text.match(/"action"\s*:\s*"([^"]+)"/);
    const elementMatch = text.match(/"element"\s*:\s*"([^"]+)"/);
    if (actionMatch) {
      return { action: actionMatch[1], element: elementMatch?.[1] ?? null, reason: "partial" };
    }

    return { action: "done", reason: "Could not parse Gemini response" };
  } catch (err) {
    console.warn(`  Gemini nav error: ${err.message}`);
    return { action: "done", reason: "API error" };
  }
}

async function executeAction(page, nav, email, password) {
  const { action, element, value } = nav;

  // --- fill_email: find the email input and type the credential ---
  if (action === "fill_email") {
    const field = page.locator('input[type="email"], input[name="email"], input[name="username"]').first();
    if ((await field.count()) > 0) {
      await field.click();
      await field.pressSequentially(email, { delay: 30 });
      console.log(`  Filled email field`);
      return true;
    }
    console.log(`  fill_email: no email input found`);
    return false;
  }

  // --- fill_password: find the password input and type the credential ---
  if (action === "fill_password") {
    const field = page.locator('input[type="password"]').first();
    if ((await field.count()) > 0) {
      await field.click();
      await field.pressSequentially(password, { delay: 30 });
      console.log(`  Filled password field`);
      return true;
    }
    console.log(`  fill_password: no password input found`);
    return false;
  }

  // --- fill_text: find an input by label/placeholder and type a realistic value ---
  if (action === "fill_text" && element && value) {
    const strategies = [
      () => page.getByLabel(element, { exact: false }).first(),
      () => page.getByPlaceholder(element, { exact: false }).first(),
      () => page.locator(`input[placeholder*="${element}" i], textarea[placeholder*="${element}" i]`).first(),
    ];
    for (const strategy of strategies) {
      try {
        const el = strategy();
        if ((await el.count()) > 0 && await el.isVisible({ timeout: 300 })) {
          await el.click();
          await el.fill(value);
          console.log(`  Filled "${element}" with "${value}"`);
          return true;
        }
      } catch { /* try next */ }
    }
    console.log(`  fill_text: could not find input for "${element}"`);
    return false;
  }

  // --- click: find an element by text and click it ---
  if (action === "click" && element) {
    const lower = element.toLowerCase();
    if (DANGEROUS_KEYWORDS.some((k) => lower.includes(k))) {
      console.log(`  Skipping dangerous action: "${element}"`);
      return false;
    }

    const strategies = [
      () => page.getByRole("button", { name: element, exact: false }).first(),
      () => page.getByRole("link", { name: element, exact: false }).first(),
      () => page.getByRole("tab", { name: element, exact: false }).first(),
      () => page.getByRole("menuitem", { name: element, exact: false }).first(),
      () => page.getByRole("option", { name: element, exact: false }).first(),
      () => page.locator(`text="${element}"`).first(),
      () => page.getByText(element, { exact: false }).first(),
    ];

    for (const strategy of strategies) {
      try {
        const el = strategy();
        if ((await el.count()) > 0 && await el.isVisible({ timeout: 300 })) {
          const tagName = await el.evaluate(n => n.tagName.toLowerCase()).catch(() => "");
          const inputType = await el.getAttribute("type").catch(() => "");
          const isInput = tagName === "input" || tagName === "textarea" || tagName === "select";
          const isTextInput = isInput && !["checkbox","radio","submit","button","file"].includes(inputType);

          if (isTextInput) {
            // Fill with plausible data when clicking lands on a text input
            await el.fill(element.length < 20 ? `Sample ${element}` : element);
          } else {
            await el.scrollIntoViewIfNeeded();
            await el.click({ timeout: 3000 });
          }
          return true;
        }
      } catch { /* try next */ }
    }
    return false;
  }

  return false;
}

// Backwards-compat alias used in a few spots below
async function clickElement(page, elementText) {
  return executeAction(page, { action: "click", element: elementText }, "", "");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  let config;
  try {
    config = await fetchCrawlConfig();
  } catch (err) {
    console.error("Failed to fetch crawl config:", err.message);
    await markFailed("Failed to fetch crawl config: " + err.message);
    process.exit(1);
  }

  const { crawl_url, user_id, gemini_api_key } = config;

  if (!gemini_api_key) {
    await markFailed("GEMINI_API_KEY not available from crawl-config");
    process.exit(1);
  }

  if (user_id) {
    STORAGE_PREFIX = `${user_id}/auto-crawl/${AUDIT_ID}`;
  }

  console.log(`\nQualia Auto-Audit — ${crawl_url}\n`);

  let browser;
  let context;

  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
    ],
  });
  context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  page.on("console", () => {});

  const screenshotPaths = [];
  let screenshotIndex = 0;

  const snap = async (label, force = false) => {
    if (screenshotPaths.length >= MAX_SCREENSHOTS) return null;
    const buf = await capture(page, ++screenshotIndex, label, screenshotPaths, force);
    // After capturing, dismiss any active tour overlay so Gemini sees clean UI next step
    await dismissActiveTour(page);
    return buf;
  };

  try {
    // === Step 1: Navigate to the target URL ===
    await checkpoint(`Starting crawl of ${crawl_url}`);
    await page.goto(crawl_url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await waitForSettle(page);
    await checkpoint(`Landed. Current URL: ${page.url()}`);

    // Proactively dismiss cookie/consent banners before starting exploration.
    // These use non-standard elements that Playwright's role selectors miss —
    // brute-force with locator text and keyboard fallback.
    await (async () => {
      const consentSelectors = [
        'button:has-text("Accept")', 'button:has-text("Accept all")',
        'button:has-text("I agree")', 'button:has-text("Allow")',
        'button:has-text("Allow all")', 'button:has-text("Got it")',
        '[id*="consent"] button', '[class*="consent"] button',
        '[id*="cookie"] button', '[class*="cookie"] button',
        '[data-testid*="accept"]',
      ];
      for (const sel of consentSelectors) {
        try {
          const el = page.locator(sel).first();
          if ((await el.count()) > 0 && await el.isVisible({ timeout: 500 })) {
            await el.click();
            console.log(`  Dismissed consent banner: ${sel}`);
            await page.waitForTimeout(500);
            break;
          }
        } catch { /* skip */ }
      }
    })();

    // Take first screenshot after landing/login (tour overlay visible = audit data)
    // then dismiss so Gemini starts on clean UI
    let lastBuffer = await snap("landing", true); // force=true: always capture first shot, even captcha/error pages
    await checkpoint(`Landing snap done. shots=${screenshotPaths.length} url=${page.url()}`);
    // Extra dismiss pass for tours that fire with a delay (driver.js uses setTimeout 500-800ms)
    await page.waitForTimeout(1000);
    await dismissActiveTour(page);

    // === Step 2: Gemini-driven agentic exploration loop ===
    console.log("\nStarting Gemini-driven exploration...\n");

    const actionHistory = [];
    const visitedUrls = new Set([page.url()]); // track captured URLs to skip duplicates
    let consecutiveFailures = 0;
    let lastFailedKey = null;
    let sameUrlStreak = 0;
    let lastSnapshotUrl = page.url();
    let navSteps = 0;

    while (screenshotPaths.length < MAX_SCREENSHOTS && navSteps < MAX_NAV_STEPS && consecutiveFailures < MAX_FAILURES) {
      // Take current screenshot if we don't have a fresh one
      if (!lastBuffer) {
        lastBuffer = await page.screenshot({ fullPage: false });
      }

      const currentUrl = page.url();
      const nav = await askGeminiNavigation(
        gemini_api_key, lastBuffer, actionHistory, currentUrl,
        MAX_SCREENSHOTS - screenshotPaths.length, sameUrlStreak, visitedUrls
      );

      console.log(`  Gemini → ${JSON.stringify(nav)}`);

      if (nav.action === "done") {
        console.log("  Gemini says exploration complete.");
        break;
      }

      // Require element for click/fill_text; fill_email/fill_password don't need it
      const needsElement = (nav.action === "click" || nav.action === "fill_text");
      if (needsElement && !nav.element) {
        consecutiveFailures++;
        continue;
      }

      navSteps++;
      const preClickUrl = page.url();
      const actionKey = nav.action === "click" ? nav.element : nav.action;
      const executed = await executeAction(page, nav, "", "");

      if (!executed) {
        console.log(`  Could not execute action: ${nav.action} "${nav.element ?? ""}"`);
        if (actionKey === lastFailedKey) {
          console.log(`  Gemini stuck on "${actionKey}" — adding to history to force progression`);
          actionHistory.push(actionKey);
          lastFailedKey = null;
        } else {
          lastFailedKey = actionKey;
          consecutiveFailures++;
        }
        lastBuffer = null;
        continue;
      }

      consecutiveFailures = 0;
      lastFailedKey = null;
      actionHistory.push(actionKey);

      await waitForSettle(page);

      // Respect Gemini's capture decision — false = navigate without shooting
      // Also auto-skip if we've already captured this exact URL
      const currentPageUrl = page.url();
      const urlAlreadySeen = visitedUrls.has(currentPageUrl);
      const shouldCapture = nav.capture !== false && !urlAlreadySeen;
      const labelSrc = nav.element ?? nav.action;
      const label = labelSrc.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 30);

      if (shouldCapture) {
        visitedUrls.add(currentPageUrl);
        lastBuffer = await snap(label);
      } else {
        if (urlAlreadySeen) {
          console.log(`  [skip — URL already captured] ${currentPageUrl}`);
          // Add to action history so Gemini knows this path leads nowhere new
          if (!actionHistory.includes(`[seen] ${label}`)) {
            actionHistory.push(`[seen] ${label}`);
          }
        } else {
          console.log(`  [no capture] Passed through: ${label}`);
        }
        lastBuffer = null; // force a fresh screenshot on next Gemini call
      }

      // Track how many shots we've taken without the URL changing
      const currentSnapUrl = page.url();
      if (currentSnapUrl === lastSnapshotUrl) {
        sameUrlStreak++;
      } else {
        sameUrlStreak = 0;
        lastSnapshotUrl = currentSnapUrl;
      }

      // If a modal/dialog appeared, give Gemini one extra step to interact with it
      const isModal = await page.locator('[role="dialog"], [data-radix-dialog-content], [aria-modal="true"]').count() > 0;
      if (isModal && screenshotPaths.length < MAX_SCREENSHOTS) {
        console.log("  Modal detected — letting Gemini interact with it");
        const modalBuffer = await page.screenshot({ fullPage: false });
        const modalNav = await askGeminiNavigation(
          gemini_api_key,
          modalBuffer,
          actionHistory,
          page.url(),
          MAX_SCREENSHOTS - screenshotPaths.length,
          0,
          visitedUrls
        );
        console.log(`  Gemini (modal) → ${JSON.stringify(modalNav)}`);
        if (modalNav.action !== "done") {
          const modalExecuted = await executeAction(page, modalNav, "", "");
          if (modalExecuted) {
            const mKey = modalNav.action === "click" ? modalNav.element : modalNav.action;
            actionHistory.push(mKey);
            await waitForSettle(page);
            const mLabelSrc = modalNav.element ?? modalNav.action;
            const mLabel = mLabelSrc.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 30);
            lastBuffer = await snap(`modal_${mLabel}`);
          }
        }
        // Close modal if still open — press Escape
        const stillModal = await page.locator('[role="dialog"], [data-radix-dialog-content], [aria-modal="true"]').count() > 0;
        if (stillModal) {
          await page.keyboard.press("Escape");
          await waitForSettle(page);
          lastBuffer = null;
        }
      }

      // If URL changed, mark buffer stale
      if (page.url() !== preClickUrl) {
        lastBuffer = null;
      }
    }

  } catch (err) {
    console.error("Crawl error:", err.message, err.stack?.split("\n")[1] ?? "");
    lastCheckpointMsg = `${lastCheckpointMsg} | ERROR: ${err.message.slice(0, 200)}`;
  } finally {
    await browser.close().catch(() => {});
  }

  if (screenshotPaths.length === 0) {
    await markFailed("Crawler produced no screenshots");
    process.exit(1);
  }

  console.log(`\nCrawl complete. ${screenshotPaths.length} screenshots captured. Starting analysis...`);

  try {
    const result = await callAnalyzeCrawl(screenshotPaths, crawl_url);
    console.log(`Analysis complete. Score: ${result.score}`);
  } catch (err) {
    console.error("analyze-crawl failed:", err.message);
    await markFailed("analyze-crawl failed: " + err.message);
    process.exit(1);
  }
})();
