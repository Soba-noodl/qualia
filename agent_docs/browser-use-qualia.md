# Browser-Use Knowledge: Qualia App

This document is the single source of truth for browser-use interactions with Qualia. Cited by `qualia-run-audit`, `qualia-post-deploy-check`, and `qualia-review` (when using `--live`) for navigation, auth, and observation knowledge. Update this doc when the underlying mechanics change; never re-encode this knowledge inside a skill.

## Quick reference: full audit-run sequence

1. Resolve credentials from env (`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, sourced from `~/.secrets`) — see [Auth flow](#auth-flow)
2. Open `<base_url>/auth`; toggle to sign-in mode; submit credentials; wait for `/dashboard`
3. Dismiss the driver.js tour (see [Tour dismissal](#tour-dismissal))
4. Navigate to a project page (see [URL map](#url-map))
5. Click the upload zone (see [Upload zone](#upload-zone))
6. Select audit type by clicking text label
7. Set file input or paste Figma URL
8. Submit
9. Poll for completion (see [Audit completion](#audit-completion))
10. Extract scores from DOM (see [Score extraction](#score-extraction))

---

## Base URLs by environment

| `--env` | Base URL |
|---|---|
| `local` | `http://localhost:8080` |
| `staging` | `https://staging.qualia-ux.com` |
| `prod` | `https://app.qualia-ux.com` |

If staging/prod URLs differ in the codebase, update this table.

## Auth flow

**Credentials location:** env vars sourced from `~/.secrets`. Read via shell (`echo $E2E_TEST_EMAIL`) — they should already be exported in the parent shell.

```
E2E_TEST_EMAIL=test@qualia-ux.com
E2E_TEST_PASSWORD=<your-test-password>
E2E_TEST_PROJECT_ID=338c3252-9820-420b-894f-ae1808c8209d
E2E_FIGMA_PROTOTYPE_URL=...
```

**Sign-in procedure:**
1. Open `<base_url>/auth`
2. The page defaults to **Create Account mode**. Click the link "Already have an account? Sign in" to switch to sign-in mode. **Always do this step** — submitting credentials in Create Account mode tries to register the test user and fails.
3. Fill `input[type="email"]` with `E2E_TEST_EMAIL`
4. Fill `input[type="password"]` with `E2E_TEST_PASSWORD`
5. Click the button labeled "Sign In" (capital I)
6. Wait for redirect to `<base_url>/dashboard`
7. Dismiss the tour (see below)

**Browser-use commands (illustrative):**
```bash
browser-use open "$BASE_URL/auth"
browser-use state                                      # find indices
browser-use click <index of "Already have an account? Sign in">
browser-use type <email-input-index> "$E2E_TEST_EMAIL"
browser-use type <password-input-index> "$E2E_TEST_PASSWORD"
browser-use click <index of Sign In button>
# Wait for /dashboard
```

**Reuse:** browser-use keeps a persistent daemon, so once logged in, subsequent commands in the same session retain auth. No need to re-authenticate per command.

## Tour dismissal

The driver.js product tour intercepts clicks and overlays the page on first visit. **Always dismiss before interacting.**

**Why `Escape` is unsafe:** on pages with an open Dialog/Modal (e.g., the audit upload modal), `Escape` closes the entire modal, not just the tour popover. Use the procedure below instead.

**Procedure:**
1. Set localStorage flags so the tour never starts again for the session:
   ```js
   const allDone = JSON.stringify({
     dashboard: true, projectCreated: true, projectView: true,
     auditCreation: true, results: true, analytics: true,
     userDataNudge: true, contextDocNudge: true
   });
   const PREFIX = 'qualia_tutorial_completed';
   const userKeys = Object.keys(localStorage).filter(k =>
     k.includes('auth-token') || k.includes('supabase'));
   let userId = null;
   for (const k of userKeys) {
     try {
       const p = JSON.parse(localStorage.getItem(k) || '{}');
       userId = p?.user?.id || p?.data?.user?.id || p?.session?.user?.id;
       if (userId) break;
     } catch {}
   }
   if (userId) localStorage.setItem(`${PREFIX}_${userId}`, allDone);
   Object.keys(localStorage).filter(k => k.startsWith(PREFIX))
     .forEach(k => localStorage.setItem(k, allDone));
   ```
2. Wait ~900ms (tours have up to 800ms init delay)
3. If a tour popover is currently visible, close it by clicking one of the close-button selectors:
   `.driver-popover-close-btn`, `#driver-popover-close-btn`, `[aria-label="Close"]`, `.driver-popover-close`
4. Repeat steps 2–3 up to 8 times if the popover keeps reappearing (tour can have multiple steps)

**Browser-use:**
```bash
browser-use eval "<the localStorage script above>"
sleep 1
# Then either click close button by index or eval a click on .driver-popover-close-btn
```

## URL map

Named targets resolve to URLs (`<base_url>` from the env table above):

| Name | URL |
|---|---|
| `dashboard` | `<base_url>/dashboard` |
| `home` | `<base_url>/home` |
| `settings` | `<base_url>/settings` |
| `analytics` | `<base_url>/analytics` |
| `auth` | `<base_url>/auth` |
| `auth-callback` | `<base_url>/auth/callback` |
| `project` | `<base_url>/project/$E2E_TEST_PROJECT_ID` |
| `audit-detail` | First audit on default test project (resolved at runtime — click first audit card on `project` page) |

**Parameterized:**
- `project:<id>` → `<base_url>/project/<id>`
- `audit:<id>` → resolved by navigating to project, finding the audit card with that ID

**Raw URLs** (`http://...`, `https://...`) accepted anywhere a target is expected — pass through unchanged.

## Project card navigation

Project cards on `/dashboard` are NOT `<a href>` elements — they are `div`s with click handlers. Navigate by clicking the project name text:

```bash
browser-use state
browser-use click <index of project name text>
# Wait for /project/<id> URL
```

## Upload zone

The upload zone on a project page is a styled `div`, not a `<button>`. Normal `browser-use click` on the surrounding container often hits the wrong element (the Delete Project button is nearby in the layout).

**Safer click via JS evaluate:**
```bash
browser-use eval "document.querySelector('h3')?.closest('div[class]')?.click()"
```

This targets the `<h3>` heading inside the upload zone and clicks its parent container — the actual click handler.

After this, the upload modal opens.

## Audit modal

The modal opens with a type selector. **Three audit type buttons by exact text:**
- `Single Screen Audit`
- `User Flow Analysis`
- `Prototype Audit`

Click by text label, not by selector. Wait ~500ms after click.

**File input:** appears after type selection. Selector: `input[type="file"]` (also `#file-upload` works). Use browser-use's upload command:

```bash
browser-use upload <index of file input> /abs/path/to/screenshot.png
```

For flow type, multiple files (ordered):
```bash
browser-use eval "
  const input = document.querySelector('input[type=file]');
  const dt = new DataTransfer();
  // ... attach files
"
```

(Or upload one at a time if browser-use's upload command supports multi-file batches.)

**Figma URL input (prototype only):** appears after selecting "Prototype Audit". Find the URL input field; paste `E2E_FIGMA_PROTOTYPE_URL`.

**Submit button:** find a `button` inside the dialog whose text matches `Audit`, `Run`, `Analyze`, or `Start` (last one in the dialog typically). Click it.

**Tour inside the modal:** the audit creation tour starts INSIDE the modal (driver.js re-activates). Wait ~1s after opening for it to settle, then dismiss again. Do NOT press `Escape` — closes the modal.

## Audit completion

After submit, the page shows "Analyzing..." text and a spinner. Poll until completion:

```bash
# Poll loop (illustrative; adjust to your shell preference)
deadline=$(($(date +%s) + 120))
while [ $(date +%s) -lt $deadline ]; do
  body=$(browser-use eval "document.body ? document.body.innerText.slice(0, 400) : ''")
  if ! echo "$body" | grep -qi "analyzing"; then
    if echo "$body" | grep -qiE "score|finding|critical|severity"; then
      break
    fi
  fi
  sleep 6
done
```

Typical wait: 30–60s for single-screen, up to 120s for flow, up to 180s for prototype.

## Score extraction

After completion, scores appear in DOM as plain text numbers.

**Overall score** appears first, near text matching `/Overall/i`. Sub-scores follow.

**Extraction patterns:**
```bash
text=$(browser-use eval "document.body.innerText")

# Overall
overall=$(echo "$text" | grep -oE 'Overall.{0,30}[0-9]{1,3}' | grep -oE '[0-9]{1,3}' | head -1)

# Sub-scores: 4 numbers near "Score = Average of N dimensions" or similar
sub=$(echo "$text" | grep -oE '\b[0-9]{2,3}\b' | head -5)

# One Big Thing: text after "ONE BIG THING" or similar header
obt=$(echo "$text" | sed -n '/ONE BIG THING/,/^\s*$/p' | tail -n +2 | head -3)
```

If the DOM structure changes (e.g., scores get aria-labeled), update this section.

**Audit URL:** after completion, the page is at `/audit/<id>`. Read with `browser-use eval "window.location.href"`.

## Quota and admin override

Test account has a daily audit limit (Beta Plan: 2/day). Clicking the upload zone when over quota shows a "Daily Limit Reached" dialog.

**Bypass:** an admin override fires automatically when the limit is hit, showing a toast: `Admin Override: Daily limit bypassed`. After the toast, audits run normally. No manual action required, but be aware that the first audit attempt of the day may show the dialog briefly before the override kicks in.

## Project structure (test data)

| Field | Value source |
|---|---|
| Test project ID | `E2E_TEST_PROJECT_ID` (env) |
| Test project URL | `<base_url>/project/$E2E_TEST_PROJECT_ID` |
| Figma prototype URL | `E2E_FIGMA_PROTOTYPE_URL` (env) |

## Console error filtering

When checking for "no errors", filter out expected noise:
- `posthog`
- `fonts.googleapis`
- `vercel`
- `eu-assets`
- CSP warnings from analytics/fonts

Application-level errors (anything else) are real signal.

## Browser-use idioms specific to Qualia

- **Always re-read `state` after navigation.** Indices change between pages.
- **Prefer text-based clicks over index clicks** when possible — survives index churn within a page.
- **Use `eval` for clicks blocked by overlays** (driver.js, Radix UI dialogs with focus traps).
- **Don't `eval` with selectors when text-based search works** — text search survives className renames.
- **Wait after clicks.** Most Qualia interactions trigger React state updates; sleep 0.3–1s before next state read.
- **Screenshot before any uncertain action.** Cheap insurance against wrong-click navigation.
