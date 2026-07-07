---
name: q-visual-audit
description: Critically review a screen, flow, or prototype using Qualia's production UX-audit rubric. Applies Qualia's actual image prompts (single-screen, flow, auto-crawl, prototype) as the model's own system instructions — Claude IS the auditor. Invoked via /q-visual-audit. For a source-code audit, use q-code-audit.
---

# q-visual-audit

## Purpose

Apply Qualia's production review framework to a screen, flow, prototype, or component. **You ARE the auditor.** The prompts bundled in this skill's `prompts/` folder are your system instructions — read them verbatim at runtime, do not paraphrase. They were tuned in production; paraphrasing breaks their calibration.

The prompts are self-contained in this folder, so the skill works in any project once copied into `.claude/skills/`.

## When to use

- `/q-visual-audit <input>`
- "review this screen", "design review on the dashboard", "audit this flow", "what would Qualia say"
- The user wants a rigorous, business-critical UX audit of a **screen, flow, or prototype**, not a generic critique
- For a **source-code** audit (no images — reads `src/` through six engines), use `q-code-audit` instead.

## Inputs (exactly one)

| Flag | Meaning |
|---|---|
| `--screenshot <path>` | Single PNG/JPEG |
| `--screenshots <p1>,<p2>,...` | Ordered flow (2+ images) |
| `--figma <url-or-dir>` | Prototype URL, or a directory of exported frames |
| `--live <url>` | Capture the live page (Playwright), then review |

Optional: `--persona "<short description>"` (role-play a specific user) · `--language en|it` (default en) · `--accessibility-only`

## Procedure

### 1. Resolve input

- **`--screenshot` / `--screenshots`** — use the paths directly. First image is the audit TARGET; any later images are context only.
- **`--figma`** — note the URL and frame names; if a directory is given, list its image files in order.
- **`--live`** — navigate with Playwright and screenshot the page(s) to a local `inputs/` dir.

### 2. Select the prompt — read it verbatim from this skill's `prompts/`

| Input shape | Prompt file |
|---|---|
| 1 screenshot | `prompts/single-screen.txt` |
| 2+ ordered screenshots | `prompts/user-flow.txt` |
| Live multi-screen capture | `prompts/auto-crawl.txt` |
| Figma prototype frames | `prompts/figma-prototype.txt` |

If `--persona` is set, also read `prompts/synthetic-users.txt`.

**Read the file. Do not summarize it.** The prompt is your rubric, verbatim.

### 3. Substitute placeholders

The prompts use `{placeholders}` such as `{project_mission}`, `{project_persona}`, `{project_constraints}`, `{screen_context}`, `{user_data_block}`, `{additional_context_block}`, `{previous_audit_feedback}`, `{contrast_data}`, `{project_language}`.

- Ask the user **once**, in a single short message, for any missing context (product mission, target persona, screen goal).
- If they skip it, use generic values (`"General product"`, `"General users"`, `"None"`).
- `{contrast_data}`: write `"(contrast data unavailable — estimate visually with caution per prompt rules)"`. **Never invent ratios.**
- `{previous_audit_feedback}`: leave empty unless the user supplies a prior audit.

### 4. Code-verify before drafting (when source is available)

For `--live`, or any case where the source of the audited screen is at hand:

- For each candidate finding (especially "missing loading/error/empty state", "no disabled state", "false affordance"), grep the relevant component and read the code.
- **Drop findings the code refutes.** Code is roughly 10× faster than navigate-screenshot-analyze, and it refutes a meaningful share of visual guesses.
- Run this concurrently with screenshot analysis, not sequentially after.

### 5. Apply the prompt as your own system instructions

The prompt is the rubric. Run the screenshots/code through it, honoring everything it specifies — in particular:

- **Steelman** each finding before flagging it.
- **Principle required** for `cognitive` and `heuristic` findings (the controlled list is inside the prompt).
- **`box_2d`** on localized findings, `null` on general ones.
- **One Big Thing** must name a structural root cause, not the loudest visible anomaly. If you'd phrase it as "the page contains test data" or "the user's name is unusual", you've picked a symptom — try again.
- **Score calibration:** use the full 0–100 range. Clustering at 70–89 is a calibration failure (mediocre = 50–65, exceptional = 90+).

### 6. Persona pass (if `--persona`)

Apply `prompts/synthetic-users.txt`, role-playing the persona the user described. Output: first impression · top blocker · stay-or-leave verdict. Persona findings are additive — they don't replace the rubric findings.

### 7. Output

Write to a local `qualia-review/<timestamp>/` directory:

- `result.json` — full JSON in the shape the prompt specifies (sub_scores, accessibility, findings, one_big_thing). For a persona pass, add a `persona` object.
- `report.md` — human-readable version.
- `inputs/` — every screenshot used.

Then a compact chat summary:

```
Qualia Review — <type> — HH:MM
Sub-scores: SL <n> · H <n> · C <n> · I <n>
Accessibility: <PASS | FAIL — N violations>
ONE BIG THING: <first 100 chars>...
Top finding per sub-score:
  SL: <issue>
  H:  <issue>
  C:  <issue>
  I:  <issue>
→ qualia-review/<timestamp>/report.md
```

## Rules (load-bearing)

1. **Always read the prompt from `prompts/` verbatim** — never inline a paraphrase. It is calibrated.
2. **Code-first when code is available.** Don't screenshot to confirm something `grep` answers.
3. **Drop findings missing a required principle** (cognitive/heuristic).
4. **One Big Thing is a structural diagnosis** — not the loudest symptom on the screen.
5. **Never invent contrast ratios.** Leave `{contrast_data}` empty; the prompt handles "data unavailable".

## Common mistakes

| Mistake | Fix |
|---|---|
| Paraphrasing the prompt inline | Read the file. The prompt is calibrated. |
| Skipping code verification | Code refutes a large share of visual findings before they're drafted |
| OBT names a test-data artifact | OBT must be a structural cause that affects real users |
| Findings clustered 70–89 | Use the full range; mediocre = 50–65, exceptional = 90+ |
| Inventing contrast ratios | Leave `{contrast_data}` empty; the prompt handles it |

## About these prompts

These are Qualia's actual production prompts, extracted verbatim. The full source (and the original application) lives at [`Soba-noodl/qualia`](https://github.com/Soba-noodl/qualia). The annotated, human-readable versions of every prompt are in the parent repo's `prompts/` directory.
