---
name: q-post-deploy-check
description: Use after deploying to remind you which pages to actually click. Maps the git diff to app sections via section-map.json, lists the routes touched. Replaces the homegrown invariants ecosystem with a thin git-diff reminder. Invoked via /q-post-deploy-check.
---

# q-post-deploy-check

## Purpose

Tell the user **which pages they should manually click after a deploy**, scoped to what actually changed. No browser-driven invariants. No codification. No automated assertions. The value here is the diff → routes mapping, not test execution.

## When to use

- After pushing to `staging` or `main`
- User says "post-deploy check", "verify deploy", "what should I click after this push", "did it work"

**Do not use** for full UX critique (that's `q-auditing-qualia`).

## Inputs

- `--since <git-ref>` (default `origin/main`) — diff base. The default covers everything on the current branch not yet on `main`, so the click-list reflects the full push, not just the last commit.
- `--env local|staging|prod` (default `staging`)

## Procedure

### 1. Diff inference

```
git fetch origin main --quiet
git diff <since>...HEAD --name-only
```

If `<since>` is `origin/main` and the fetch fails (offline / no remote), fall back to local `main` and note it in the report.

Filter to UI source paths (`src/pages/`, `src/components/`, `src/contexts/`) and AI-pipeline paths (`supabase/functions/_shared/analyze-*.ts`, `supabase/functions/_shared/synth-*.ts`, `supabase/functions/analyze-*/`, `supabase/functions/plugin-analyze/`, `supabase/functions/check-contrast/`).

### 2. Map files to sections

```bash
test -f qualia-skills/section-map.json || { echo "ERROR: qualia-skills/section-map.json is missing. This file maps changed paths to app sections. Either regenerate it or fix the path."; exit 1; }
```

Load `qualia-skills/section-map.json`. For each changed UI file, list every section whose path globs match.

Output:
- **affected_sections** — sections with at least one changed file
- **uncovered_paths** — changed UI files that match no section (indicates section-map drift)
- **ai_pipeline_changed** — boolean

Resolve sections to base routes (lookup by section name):

The `<E2E_TEST_PROJECT_ID>` placeholder reads from the `$E2E_TEST_PROJECT_ID` env var (sourced via `~/.secrets`). If unset, output the route as `[project ID needed — set E2E_TEST_PROJECT_ID]` instead of failing.

| Section | Route(s) to click on `--env` |
|---|---|
| `auth` | `/auth`, `/auth/callback` |
| `dashboard` | `/dashboard` |
| `project` | `/project/<E2E_TEST_PROJECT_ID>` |
| `audit-modal` | `/project/<id>` → click "Run Audit" |
| `audit-detail` | open any recent completed audit |
| `analytics` | `/analytics` |
| `settings` | `/settings` (each tab) |
| `plugin-touchpoints` | `/settings` (Plugin tab) |
| `changelog` | `/changelog` |

If the user adds a new section, add it here. If a route is missing for an existing section, ask once.

### 3. Skip case

If no UI or pipeline files changed:

```
No UI or pipeline code changed since <since>.
VERDICT: SKIP — nothing to click.
```

Exit.

### 4. Output

Write `tmp-qa/post-deploy/<timestamp>/report.md` and print:

```
Post-Deploy Check — <env> — HH:MM
Since: <since>  ·  Files changed (UI/pipeline): <count>

Click these pages:
  ✓ <section>  →  <route>
  ✓ <section>  →  <route>

Uncovered new code (section-map drift?):
  • <path>
  • <path>

→ tmp-qa/post-deploy/<timestamp>/report.md
```

If uncovered_paths is non-empty, **flag prominently** — section-map.json drifted; add the new path to a section in `qualia-skills/section-map.json`.

## What this skill explicitly does NOT do

- Run automated assertions on the live UI (no invariants, no string matching, no AI vision)
- Codify anything to a JSON file
- Drive a browser through complex flows (the prior version did this; it was brittle and not worth the cost)

If you want automated regression coverage, write Playwright tests in `tests/` against `data-testid` selectors.

## Common mistakes

| Mistake | Fix |
|---|---|
| Running this in place of a real test suite | This is a click-list reminder, not a test |
| Ignoring uncovered_paths | That's section-map drift; fix `section-map.json` so the next run is accurate |

## Maintenance

- When a new app section is added: edit `qualia-skills/section-map.json` AND the section→route table above.
- This skill has no DB writes, no codification step, no invariants file. If a future need re-introduces persistent assertions, write Playwright tests — don't rebuild the invariants ecosystem.
