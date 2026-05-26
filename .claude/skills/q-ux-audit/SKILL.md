---
name: q-ux-audit
description: Codebase UX/UI judgment audit. You ARE the engine — Claude reads forward-facing code (src/, supabase/functions/, figma-plugin/), classifies + audits with six engines (SL/H/C/I/D/X), produces a ranked overhaul backlog. Triggers on /q-ux-audit, "audit the UX", "ux overhaul", "find UX issues".
---

# /q-ux-audit

A code-only judgment-based UX/UI auditor. **You are the auditor.** A small TS helper enumerates the codebase and pre-computes deterministic findings; you (the Claude instance running this skill) read the rubric prompts verbatim from `scripts/ux-audit/prompts/*.ts`, apply them as your own system instructions, read each candidate file via the `Read` tool, and produce findings.

No SDK, no API key, no external model call. Same engine pattern as `q-auditing-general` / `q-auditing-qualia` (which read `supabase/functions/_shared/analyze-prompts.ts` verbatim).

This complements:
- `q-compliance` — deterministic rule enforcement (tokens, a11y mechanics, types)
- `q-auditing-general` / `q-auditing-qualia` — screenshot-based, one screen/flow at a time

## When to use

- "Find every UX problem in the app." (full repo sweep)
- "Audit the UX of what I just changed." (default scope = `--since main`)
- "Where are the redundant flows / inconsistent loading states?" (Engine X)

## Inputs

`/q-ux-audit [scope] [flags]`

| Input | Resolves to |
|---|---|
| (no args) | `--since main` (changed files only) |
| `full repo` / `everything` / `--full` | full repository |
| `--feature <name>` | scoped to one feature (per `feature-map.json`) |
| `<path>` | path-scoped |

| Flag | Effect |
|---|---|
| `--coverage-only` | emit coverage manifest, exit |
| `--personas <list>` | reserved (additive persona pass) |

## Procedure

### 0. Verify rubric files

```bash
missing=""
for f in sl.ts h.ts c.ts i.ts d.ts x.ts; do
  test -f scripts/ux-audit/prompts/$f || missing="$missing $f"
done
if [ -n "$missing" ]; then
  echo "q-ux-audit requires the Qualia repo — missing prompt files:$missing in scripts/ux-audit/prompts/"
  exit 1
fi
```

### 1. Run the prepare script

```bash
npm run ux-audit:prepare -- [scope]
```

This is the local-only enumeration step. It:
- Resolves scope (since-main / full / feature / path)
- Classifies every file in scope
- Walks routes from `src/App.tsx` (per-route component file lists)
- Extracts corpora (toasts, edge-fn user-facing strings, validation messages, titles)
- Runs the dead-state detector (deterministic — no model needed)
- Writes everything to `tmp-qa/q-ux-audit/<timestamp>/`

It prints the output dir path and a summary. Capture the timestamp dir — call it `<OUT>`.

If the scope resolves to `--coverage-only`, stop here and report `<OUT>/coverage-manifest.md`.

### 2. Read the rubric prompts verbatim

Read each prompt file with the `Read` tool. The body of the exported constant IS your system instructions for that engine — do not paraphrase.

| Engine | File | Constant |
|---|---|---|
| SL — System Logic & Flow | `scripts/ux-audit/prompts/sl.ts` | `SL_PROMPT` |
| H — Heuristic & Navigation | `scripts/ux-audit/prompts/h.ts` | `H_PROMPT` |
| C — Cognitive & Visual | `scripts/ux-audit/prompts/c.ts` | `C_PROMPT` |
| I — Interaction Cost | `scripts/ux-audit/prompts/i.ts` | `I_PROMPT` |
| D — Designer Lens | `scripts/ux-audit/prompts/d.ts` | `D_PROMPT` |
| X — Cross-sectional / Coherence | `scripts/ux-audit/prompts/x.ts` | `X_PROMPT` |

### 3. Substitute placeholders

Each per-route prompt has these placeholders:

