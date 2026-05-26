# Changelog

Single source of truth: `src/lib/changelog.ts` + `src/utils/translations/changelog.ts` (these power the in-app `/changelog` page). Regenerate this file with `python3 scripts/generate-changelog-md.py`.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions in chronological order, most recent first.

---

## May 2026

### Open v10.0 — Bring Your Own Key, complete privacy overhaul
_May 24, 2026_

v10.0 marks the production-ready release. Audits run on your own LLM keys at zero cost to us, account deletion now purges every byte of your data from storage, and we've scrubbed sensitive content (your design files, LLM responses, OAuth flows) from all logs.

- Bring Your Own Key is generally available across Gemini, GPT, and Claude. Bring your own credits and run unlimited audits with no per-audit fee.
- Account deletion now removes every screenshot, document, project, plugin export, and OAuth token from storage, not just the database row.
- Logs no longer record your Figma file contents, LLM responses, OAuth tokens, or design payloads. Only error metadata for debugging.

### Beta v9.7 — Faster app load, complete keyboard a11y, hardened stack
_May 15, 2026_

The app loads dramatically faster on first visit, the main JavaScript chunk is 64% smaller and each page now streams in only when needed. Keyboard and screen-reader users get a complete experience for the first time, and five known vulnerabilities in the dependency tree are gone.

- First-load JavaScript is 64% smaller (775 → 282 kB gzipped). Each page now loads on demand instead of bundling everything upfront.
- Skip-to-content link on every page, aria-labels on 15 icon buttons, and audit/upload/export loading states now announce to screen readers.
- Zero security advisories in the dependency tree (was five). Vite and jsdom updated, GitHub Actions pinned to commit SHA, install scripts disabled by default.

### Beta v9.6 — Daily limit visibility, plugin cancel, app-wide reliability
_May 11, 2026_

Your remaining daily audits are now visible everywhere, Project page, Re-audit button, and inside the Figma plugin home and report views, and audit cards disable cleanly the moment you hit zero. On top of that, 25+ reliability fixes landed across the app: the plugin Cancel button actually cancels now, network failures surface clear retry buttons on Analytics, Contact and OAuth callbacks, and executive PDF/PPTX exports no longer silently produce broken output.

- Daily audit count is now visible on Project, Re-audit, and inside the Figma plugin, controls auto-disable with a tooltip the moment you hit your limit.
- Plugin reliability: Cancel actually cancels the running analysis, re-audit times out cleanly after 60s instead of spinning forever, and long frame names show the full text on hover.
- App-wide robustness: error states with Retry on Analytics, Audits, Contact and OAuth callbacks; safer Back button on Auth; mobile-friendly changelog and Settings tabs; broken executive exports no longer ship silently.

### Beta v9.5 — Sharper errors, safer destructive actions, gentler flows
_May 9, 2026_

Twelve UX improvements across Auth, Dashboard, Settings, and Project pages. Network failures now surface a clear retry button instead of looking silently empty. Disconnecting integrations and revoking MCP access now require explicit confirmation. Several smaller flows were softened, Auth's email submit defers to Google as the primary, project card actions are visible without hovering, and the post-create flow guides with a toast instead of forcing a modal.

- Network failures across Dashboard, Settings, and Project now show a clear error state with a Try again button, no more 'looks empty when actually broken'.
- Disconnecting Figma, Notion, Drive, or revoking MCP access now opens a confirmation dialog with context-specific warnings, a single misclick can no longer break in-flight audits.
- Polish across the app: Google sign-in is the visual primary on Auth, project card actions are visible at low opacity by default, signup confirmation animations respect reduced-motion, and the Settings icon no longer self-references on the Settings page.

### Beta v9.4 — Synth on prototypes, crawl reliability, plugin CTAs
_May 8, 2026_

Synth user analysis can now be triggered on any completed prototype audit without re-running it, and prototype re-audits inherit your previous synth selection. Prototype crawls exit cleanly on timeout or Figma paywall, surfacing a clear error toast instead of hanging silently.

