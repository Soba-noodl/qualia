---
name: q-code-audit
description: Codebase UX/UI judgment audit from source only — no screenshots. Claude reads forward-facing code (pages, components, edge/API handlers) and audits it through six engines (SL / H / C / I / D / X), producing a ranked overhaul backlog. The six engine rubrics are bundled in this skill's prompts/ folder. Invoked via /q-code-audit. For a screenshot/flow/prototype audit, use q-visual-audit.
---

# q-code-audit

## Purpose

A code-only, judgment-based UX/UI auditor. **You ARE the engine.** No SDK, no API key, no external model call. You (the Claude instance running this skill) read the six engine rubrics **verbatim** from this skill's `prompts/` folder, apply each as your own system instructions, read the relevant source files with the `Read` tool, and produce findings.

The rubrics are self-contained in this folder, so the skill works in any project once copied into `.claude/skills/`. They were tuned in production; **paraphrasing breaks their calibration** — read them, don't summarize them.

This complements `q-visual-audit` (screenshot / flow / prototype, one screen at a time). Where that skill looks at pixels, this one looks at the code that renders them.

## When to use

- `/q-code-audit <scope>`
- "audit the UX of the code", "ux overhaul", "find UX issues in the app", "where are the inconsistent loading states"
- The user wants a repo-wide or path-scoped UX audit driven from source, not from images

## Inputs

`/q-code-audit [scope]`

| Scope | Resolves to |
|---|---|
| (no args) | changed files vs. the default branch (`git diff --name-only main...`) |
| `full repo` / `everything` | the whole forward-facing surface |
| `<path>` | a single directory or file |
| `--feature <name>` | the files that make up one feature (you resolve which) |

"Forward-facing" = anything that renders UI or produces user-visible text: pages/routes, components, and the user-facing strings in API / edge handlers (toasts, validation messages, error copy). Skip pure infra, tests, and generated files.

## Procedure

### 1. Resolve scope → a list of routes/units to audit

Group the in-scope files into **audit units** — usually one per route or top-level screen, plus its owned components. If the project has an obvious router (e.g. `src/App.tsx`, a `pages/` or `app/` dir), walk it to map routes to their component files. Otherwise, treat each top-level page/screen file as a unit and pull in the components it imports.

Cap each unit at ~12 files / ~24,000 chars of concatenated source so a single engine pass stays within budget.

### 2. Read the engine rubrics verbatim

Read each file below with the `Read` tool. The body IS your system instructions for that engine — do not paraphrase.

| Engine | File | Lens |
|---|---|---|
| SL — System Logic & Flow | `prompts/sl.txt` | State, feedback, error handling, flow logic |
| H — Heuristic & Navigation | `prompts/h.txt` | Usability heuristics, navigation, IA |
| C — Cognitive & Visual | `prompts/c.txt` | Cognitive load, visual hierarchy |
| I — Interaction Cost | `prompts/i.txt` | Steps, decisions, input effort |
| D — Designer Lens | `prompts/d.txt` | Senior-designer judgment |
| X — Cross-sectional / Coherence | `prompts/x.txt` | Whole-codebase coherence (run once) |

### 3. Substitute placeholders

The per-route engines (SL / H / C / I / D) use:

| Placeholder | Value |
|---|---|
| `{framework}` | the unit's stack, e.g. `"React 18, react-router-dom v6, @tanstack/react-query v5, shadcn/ui"`. Ask the user once if it's not obvious from the code; otherwise infer it from imports. |
| `{routeContext}` | `<route path or screen name> (entry: <entry file>)` |
| `{code}` | the concatenated source of the unit's files, each preceded by a `// FILE: <path>` header |

Engine X uses:

| Placeholder | Value |
|---|---|
| `{routeFindingsSummary}` | a bullet list aggregating the per-route findings (cap ~200 lines) |
| `{componentGraphSummary}` | a bullet list of shared UI/component files with their key class strings + design-system imports (cap ~250 lines). Build it by reading the shared component files. |