| Placeholder | Value |
|---|---|
| `{framework}` | `"React 18, react-router-dom v6, @tanstack/react-query v5, supabase-js, sonner toasts, shadcn/ui (radix-based)"` |
| `{routeContext}` | `<route.path> (entry: <route.entryFile>)` |
| `{code}` | concatenated source of the per-route component files (file paths in `// FILE: <path>` headers) |

For Engine X:

| Placeholder | Value |
|---|---|
| `{routeFindingsSummary}` | bullet list aggregating per-route findings (cap ~200 lines) |
| `{componentGraphSummary}` | bullet list of `ux:component` files with their className strings + `@/components/ui/*` imports (cap ~250 lines) |

### 4. Per-route engine pass (SL / H / C / I / D)

Read `<OUT>/files-to-audit.json`. For each entry in `perRoute` with a non-null `entryFile`:

1. Read each `componentFiles[i]` via the `Read` tool (cap at ~12 files / ~24,000 chars total per route — match the previous corpus budget).
2. Concatenate them into `{code}` with `// FILE: <path>` separators.
3. For each engine in {SL, H, C, I, D}:
   - Apply the prompt as own system instructions, with placeholders substituted.
   - Run the rubric: ALISSA filter, steelman, calibration, JSON output shape.
   - Parse the JSON output you produced. (You generated it; you parse it.)
4. Combine the five engines' findings. Tag each finding with a stable id (`UX-<engine>-<ROUTE-SLUG>-<NNN>`).
5. Write `<OUT>/per-route/<route-slug>.json` (your raw output) and `<route-slug>.md` (rendered).

### 5. Corpus passes

Read each `<OUT>/corpora/*.json`. For each corpus, apply the appropriate lens:

- `toasts.json` — apply Engine H lens: tone consistency, outcome-naming, success-vs-error voice.
- `edge-fn.json` — apply Engine SL + H lens: error message clarity, presence of recovery hints.
- `validation.json` — apply Engine H lens: outcome-named, actionable, free of internal jargon.
- `titles.json` — apply Engine C lens: title pattern consistency across routes.

Findings here are corpus-level — anchor them to the file paths/lines in the corpus entries.

### 6. Dead-state findings

Already pre-computed. Read `<OUT>/dead-state-findings.json` and merge into the global findings list. No model judgment needed.

### 7. Engine X (full scope only)

If `files-to-audit.json` has `engineXEligible: true`:

1. Aggregate per-route findings into `{routeFindingsSummary}` (one bullet per finding, capped).
2. Build `{componentGraphSummary}` from `uxComponentFiles`: for each file, read it (or batch-read), extract up to 4 `className="..."` strings and up to 4 `import { ... } from '@/components/ui/...'` lines.
3. Apply `X_PROMPT` with both substituted. Produce JSON per the prompt's output spec.
4. Write `<OUT>/cross-sectional.json` + `cross-sectional.md`.

If `engineXEligible: false`, write `cross-sectional.md` with:

> _Engine X skipped: partial scope. Run `/q-ux-audit full repo` for cross-sectional analysis._

### 8. Importance ranking

For every finding:
- `severityWeight`: critical=4, high=3, medium=2, low=1
- `reachBand`: reach≤1→1, reach≤3→1.5, reach≤9→2, reach>9→3
- `importance = severityWeight × reachBand`

Sort by importance desc, tiebreak by severity then reach. (Same formula as `scripts/ux-audit/importance.ts`.)

### 9. Write final reports

Compose markdown using the same shapes the existing reporters in `scripts/ux-audit/reporters/` produce. You can either:
- Read the reporter source and reproduce its output shape inline, or
- Pipe your aggregated findings JSON through the reporter via a one-shot `tsx` invocation.

Final output tree:

