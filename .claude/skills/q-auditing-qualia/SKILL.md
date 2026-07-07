---
name: q-auditing-qualia
description: Use when critically reviewing a Qualia screen, flow, prototype, or code path. Applies Qualia's production prompts (single-screen, flow, auto-crawl, prototype) as the model's own rubric — Claude IS the auditor. Invoked via /q-auditing-qualia.
---

# q-auditing-qualia

## Purpose

Apply Qualia's own production review framework to a screen, flow, prototype, or component. You ARE the auditor. The prompts in `supabase/functions/_shared/analyze-prompts.ts` are your system instructions — read them verbatim at runtime, do not paraphrase.

Output shape mirrors Qualia's so the user can diff your review against prior audits.

## When to use

- `/q-auditing-qualia <input>`
- "review this screen", "design review on dashboard", "audit this flow", "what would Qualia say"
- User wants Qualia's actual rubric applied — not a generic UX critique

## Inputs (exactly one)

| Flag | Meaning |
|---|---|
| `--screenshot <abs-path>` | Single PNG/JPEG |
| `--screenshots <p1>,<p2>,...` | Ordered flow |
| `--figma <url>` | Prototype URL or frame export dir |
| `--audit <id>` | Audit row in DB; reads inputs only |
| `--code <path-or-component>` | Review from source only, no images |
| `--live <route>` | Capture + review a live route |

Optional: `--personas power_user,spreadsheet_veteran,...` · `--language en|it` (default en) · `--accessibility-only`

## Procedure

### 1. Resolve input

**`--audit <id>`** — query Supabase with this exact column allow-list. **Never select the AI model's output columns.**

```sql
select id, project_id, source, screenshot_url, flow_images, screen_context,
       user_data, selected_personas, figma_file_key, figma_frame_names,
       reaudit_type, reaudit_user_note, follow_up_audit_id, created_at
from audits where id = '<id>';

select id, name, mission, persona, constraints, language
from projects where id = '<audit.project_id>';
```

**Forbidden columns**: `ai_report`, `analysis`, `executive_content`. Reading them defeats the purpose of this skill.

Download screenshots from `screenshot_url` (single) or `flow_images` JSON array (flow) into `tmp-qa/review/<timestamp>/inputs/`. For Supabase auth see memory `reference_supabase_service_key.md` and `reference_supabase_access_token.md`.

**`--screenshot` / `--screenshots`** — use the paths directly.

**`--figma`** — note the URL and any exported frame names; if a frame export dir is given, list its files in order.

**`--code`** — skip image loading. Run `grep -rn` + Read on the named component/page.

**`--live`** — navigate via Playwright (preferred) or a one-off browser-use call; screenshot to `inputs/`.

### 2. Select the prompt — read verbatim from source

| Input shape | Prompt | Source |
|---|---|---|
| 1 screenshot or `--code` on one screen | `SINGLE_SCREEN_PROMPT` | `supabase/functions/_shared/analyze-prompts.ts` |
| 2+ ordered screenshots | `FLOW_ANALYSIS_PROMPT` | same |
| Live multi-screen capture | `AUTO_CRAWL_PROMPT` | same |
| Figma prototype frames | `FIGMA_PROTOTYPE_CRAWL_PROMPT` | same |

If `--personas` is set, also read `SYNTH_MASTER_PROMPT` + matching `SYNTH_PERSONA_PROFILES` from `supabase/functions/_shared/synth-prompts.ts`. For flows, append `SYNTH_FLOW_ADDENDUM`.

**Read the file. Do not summarize the prompt.** It has been tuned in production; paraphrasing breaks calibration.

### 3. Substitute placeholders

The prompt uses `{project_mission}`, `{project_persona}`, `{project_constraints}`, `{screen_context}`, `{user_data_block}`, `{additional_context_block}`, `{previous_audit_feedback}`, `{contrast_data}`, `{project_language}`.

