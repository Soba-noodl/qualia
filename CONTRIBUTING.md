# Contributing

> **Project status:** snapshot artifact. Qualia is no longer actively maintained as a commercial product. This repo is kept under MIT as a reference for anyone building AI-powered design-audit tooling. **PRs are not actively reviewed.** Issues may go unanswered. You're free to fork — that's the expected mode of use.

If you do want to engage with this repo, here's how things are laid out.

## Setup

See the top of [`README.md`](./README.md) — sections "Getting started" → "Fork-specific edits" cover env vars, the `private.cron_config` seed, vercel.json + figma-plugin/manifest.json edits, and pointers to fixture docs.

Short version for a working local dev loop:

```sh
git clone <your-fork-url>
cd qualia-mvp
npm install
cp .env.example .env.local        # fill in Supabase + integration creds
npm run dev                       # web app on :8080
cd figma-plugin && npm install    # plugin (separate package)
```

## Code layout

- `src/` — React/Vite SPA. Entry: `src/main.tsx`. Routes in `src/App.tsx`. Pages in `src/pages/`, services in `src/services/`, hooks in `src/hooks/`.
- `supabase/functions/` — Deno edge functions (analyze-ui, manage-llm-key, send-contact, etc.). Shared logic under `_shared/`.
- `supabase/migrations/` — SQL migrations. Tracked by filename — never edit historical files in a way that breaks new installs.
- `figma-plugin/` — separate package (own `package.json`, own `npm test`, own `npm run build`).
- `e2e/` — Playwright tests. See `e2e/fixtures/README.md` for the opt-in fixture pattern (BYOK key, Figma PAT).
- `docs/analytics/queries/` — operator-side analytics SQL. See `docs/analytics/queries/README.md` for the `_operator_emails.local.sql` pattern.
- `agent_docs/` — internal context for AI agents working in the repo (architecture, conventions, data layer, danger zones).
- `product_docs/` — product strategy, personas, principles, research (interviewee names redacted to sequential IDs).
- `docs/superpowers/{specs,plans}/` — per-feature design specs and implementation plans (this is how the project was built, with AI agents).

## Workflow

- **Branches:** `main` is the canonical release line; `staging` mirrors it 1:1 (solo-builder convention — both branches always at the same SHA).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). See recent `git log` for examples.
- **Tests:**
  - `npm test` — unit tests (Vitest, jsdom).
  - `npm run test:e2e` — Playwright e2e against `localhost:8080`.
  - `npm run test:e2e:seed` — seed optional fixtures on the test account (unlocks ~7 skipped tests).
  - `deno test --allow-env --allow-read supabase/functions/` — backend tests (Deno).
  - `cd figma-plugin && npm test` — plugin tests (Vitest).
- **Lint:** `npm run lint`.
- **Build:** `npm run build` (web) + `cd figma-plugin && npm run build` (plugin).

## If you find a security issue

The repo is unmaintained. There's no security email. The right action is:
1. Don't open a public issue describing the vulnerability.
2. If it affects your own fork, patch it there and (optionally) document it in your fork's README so others who fork from you inherit the fix.
3. If it's general enough that other forks would benefit, open a PR with the fix; the maintainer (Andrea) may or may not see it.

## Lineage

Original maintainer: Andrea. Originally hosted at `qualia-ux.com`. Shut down commercially May 2026. Released as MIT-licensed snapshot.

Built entirely with AI agents (Claude Code). The `docs/superpowers/specs/` and `docs/superpowers/plans/` folders are the design + implementation record. The `.claude/skills/` folder contains the project-specific Claude skills used during development.