- Prototype audits now include a "Run Synth Analysis" card, add synth user perspectives to any finished audit without starting over.
- Prototype crawl now fails cleanly on timeout or Figma starter-plan paywall, a clear toast tells you what blocked the export.
- New plugin nudges across the app, banner in the upload modal, dashboard header pill, empty-state link, and a Settings entry all point to the Figma plugin.

### Beta v9.3 — Session stability, prototype fixes, invite reliability
_May 7, 2026_

The Figma plugin no longer logs you out on transient connection errors, an inline reconnect prompt appears instead, letting you decide when to re-authenticate. Prototype audits in the home feed now show the correct name, scores, and Design System tab, and the team invite flow works reliably with Google OAuth.

- Plugin sessions now survive temporary network hiccups, no forced logout; an inline prompt lets you reconnect only when truly needed.
- Prototype audits in the home feed now show their correct name, Prototype and Frames score chips, and the Design System tab.
- Team invite links now work correctly for Google OAuth sign-ups; back from any report now returns to the home feed.

### Beta v9.2 — Plugin home, redesigned reports, retention emails
_May 6, 2026_

The Figma plugin opens directly to your previous audits, pick one to revisit or tap to start a new one. The report view is fully redesigned with tabs, four-stance feedback, and a re-audit flow that uses your feedback to refine results.

- The plugin now lands on a home feed of your last 20 audits, open any one, then re-audit it without leaving Figma.
- Plugin reports are redesigned with tabs (UX, Accessibility, Design System), four-stance feedback, and a re-audit flow that learns from your responses.
- New welcome and re-engagement emails, plus a unified language setting that follows you across plugin, web app, and emails.

### Beta v9.1 — MCP reliability, email confirmation, plugin polish
_May 5, 2026_

The Claude connection is now significantly more stable, OAuth disconnects are resolved and the MCP server is hosted at qualia-ux.com. A dedicated email confirmation panel lands for new signups, and the plugin settings get a full design-system refresh.

- MCP connection is now stable, OAuth token rotation fixed, qualia-ux.com hosting, and RFC-compliant discovery all ship together, eliminating random Claude disconnects.
- After signup you land on a dedicated confirmation panel, resend the email or change your address without leaving the flow.
- Plugin settings redesigned to match the design system; audit export actions condensed into a single dropdown.

## April 2026

### Beta v9.0 — Connect Qualia to Claude
_April 30, 2026_

Claude can now read your Qualia audits directly. Connect once from Settings or right after running an audit, and Claude has instant access to your findings, scores, screenshots, and project context, no copy-pasting required. Works with Claude.ai, Claude Desktop, and Claude Code.

- Set up the Qualia MCP once from Settings or right after an audit, Claude authenticates securely with OAuth and keeps access until you revoke it.
- Ask Claude to analyze your top issues, generate fixes, or compare audits. It reads the full report including all findings, scores, and screenshots.
- Works with Claude.ai (Connectors), Claude Desktop, and Claude Code, connect from any client in under two minutes.

### Beta v8.1 — Export audit as AI-ready markdown
_April 21, 2026_

Every audit can now be exported as structured markdown that any AI tool can read. The export packs findings, scores, accessibility data, and screen context into a single file ready to drop into a chat or pipeline.

- New "Export for AI" button in the audit action bar, one click generates a full structured markdown file.
- Figma frame names are used as screen labels, so the output maps cleanly to what you see in your designs.
- Export covers all three audit modes: screenshot upload, Figma frame, and prototype crawl.

### Beta v8.0 — Team workspaces, user profiles, and project visibility
_April 15, 2026_

Qualia now supports full team collaboration. Invite teammates, share projects with your org, and move work between personal and team spaces. Each user gets a profile with display name and avatar. The Figma plugin now separates personal and team projects so you always know what you're auditing against.

- Team workspaces: invite members, share projects with your org, and control who can manage or delete them.
- User profiles with display name and avatar, visible on project cards and the breadcrumb.
- Plugin now shows a Personal / Team toggle so you can pick the right project scope before every audit.