### 4. Per-route engine pass (SL / H / C / I / D)

For each audit unit:

1. Read its files via the `Read` tool and concatenate into `{code}` with `// FILE: <path>` separators.
2. For each engine in {SL, H, C, I, D}: apply the rubric as your own system instructions, with placeholders substituted. Honor everything it specifies — the ALISSA filter, steelman step, score calibration, required principles, and JSON output shape.
3. Parse the JSON you produced. (You generated it; you parse it.)
4. Combine the five engines' findings for the unit. Give each a stable id: `UX-<ENGINE>-<UNIT-SLUG>-<NNN>`.
5. **Code-verify before keeping a finding.** For any "missing loading/error/empty state", "no disabled state", "false affordance" — grep/Read the component and drop findings the code refutes (e.g. an `onError` handler that is in fact wired). Code refutes a meaningful share of guesses.

### 5. Engine X (full / multi-route scope only)

If the scope covers more than a couple of routes:

1. Aggregate the per-route findings into `{routeFindingsSummary}`.
2. Build `{componentGraphSummary}` from the shared component files (up to ~4 class strings and ~4 design-system imports each).
3. Apply `X_PROMPT` with both substituted; produce JSON per its output spec.

For a narrow single-unit scope, skip Engine X and note: _"Engine X skipped — partial scope. Run `/q-code-audit full repo` for cross-sectional analysis."_

### 6. Importance ranking

For every finding:
- `severityWeight`: critical=4, high=3, medium=2, low=1
- `reachBand`: reach ≤1 → 1, reach ≤3 → 1.5, reach ≤9 → 2, reach >9 → 3
- `importance = severityWeight × reachBand`

Sort by importance desc; tiebreak by severity, then reach.

### 7. Output

Write to a local `code-audit/<timestamp>/` directory:

- `per-route/<unit-slug>.json` + `.md` — your raw output per unit (SL/H/C/I/D)
- `cross-sectional.md` — Engine X output, or the "skipped" note
- `findings.json` — aggregated, with `importance`
- `findings-ranked.md` — importance-ordered
- `overhaul-backlog.md` — the top ~15, each with a one-line fix and an impact × effort read

Then a compact chat summary:

```
q-code-audit — <scope> — HH:MM
<unit-count> units audited · <finding-count> findings
By engine: SL=<n> · H=<n> · C=<n> · I=<n> · D=<n> · X=<n or "skipped">
Top finding (by importance):
  [<engine>/<severity>] <experience, first line>
  → fix: <fix, first line>
→ code-audit/<timestamp>/findings-ranked.md
```

## Rules (load-bearing)

1. **Read the rubric files from `prompts/` verbatim** — never inline a paraphrase. The engine bodies are calibrated.
2. **You are the engine.** No SDK, no API key, no `Anthropic` instance. The `Read` tool gets you the code; the rubric body gets you the lens; you produce the findings.
3. **Code-first.** Drop findings the code refutes before drafting them.
4. **Drop findings missing a required principle** (the heuristic and cognitive engines require a named principle from their controlled list).
5. **Use the full 0–100 score range.** Clustering at 70–89 is a calibration failure (mediocre = 50–65, exceptional = 90+).

## Common mistakes

| Mistake | Fix |
|---|---|
| Paraphrasing the engine prompts | Read the file. The constants are calibrated. |
| Calling out to an Anthropic SDK | This skill runs through Claude — that's you. No SDK. |
| Skipping code verification | Always Read the file before flagging a missing handler. |
| Findings clustered 70–89 | Use the full range; mediocre = 50–65, exceptional = 90+. |
| Auditing screenshots here | That's `q-visual-audit`. This skill is source-only. |

## About these engines

These are Qualia's actual production engine rubrics, extracted verbatim. The annotated, human-readable versions are in the parent repo's `engines/` directory. The full source (and the original application) lives at [`Soba-noodl/qualia`](https://github.com/Soba-noodl/qualia).