- `--audit`: pull from project + audit rows (allow-list above).
- Other inputs: ask the user once, in a single short message, for any missing context (mission, persona, screen goal). If they skip, use generic placeholders (`"General product"`, `"General users"`, `"None"`).
- `{contrast_data}`: write `"(contrast data unavailable — estimate visually with caution per prompt rules)"`. Never invent ratios.
- `{previous_audit_feedback}`: populate only if `reaudit_type` is set on the audit row.

### 4. Code-verify before drafting

If the input is `--audit`, `--code`, `--live`, or any case where the source repo is at hand:

- For each candidate finding (especially "missing loading/error/empty state", "no disabled state", "false affordance"), grep the relevant component and read the code.
- Drop findings the code refutes. T4.5 lesson — code is ~10× faster than navigate-screenshot-analyze.
- Run this concurrently with screenshot analysis, not sequentially after.

### 5. Apply the prompt as your own system instructions

The prompt is the rubric. Run the screenshots/code through it. Keep:

- **ALISSA filter** on every finding before inclusion (the prompt embeds this — follow it).
- **Steelman** each finding before flagging.
- **Principle required** for `cognitive` and `heuristic` engines (controlled list inside the prompt).
- **`box_2d`** on localized findings, `null` on general.
- **One Big Thing** identifies a structural root cause, not the most visible anomaly. If you'd describe it as "the page contains test data" or "the user's name is unusual", you've picked a symptom — try again.
- **Score calibration**: use the full 0–100 range. Clustering at 70–89 is a calibration failure.

### 6. Persona pass (if `--personas`)

Apply `SYNTH_MASTER_PROMPT` per persona. For each, output: first impression · top blocker · stay-or-leave verdict. Persona findings are additive — they don't replace the engines.

### 7. Output

Write to `tmp-qa/review/<timestamp>/`:

- `result.json` — full JSON in the prompt's specified shape (sub_scores, accessibility, engines, one_big_thing). For personas, add a `personas` object keyed by persona id.
- `report.md` — human-readable mirror of chat output.
- `inputs/` — every screenshot used.

Chat output (compact):

```
Qualia Review — <type> — HH:MM
Sub-scores: SL <n> · H <n> · C <n> · I <n>
Accessibility: <PASS | FAIL — N violations>
ONE BIG THING: <first 100 chars>...
Top finding per engine:
  SL: <issue>
  H:  <issue>
  C:  <issue>
  I:  <issue>
→ tmp-qa/review/<timestamp>/report.md
```

## Rules (load-bearing)

1. **Never read `ai_report`, `analysis`, or `executive_content`** when input is `--audit`. The SQL allow-list in step 1 is the contract.
2. **Always read the prompts from source files** — never inline a paraphrase.
3. **Code-first when code is available.** Don't screenshot to confirm something `grep` answers.
4. **Drop findings missing required principles** (cognitive/heuristic engines).
5. **OBT is a structural diagnosis** — not the loudest symptom on the screen.

## Common mistakes

| Mistake | Fix |
|---|---|
| `select * from audits` | Use the allow-list in step 1 — `select *` leaks the AI model's output |
| Paraphrasing the prompt inline | Read the file. The prompt is calibrated. |
| Skipping code verification | Code refutes ~30% of visual findings before they're drafted |
| OBT names a test-data artifact | OBT must be a structural cause that affects real users |
| Findings clustered 70–89 | Use the full range; mediocre = 50–65, exceptional = 90+ |
| Inventing contrast ratios | Leave `{contrast_data}` empty; the prompt handles "data unavailable" |

## Maintenance

- When `analyze-prompts.ts` changes, this skill auto-tracks — no edit needed.
- When `synth-prompts.ts` adds a persona, no edit needed.
- When the `audits` or `projects` table schema changes, update the SQL allow-list in step 1.
- The output shape is whatever the prompt specifies — auto-tracked.