### Beta v7.2 — Plugin stability overhaul, instant audit saves, numbered issue badges
_April 14, 2026_

The Figma plugin no longer freezes when reviewing audits. Pinpoint markers now render in parallel, fonts are pre-loaded, and rapid interactions are queued, eliminating the 5–10 second lockups. Audits also save directly to Qualia the moment analysis finishes, and every issue card now shows a numbered badge matching its canvas marker.

- Plugin freezes eliminated, markers render in parallel with pre-loaded fonts, so highlighting, toggling, and clearing are instant.
- Audits are immediately visible in Qualia after analysis, no separate save step required.
- Issue cards now display numbered badges that match the corresponding pinpoint markers on the canvas.

### Beta v7.1 — Prototype audit out of alpha, sharper report labels, security improvements
_April 9, 2026_

Prototype audit is now always available and no longer experimental. Screen label accuracy in prototype reports is improved, and a security hardening pass ships across the backend.

- Prototype audit is out of alpha, always visible on any Figma frame or flow.
- Screen labels in prototype reports use 1-based numbering, anchored to the correct frames.
- Security improvements: tighter rate limits, stricter CORS, and safer image upload handling.

### Beta v7.0 — Qualia plugin is now live on Figma Community
_April 2, 2026_

The Qualia plugin is publicly available, anyone can install it directly from Figma Community and run audits without leaving Figma. This is the first version open to all users.

- Install the plugin from Figma Community and run UX audits on any frame without switching tools.
- Audit results sync to your Qualia dashboard so you can share and track findings across the team.
- Prototype crawl is available inside the plugin from day one, run full multi-screen audits without leaving Figma.

## March 2026

### Beta v6.1 — More reliable Figma prototype crawls and clearer audit reports
_March 31, 2026_

This release strengthens prototype-based audits from Figma: more dependable crawls, clearer reporting for multi-screen flows, and steady improvements to the plugin and presentation exports.

- Improved stability and reliability when crawling Figma prototypes, including more consistent capture of linked screens.
- Prototype audit reports better separate UX findings, design-system checks, and prototype-specific insights.
- Smoother in-plugin workflow and more dependable deck exports when you share results with your team.

### Beta v6.0 — Prototype crawl for Figma is now available
_March 27, 2026_

You can now run audits from Figma prototype flows, so multi-screen journeys are easier to evaluate in one pass.

- Start from a Figma prototype URL and capture connected flow screens.
- Get a more complete UX signal across transitions, not just single frames.
- Automatically audit design-system consistency extrapolated from the prototype itself.

### Beta v5.0 — Synth user perspective added to audit reports
_March 25, 2026_

Audit reports can now include an optional simulated-user perspective to reveal likely friction across different user profiles.

- Enable synth users when running an audit.
- Compare key friction points across selected personas.
- Use the extra lens without disrupting your core audit flow.

### Beta v4.3 — More reliable Figma import and analysis
_March 21, 2026_

We improved the end-to-end Figma import experience so audits complete more consistently.

- More stable sign-in and connection behavior for Figma.
- Better handling of export/upload steps during analysis.
- Clearer error feedback when something needs your attention.

### Beta v4.2 — Stronger accessibility checks and report quality
_March 12, 2026_

Accessibility and report signals were refined so issues are easier to prioritize and fix.

- More dependable accessibility checks inside the audit flow.
- Cleaner report output for faster review.
- Sharper guidance to move from findings to action.

### Beta v4.1 — Important bugfixes for Figma stability and Notion OAuth
_March 11, 2026_

We fixed multiple reliability issues affecting the Figma experience and improved Notion OAuth error handling so sign-in failures are easier to understand and recover from.

- More stable Figma iframe with safer `localStorage` access and clearer crash feedback.
- Notion OAuth now surfaces real API errors and respects `returnPath` after token exchange.
- Improved export pagination and auth export/migration reliability.
