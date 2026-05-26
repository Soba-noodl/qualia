# Architecture

## System Overview

Qualia is a SaaS for UX/accessibility audits. Teams create projects, upload screenshots or connect Figma files, and receive AI-powered audit reports. A Figma plugin enables in-app capture and submission.

Backend is **fully hosted on Supabase cloud** — no local DB or server setup needed for frontend development. Project: `zujbauyrpisjdqmjhmgr.supabase.co`. Environment variables live in `.env` at the repo root; all `VITE_*` vars are public client-side keys.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| Routing | `react-router-dom` v6 (`<BrowserRouter>` in `src/App.tsx`) |
| Server state | TanStack Query; query keys in `src/lib/query-keys.ts` |
| Backend | Supabase: Postgres + Edge Functions (Deno runtime) |
| AI | Google Gemini via `supabase/functions/_shared/analyze-run.ts` |
| Auth | Supabase Auth (email + OAuth) |
| Storage | Supabase Storage (audit screenshots) |
| Hosting | Vercel (frontend), Supabase (backend) |
| Figma Plugin | Separate Vite app in `figma-plugin/` with its own `package.json` |

## Key Architectural Decisions

### Edge Functions over API routes
Supabase Edge Functions run on Deno at the edge, close to the database. Auth and RLS enforcement is seamless via the shared Supabase client context. AI calls (Gemini) stay server-side — protecting API keys and avoiding browser CORS issues.

### Supabase for everything backend
Hosted Postgres + built-in auth + RLS + real-time + storage in one service. RLS policies enforce data isolation at the DB level. Component-level auth checks are defense-in-depth, not the primary control.

### Shared Edge Function modules
`supabase/functions/_shared/` centralises cross-function logic:
- `analyze-run.ts` — Gemini model name + `callAiAndParse()`
- `plugin-token.ts` — validate `X-Plugin-Token` headers
- `quota-check.ts` — per-user AI quota enforcement
- `log-error.ts` — structured error logging to `error_events` table
- `figma-token.ts`, `integration-tokens.ts` — third-party token management

Always check `_shared/` before adding new logic to individual functions.

### Figma Plugin two-runtime isolation
- **Sandbox** (`figma-plugin/src/code.ts`) — Figma API, no DOM, no external `fetch`
- **UI** (`figma-plugin/src/ui/`) — React iframe, DOM + `fetch`, no Figma API

They communicate exclusively via `figma.ui.postMessage()` / `parent.postMessage()`.

## System Boundaries

```
Browser (React app)
  └─ src/services/ → Supabase JS client → Postgres (RLS enforced)
  └─ src/services/ → supabase.functions.invoke() → Edge Functions → Gemini API

Figma Plugin (Sandbox)
  └─ postMessage → Plugin UI (React)
  └─ Plugin UI → fetch() → Edge Functions (X-Plugin-Token auth)
```

## /q-compliance — Deterministic codebase linter (Skill 1)

`/q-compliance` makes the Hard Rules in `agent_docs/design-system.md` and
`agent_docs/conventions.md` executable. The skill exists because:

1. The codebase has 100+ deterministic rules (token compliance, accessibility
   mechanics, security patterns, architectural boundaries, type safety, async
   hygiene) that were enforced only by social convention.
2. The two recently-overhauled rule docs now contain Hard Rules tables with
   stable IDs, detect-by hints, and severities — they are the source of truth.
3. Without a runner, the tables drift from reality.

### Architecture

Hybrid: ESLint plugin + custom runner + jsx-a11y. Each rule row in the Hard
Rules tables declares its engine via the `Engine` column.

| Engine | Owns | Why |
|---|---|---|
| `qualia-compliance` ESLint plugin (`scripts/compliance/eslint-plugin/`) | Per-file AST rules | IDE squiggles, autofix infra, CI |
| `eslint-plugin-jsx-a11y` | Mechanical accessibility rules | Battle-tested |
| Custom runner (`scripts/compliance/runners/runner.ts`) | Cross-file / corpus rules | Translation key existence, contrast, secrets |
| WCAG calculator (`scripts/compliance/contrast.ts`) | Token-pair contrast | Pure CSS-var resolution |

The orchestrator is `scripts/compliance/run.ts`. It:

1. Resolves scope (full repo / since main / since ref / path).
2. Reads the rule registry from both Hard Rules tables (`parse-rules.ts`).
3. Runs each engine, normalises findings, applies waivers, filters by severity.
4. Writes reports to `tmp-qa/q-compliance/<timestamp>/`.

### Where the code lives

- `scripts/compliance/` — orchestrator, parsers, runner, reporters, fix
- `scripts/compliance/eslint-plugin/` — local ESLint plugin (CommonJS)
- `scripts/compliance/runner-rules/` — per-rule custom logic (`*.ts`)
- `agent_docs/design-system.md` and `agent_docs/conventions.md` — rule SOT
- `.claude/skills/q-compliance/SKILL.md` — skill definition
- `docs/superpowers/specs/2026-05-08-q-compliance-design.md` — spec

### How to add a rule

1. Add a row to the appropriate Hard Rules table.
2. `npm run lint:rules` — validates syntax.
3. Implement the detection in the chosen engine.
4. Confirm with `/q-compliance --include-warn`.

See the spec for the full design (waivers, autofix gate, idempotency).

## /q-ux-audit — Code-only UX/UI auditor (Skill 2)

Code-only judgment-based UX/UI auditor. Reads `src/`, `supabase/functions/`,
`figma-plugin/src/`, classifies each file, applies five engines (SL/H/C/I per
route, X cross-sectional), produces a ranked overhaul backlog.

**Architecture:** Walk → Classify → Audit.
- **Walk:** file glob over the forward-facing codebase (self-maintaining; new code auto-included).
- **Classify:** pure function tags each file as `ux:component | ux:export | ux:strings | ux:validation | ux:metadata | skip:* | unknown`.
- **Audit:** `ux:*` files run through engine prompts with calibrated examples; `skip:*` is excluded; `unknown` flagged in coverage manifest.

**Engines:**
- SL/H/C/I run per route (route discovered via `<Route>` traversal of `src/App.tsx`).
- X (cross-sectional) runs once globally on aggregated findings — only on `--full` scope; skipped on partial scopes with explicit note.

**Cache:** content-hash + prompt-version keyed JSON at `tmp-qa/q-ux-audit/cache.json`. Bumping `PROMPT_VERSION` in `scripts/ux-audit/classifier.ts` invalidates everything.

**Importance ranking:** `severity_weight (1..4) × reach_band (1..3)`. Bands saturate (10+ affected = 3×) so X findings don't drown per-route findings.

**Code:** `scripts/ux-audit/`. CLI: `npm run ux-audit -- [scope] [flags]`.
**Skill:** `.claude/skills/q-ux-audit/SKILL.md`.
**Spec:** `docs/superpowers/specs/2026-05-08-q-ux-audit-design.md`.
**Plan:** `docs/superpowers/plans/2026-05-08-q-ux-audit.md`.
