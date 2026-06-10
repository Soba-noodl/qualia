---
name: q-auditing-general
description: Use when auditing any interface — screenshot, flow, Figma prototype, or live route. Applies Qualia's production prompts as Claude's own rubric (ALISSA filter, 4 engines, calibrated 0–100 scoring). Trigger: /q-auditing-general, "audit this screen", "review this design", "run a UX audit on".
---

# q-auditing-general

Claude applies Qualia's production rubric to any interface. Works on any product — not just Qualia.

## When to use

- `/q-auditing-general --screenshot <path>`
- "audit this screen", "review this design", "what would Qualia say about this"
- You have a screenshot, flow, Figma URL, or live route and want a structured UX audit

**Not for:** reviewing Qualia's own codebase or DB-backed audit records — use `q-auditing-qualia` for that.

## Inputs (exactly one required)

| Flag | Meaning |
|---|---|
| `--screenshot <abs-path>` | Single PNG/JPEG |
| `--screenshots <p1,p2,...>` | Ordered flow (2+ files) |
| `--figma <url>` | Figma prototype or file URL — fetched via Figma API |
| `--live <route>` | Live route — captured via browser-use, then audited |

## Optional context (reference)

`--mission <text>` · `--persona <text>` · `--constraints <text>` · `--screen-goal <text>`

These are gathered in Step 1 of the Procedure (after rubric verification). If any are missing, ask once in a single short message. If the user skips, use: `"General product"`, `"General users"`, `"None"`, `"General screen"`.

## Figma API

1. Read token: `echo $FIGMA_TOKEN_1`. Fall back to `FIGMA_TOKEN_2` if empty, 429, or 401.
2. Extract file key from URL: segment after `/proto/` or `/file/` — e.g. `https://www.figma.com/proto/<FILE_KEY>/...`
3. Fetch metadata: `GET https://api.figma.com/v1/files/<FILE_KEY>` with header `X-Figma-Token: <token>`
4. Collect frame node IDs from the document in order.
5. Export as PNG: `GET https://api.figma.com/v1/images/<FILE_KEY>?ids=<comma-separated-node-ids>&format=png&scale=2`
6. Download each PNG to `tmp-qa/q-auditing-general/<timestamp>/captures/`. Read with the Read tool.

If the file is inaccessible: stop and report "Figma file not accessible — check that FIGMA_TOKEN_1/2 has read access to this file."

## Procedure

### 0. Verify rubric file

```bash
ls supabase/functions/_shared/analyze-prompts.ts
```

If missing: stop and report "q-auditing-general requires the Qualia repo — `supabase/functions/_shared/analyze-prompts.ts` not found."

### 1. Gather optional context and resolve input

If `--mission`, `--persona`, `--constraints`, or `--screen-goal` are missing, ask once in a single short message. If the user skips, use: `"General product"`, `"General users"`, `"None"`, `"General screen"`.

Then resolve the input:
- `--live <route>`: navigate via browser-use, screenshot to `tmp-qa/q-auditing-general/<timestamp>/captures/screen.png`
- `--figma <url>`: fetch frames via Figma API (see above)
- `--screenshot` / `--screenshots`: use paths directly

Create output dir: `mkdir -p tmp-qa/q-auditing-general/<timestamp>/captures`

### 2. Select and read prompt verbatim

Read `supabase/functions/_shared/analyze-prompts.ts`. Select:

| Input | Prompt constant |
|---|---|
| 1 image | `SINGLE_SCREEN_PROMPT` |
| 2+ images | `FLOW_ANALYSIS_PROMPT` |
| Figma frames | `FIGMA_PROTOTYPE_CRAWL_PROMPT` |

**Read the file. Do not paraphrase or summarize the prompt.** It is calibrated in production; paraphrasing breaks calibration.

### 3. Substitute placeholders

| Placeholder | Value |
|---|---|
| `{project_mission}` | `--mission` or `"General product"` |
| `{project_persona}` | `--persona` or `"General users"` |
| `{project_constraints}` | `--constraints` or `"None"` |
| `{screen_context}` | `--screen-goal` or `"General screen"` |
| `{contrast_data}` | `"(contrast data unavailable — estimate visually with caution per prompt rules)"` |
| `{previous_audit_feedback}` | `""` (always empty) |
| `{user_data_block}` | `""` (always empty) |
| `{additional_context_block}` | `""` (always empty) |

### 4. Apply prompt as own system instructions

The prompt is the rubric. Run the images through it:
- ALISSA filter on every finding before inclusion
- Steelman each finding before flagging
- Principle required for `heuristic` and `cognitive` engines — drop finding if no principle applies
- Bounding boxes (`[ymin, xmin, ymax, xmax]` on 0–1000 scale) on localized findings, omit on general
- ONE BIG THING = structural root cause, not the most visible symptom
- Score calibration: full 0–100 range; clustering at 70–89 is a calibration failure

### 5. Output

Write `tmp-qa/q-auditing-general/<timestamp>/report.md` and print:

```
# q-auditing-general — <type> — HH:MM

Overall: <n>
Sub-scores: SL <n> · H <n> · C <n> · I <n>

## ONE BIG THING
<structural root cause — not a symptom>

## Accessibility
<PASS or FAIL — N violations. Each: element · WCAG criterion · description>

## System Logic & Flow
<findings. Each: severity · description → user experience → business consequence · bounding box if localized>

## Heuristic & Navigation
<findings. Each must name a heuristic principle.>

## Cognitive & Visual
<findings. Each must name a cognitive principle.>

## Interaction Cost
<findings.>

→ tmp-qa/q-auditing-general/<timestamp>/report.md
```

## What this skill does NOT do

- No Supabase queries, no service key, no `--audit <id>` input
- No Qualia-specific wiring of any kind

## Common mistakes

| Mistake | Fix |
|---|---|
| Paraphrasing the prompt | Read the file verbatim — it is production-calibrated |
| Scores clustered 70–89 | Use full range; mediocre = 50–65, exceptional = 90+ |
| OBT names a symptom | OBT must be a structural cause affecting real users |
| Heuristic/cognitive finding without a principle | Drop it — opinions without principles are not findings |
| Inventing contrast ratios | Use the unavailable template — never invent numbers |