```
tmp-qa/q-ux-audit/<timestamp>/
├── coverage-manifest.md          # written by prepare.ts
├── files-to-audit.json           # written by prepare.ts (input to this skill)
├── corpora/{toasts,edge-fn,validation,titles}.json   # written by prepare.ts
├── dead-state-findings.json      # written by prepare.ts (deterministic)
├── per-route/<route>.{json,md}   # written by you (SL/H/C/I/D per route)
├── findings.json                 # written by you (aggregated, with importance)
├── findings-ranked.md            # written by you (importance-ordered)
├── per-feature.md                # written by you (grouped by feature-map.json)
├── cross-sectional.md            # written by you (Engine X or "skipped")
├── dead-state.md                 # rendered from dead-state-findings.json
└── overhaul-backlog.md           # written by you (top-15 with impact × effort)
```

### 10. Final chat output

```
q-ux-audit — <scope-description> — HH:MM

<route-count> routes audited · <finding-count> findings
By engine: SL=<n> · H=<n> · C=<n> · I=<n> · D=<n> · X=<n or "skipped">

Top finding (by importance):
  [<engine>/<severity>] <experience first-line>
  → fix: <fix first-line>

→ <OUT>/findings-ranked.md
```

## Token budget & multi-pass strategy

| Mode | Routes | Estimated tokens | Notes |
|---|---|---|---|
| Recommended per session | 3–5 routes | ~15–25k | Comfortable single-pass |
| Medium scope | 6–15 routes | ~40–80k | Still single-pass, budget tighter |
| Full-repo (27+ routes) | all | ~150k minimum | Multi-pass required |

### Multi-pass strategy for full-repo runs

A single-shot full-repo audit is technically possible but burns ~150k tokens minimum and risks context overflow on larger codebases. Preferred approach:

1. **Importance-only first pass** — run Engine SL/H/C/I/D on all routes with a condensed prompt (just flag the hotspots, no full write-up). Identify the top-N routes by finding count + severity.
2. **Deep-dive second pass** — run the full per-route audit (all 5 engines, ALISSA filter, steelman, score calibration) on the top-N hotspot routes identified in pass 1.
3. **Engine X** — run once on the aggregated findings from pass 2, not all routes.

Use `npm run ux-audit:digest` to aggregate pass-1 findings before running Engine X. Use `npm run ux-audit:rank` to sort and identify the hotspots for pass 2.

### Per-route template

Every prepare run writes `tmp-qa/q-ux-audit/<ts>/per-route/_template.json`. This is the expected output shape for each per-route audit file Claude writes. Read it at step 4 to confirm the output schema before writing the first route file.

## Rules (load-bearing)

1. **Read the prompt files verbatim.** The bodies of `SL_PROMPT`, `H_PROMPT`, `C_PROMPT`, `I_PROMPT`, `D_PROMPT`, `X_PROMPT` are calibrated — paraphrasing breaks calibration.
2. **You are the engine.** No SDK, no API key, no `Anthropic` instance. The `Read` tool gets you the code; the prompt body gets you the rubric; you produce findings.
3. **Code-first when code is available.** Drop findings the code refutes (e.g. "no error handler" when `onError` is in fact wired).
4. **Drop findings missing required principles** (heuristic / cognitive engines need a named principle).
5. **Use the full 0–100 score range.** Clustering at 70–89 is a calibration failure.

## What this skill does NOT do

- No screenshots, no Playwright, no dev server. Code only.
- No deterministic rule enforcement (that's `q-compliance`).
- No "ONE BIG THING" synthesis — every finding rendered, ordered by importance.

## Common mistakes

| Mistake | Fix |
|---|---|
| Paraphrasing the engine prompts | Read the file. The constants are calibrated. |
| Calling out to an Anthropic SDK | This skill runs through Claude — that's you. No SDK. |
| Findings clustered 70–89 | Use the full range; mediocre = 50–65, exceptional = 90+ |
| Skipping code verification | Always Read the file before flagging missing handlers |

## Spec

Full design at `docs/superpowers/specs/2026-05-08-q-ux-audit-design.md`.
Implementation plan at `docs/superpowers/plans/2026-05-08-q-ux-audit.md`.
Code at `scripts/ux-audit/`.
