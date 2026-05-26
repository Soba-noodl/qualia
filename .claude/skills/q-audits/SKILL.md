---
name: q-audits
description: Meta-analysis of Qualia audit quality. Fetches real user audits (excluding the operator's accounts by default), views screens, and diagnoses prompt strengths/weaknesses — false positives, false negatives, score calibration, score drift, persona influence, design system/accessibility accuracy, recurring patterns. Trigger: /q-audits, "/q-audits <N> [type] [mode] [source] [date] [strategy] [mine?]", "analyze audit quality", "prompt meta", "audit the audits".
---

# q-audits — Qualia Prompt Meta-Analysis

## Rules card

If args are `?` or `rules`, print exactly this block and stop — do not run any queries:

```
/q-audits <N> [type] [mode] [source] [date range] [strategy] [mine?]

N          required — number of audits to fetch
type       single | flow | prototype  (default: any)
mode       reaudit with changes | feedback reaudit | reaudit | feedbacks  (default: general)
source     app | plugin  (default: both)
date range last month | jan to march | last week | etc.  (default: all time)
strategy   review all | spot-check only  (default: auto, cutoff at 50 total images)
mine       mine / my audits / deiturbeandrea / andrea de iturbe  (default: excluded)

Examples:
  /q-audits 20
  /q-audits 10 prototype reaudit with changes
  /q-audits 10 feedback reaudit last month
  /q-audits 100 feedbacks
  /q-audits 20 single app last week review all
  /q-audits 50 my audits
  /q-audits 15 prototype feedback reaudit plugin
```

## Step 0 — Parse args

Resolve all variables from the args string. Defaults:
- type: any
- mode: general
- source: both
- date range: all time (no date filter)
- strategy: auto (50-image cutoff)
- mine: false (exclude the operator's accounts)

**Excluded accounts (default — always apply unless mine flag detected):**
`<operator-email>`, `<additional-operator-email>`, `<early-user-email-1>`, `<early-user-email-2>`, `test@qualia-ux.com`

**Mine flag** (case-insensitive): `mine`, `my audits`, `deiturbeandrea`, `andrea de iturbe`

**Mode resolution:**
- `reaudit with changes` → mode = with_changes
- `feedback reaudit` → mode = feedback_only
- `reaudit` (bare — not followed by "with changes" and not preceded by "feedback") → mode = both_reaudit
- `feedbacks` → mode = feedbacks
- (nothing) → mode = general

**Date range resolution:**
- `last month` → first day of previous month to first day of current month
- `last week` → previous Monday to following Monday
- `jan` → 2026-01-01 to 2026-02-01 (most recent January)
- `jan to march` → 2026-01-01 to 2026-04-01
- `2026-01-31 2026-02-08` → treat as start/end, add 1 day to end for exclusive bound

Announce before running:
> "Running q-audits: **{N} {type} {mode} audits** | source: {source} | {date label or 'all time'} | strategy: auto | {excluding the operator's accounts / including all accounts}"

If N is missing or not an integer, print the rules card and stop.

## Step 1 — Fetch

Run each query via:
```bash
TMPFILE=$(mktemp /tmp/qaudits_XXXXXX.sql)
# write query to $TMPFILE
supabase db query --linked -o csv --file "$TMPFILE" 2>&1 | grep -v "Initialising login role"
rm "$TMPFILE"
```

All queries include these CTEs. Omit the `excluded` CTE and the `u.email NOT IN` clause when the mine flag is set.

```sql
WITH excluded AS (
  SELECT unnest(ARRAY[
    '<operator-email>', '<additional-operator-email>',
    '<early-user-email-1>', '<early-user-email-2>', 'test@qualia-ux.com'
  ]::text[]) AS email
),
aif_per_engine AS (
  SELECT
    audit_id,
    engine_id,
    COUNT(*) FILTER (WHERE stance IN ('disagree', 'not_relevant')) AS neg_count,
    COUNT(*)                                                        AS total_count
  FROM public.audit_issue_feedback
  GROUP BY audit_id, engine_id
),
aif_summary AS (
  SELECT
    audit_id,
    SUM(neg_count)                              AS neg_stance_count,
    SUM(total_count)                            AS total_stance_count,
    jsonb_object_agg(engine_id, neg_count)      AS neg_by_engine
  FROM aif_per_engine
  GROUP BY audit_id
)
```

**Type filter** (inject as additional WHERE clause — pick one based on type arg):
```sql
-- single:    AND a.flow_images IS NULL AND (a.ai_report->>'analysis_mode') IS DISTINCT FROM 'prototype'
-- flow:      AND a.flow_images IS NOT NULL AND (a.ai_report->>'analysis_mode') IS DISTINCT FROM 'prototype'
-- prototype: AND (a.ai_report->>'analysis_mode') = 'prototype'
-- any:       (no additional clause)
```

**Source filter:**
```sql
-- app:    AND a.source = 'app'
-- plugin: AND a.source = 'plugin'
-- both:   (no additional clause)
```

**Date filter:**
```sql
-- AND a.created_at >= 'START_DATE'::timestamptz AND a.created_at < 'END_DATE'::timestamptz
```

---

### Mode: general (and feedbacks)

```sql
[CTEs above]
SELECT
  a.id,
  a.created_at,
  a.overall_score,
  a.ai_report,
  a.screenshot_url,
  a.flow_images,
  a.screen_context,
  a.feedback_rating,
  a.feedback_comment,
  a.reaudit_type,
  a.source,
  a.selected_personas,
  a.user_id,
  a.follow_up_audit_id,
  CASE
    WHEN (a.ai_report->>'analysis_mode') = 'prototype' OR a.flow_images IS NOT NULL
    THEN jsonb_array_length(COALESCE(a.flow_images, '[]'::jsonb))
    ELSE 1
  END AS image_count,
  COALESCE(s.neg_stance_count, 0)    AS neg_stance_count,
  COALESCE(s.total_stance_count, 0)  AS total_stance_count,
  s.neg_by_engine
FROM public.audits a
JOIN auth.users u ON u.id = a.user_id
LEFT JOIN aif_summary s ON s.audit_id = a.id
WHERE a.status = 'completed'
  AND u.email NOT IN (SELECT email FROM excluded)   -- omit if mine flag
  -- [type filter]
  -- [source filter]
  -- [date filter]
  -- feedbacks mode only: add these two lines:
  -- AND (a.feedback_rating IS NOT NULL OR a.feedback_comment IS NOT NULL)
  -- AND a.follow_up_audit_id IS NULL
ORDER BY a.created_at DESC
LIMIT N;
```

---

### Mode: reaudit with changes

```sql
[CTEs above]
SELECT
  a2.id,
  a2.created_at,
  a2.overall_score,
  a2.ai_report,
  a2.screenshot_url,
  a2.flow_images,
  a2.screen_context,
  a2.feedback_rating,
  a2.feedback_comment,
  a2.reaudit_type,
  a2.source,
  a2.selected_personas,
  a2.user_id,
  CASE
    WHEN (a2.ai_report->>'analysis_mode') = 'prototype' OR a2.flow_images IS NOT NULL
    THEN jsonb_array_length(COALESCE(a2.flow_images, '[]'::jsonb))
    ELSE 1
  END AS image_count,
  COALESCE(s.neg_stance_count, 0)   AS neg_stance_count,
  COALESCE(s.total_stance_count, 0) AS total_stance_count,
  -- original audit fields
  a1.id                AS orig_id,
  a1.created_at        AS orig_created_at,
  a1.overall_score     AS orig_overall_score,
  a1.ai_report         AS orig_ai_report,
  a1.screenshot_url    AS orig_screenshot_url,
  a1.flow_images       AS orig_flow_images,
  a1.screen_context    AS orig_screen_context,
  CASE
    WHEN (a1.ai_report->>'analysis_mode') = 'prototype' OR a1.flow_images IS NOT NULL
    THEN jsonb_array_length(COALESCE(a1.flow_images, '[]'::jsonb))
    ELSE 1
  END AS orig_image_count
FROM public.audits a2
JOIN public.audits a1 ON a2.follow_up_audit_id = a1.id
JOIN auth.users u ON u.id = a2.user_id
LEFT JOIN aif_summary s ON s.audit_id = a2.id
WHERE a2.status = 'completed'
  AND a2.reaudit_type = 'with_changes'   -- omit entirely for bare 'reaudit' mode
  AND u.email NOT IN (SELECT email FROM excluded)  -- omit if mine flag
  -- [type filter on a2]
  -- [source filter on a2]
  -- [date filter on a2]
ORDER BY a2.created_at DESC
LIMIT N;
```

### Mode: feedback reaudit

Use the same query structure as "reaudit with changes" above, but with one change: remove the line `AND a2.reaudit_type = 'with_changes'` and replace it with:
```sql
  AND a2.reaudit_type = 'feedback_only'
```
Do not keep both `reaudit_type` lines — use only the `feedback_only` one.

### Mode: reaudit (both types)

Use the same query structure as "reaudit with changes" above, but remove the `AND a2.reaudit_type = 'with_changes'` line entirely — do not replace it with any other `reaudit_type` filter. All other clauses remain the same.

## Step 2 — Data pass (all N rows, no images)

Read all CSV rows and compute the following. Do NOT make visual observations in this step.

**Score stats:**
- Distribution: min / max / median / avg of `overall_score`
- Per-engine averages: extract `ai_report->>'system_logic_score'`, `ai_report->>'heuristic_score'`, `ai_report->>'cognitive_score'`, `ai_report->>'interaction_score'` from each row (these are top-level numeric fields in the JSONB)
- Type breakdown: count by (single / flow / prototype) using the same detection logic as the SQL type filter
- Avg `image_count` across all rows

**Synth persona stats:**
- % of rows where `selected_personas` is non-null and non-empty array
- Frequency of each unique persona name across all rows (extract `name` field from each element)
- Avg `overall_score` for rows with vs. without personas

**Design system stats:**
- Count rows where `ai_report->'design_system'` is non-null and non-empty
- Note: this section is only populated in flow and prototype audits

**Accessibility stats:**
- Count rows where `ai_report->'accessibility'` has at least one finding
- Avg number of accessibility findings per audit (count items in `ai_report->'accessibility'->'issues'` array)
- Count rows with contrast failures (`ai_report->'accessibility'->'contrast_failures'` non-empty)

**Feedback stance stats** (relevant when `neg_stance_count > 0` in any row):
- Total `neg_stance_count` / `total_stance_count` across all rows → overall disagree rate
- Per-engine disagree counts from `neg_by_engine`
- Distribution of `feedback_rating`: count of 1s, 2s, 3s, 4s, 5s
- Read all non-null `feedback_comment` values — note recurring themes

**Repeat run clusters:**
- Group rows by (`user_id`, `screenshot_url`) — list any group with count ≥ 2, with their scores
- In reaudit modes: check if `orig_id` appears as `follow_up_audit_id` in another row in the batch — flag chain depth > 2

**Score drift** (reaudit modes only):
- Compute `overall_score - orig_overall_score` for each pair
- Flag pairs where `|delta| > 5` AND `reaudit_type = 'feedback_only'` (identical images → pure non-determinism)
- Note pairs where delta direction is negative (score dropped on reaudit with changes)

**Anomaly score per row** (integer, used in Step 3 to select spot-check targets):
Start at 0 for each row, add:
- +3 if `total_stance_count > 0` AND `neg_stance_count / total_stance_count > 0.5`
- +3 if `feedback_rating IS NOT NULL` AND `feedback_rating <= 2` AND `overall_score >= 70`
- +2 if max engine score − min engine score > 30 (large engine spread — extract all four engine scores from `ai_report`)
- +4 if reaudit mode AND `|overall_score - orig_overall_score| > 5` AND `reaudit_type = 'feedback_only'`
- +2 if this row's (`user_id`, `screenshot_url`) appears ≥ 2 times in the fetched batch
- +2 if `selected_personas` non-empty AND `neg_stance_count > 2`

Rank all rows by anomaly score descending. Keep the ordered list for Step 3.

## Step 3 — Image strategy

Sum `image_count` across all N rows. For reaudit modes, also count `orig_image_count`.

| Condition | Strategy |
|---|---|
| Total images ≤ 50, OR `review all` flag | **Full review** — load every image |
| Total images > 50, OR `spot-check only` flag | **Spot-check** — load top 10 anomalies only |

Announce:
> "Total images: {total}. Strategy: {full review / spot-check (reviewing top 10 / {n} audits)}"

### Which audits to load in spot-check mode

Take the top 10 rows by anomaly score from Step 2. For each, note the reason:

| Score component that fired | Label to show in report |
|---|---|
| neg_stance_count ratio > 0.5 | `{x}/{total} stances marked disagree/not_relevant` |
| low feedback_rating + high score | `feedback_rating={r}, overall_score={s}` |
| large engine spread | `engine score spread: {min}–{max}` |
| score drift > 5pts on feedback_only | `score drift {delta:+d}pts on identical images` |
| repeat run cluster | `same screen audited {n} times by this user` |
| persona + high disagree | `persona active, {n} disagree stances` |

In reaudit modes, also load the `orig_screenshot_url` / `orig_flow_images` for each spot-checked pair.

### Fetching images from Supabase Storage

Get credentials once:
```bash
PROJECT_REF=$(cat supabase/config.toml | grep project_id | awk -F'"' '{print $2}')
SERVICE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep service_role | awk '{print $NF}')
```

For each image URL to load:

**Case A — URL already starts with `https://`:** Use it directly with the Read tool. No signing needed.

**Case B — Relative storage path** (e.g. `user-id/audit-id.png`):
```bash
SIGNED=$(/usr/bin/curl -s -X POST \
  "https://${PROJECT_REF}.supabase.co/storage/v1/object/sign/screenshots/${PATH}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"expiresIn": 3600}')
SIGNED_URL="https://${PROJECT_REF}.supabase.co/storage/v1$(echo "$SIGNED" | /usr/bin/python3 -c "import sys,json; print(json.load(sys.stdin)['signedURL'])")"
TMPIMG=$(mktemp /tmp/qaudits_img_XXXXXX_${RANDOM}.png)
/usr/bin/curl -s -o "$TMPIMG" "$SIGNED_URL"
```
Then load `$TMPIMG` with the Read tool (not the signed URL directly — Read cannot fetch remote URLs).

Note: `supabase status` may not return the API URL in all environments. Reading from `supabase/config.toml` is more reliable.

For `flow_images` (JSONB array): apply the same case A/B logic to each element in the array.
For reaudit modes: also load original audit images using `orig_screenshot_url` and `orig_flow_images`.

## Step 4 — Image pass

**HARD RULE — enforced without exception:**
> Never make a visual observation about an audit whose images you have not loaded. If images were not reviewed, analysis is limited to numerical and structured data only — no claims about what is or is not visible on screen.

For each image you have loaded, run all of the following checks. Read the `ai_report` for the same audit alongside the image.

**False positives:** For each finding in `ai_report` (check all four engine arrays: `system_logic.findings`, `heuristic.findings`, `cognitive.findings`, `interaction.findings`), ask: does this issue actually exist in the image? If the image clearly contradicts the finding, it is a false positive. Be specific: _"Finding #2 (heuristic) flags missing back navigation — the image shows a clearly visible back arrow top-left."_

**False negatives:** Look at the image with fresh eyes before re-reading the report. Note any obvious UX problems visible to you. Then check whether each appears in the report. If a clear issue is missing, it is a false negative. Be specific about what was missed and which engine should have caught it.

**Score calibration:** Does `overall_score` match what you see? A score ≥ 80 on a visually broken or confusing screen is a calibration failure. A score ≤ 40 on a clean, functional screen is also a failure. State concretely why the score feels off.

**Persona influence:** If `selected_personas` is non-empty, check whether findings appear over-tailored to the persona in ways that distort the actual visual issues. Flag if persona appears to be creating false positives (issues only real for a very specific user type) or false negatives (real issues ignored because they don't affect the persona).

**Design system accuracy:** For flow/prototype audits with a populated `ai_report->'design_system'` section: do the flagged inconsistencies actually appear across the frames you can see? Note false positives and missed inconsistencies.

**Accessibility accuracy:** For audits with `ai_report->'accessibility'` findings: do the contrast failures and WCAG issues flagged match what's actually visible? Check specifically the flagged elements — does the contrast claim look plausible given the colors visible?

**Reaudit pair comparison** (reaudit modes only): Compare the original and reaudit images side by side. Note:
- Which issues from the original `ai_report` visibly disappeared in the new design?
- Which original issues persist despite the reaudit?
- What changed visually that the reaudit did NOT pick up?

## Step 5 — Report assembly

Assemble and output the full report in chat, then save.

````markdown
# Qualia Prompt Meta — {parsed label}
_Generated: {ISO timestamp Europe/Rome} | N={n} | Mode={mode} | Type={type} | Source={source} | Strategy={strategy}_

## Parsed interpretation
{One sentence: what was run, what was excluded, date range}

## Stats overview
N={n} | single: {x} | flow: {x} | prototype: {x}
Avg screens per audit: {x}
Total images: {x} | Strategy: {full review / spot-check ({x}/{n} audits reviewed)}
Score: min {x} | max {x} | median {x} | avg {x}
Audits with synth personas: {x}/{n} — top personas: [{A}, {B}, {C}]
Design system section present: {x}/{n} (flow + prototype only)
Accessibility issues flagged: avg {x} per audit | contrast failures: {x}/{n}
[reaudit modes only] Score drift: {x} pairs with |delta| > 5pts | avg delta: {x}pts

## Data-derived findings
_(All {n} audits — no images required)_

### Per-engine score patterns
| Engine | Avg | Min | Max | Notes |
|---|---|---|---|---|
| system_logic | | | | |
| heuristic | | | | |
| cognitive | | | | |
| interaction | | | | |

### Feedback stance breakdown per engine
_(Omit section if total_stance_count = 0 across all rows)_
| Engine | Agree | Disagree | Already fixed | Not relevant | Disagree rate |
|---|---|---|---|---|---|

### Synth user patterns
{Findings on persona correlation — or "No synth personas active in this sample."}

### Design system patterns
{Recurring design system findings across audits — or omit if section absent in all rows}

### Accessibility patterns
{Recurring accessibility findings — or omit if section absent in all rows}

### Repeat run clusters
{Table of user+screen combos that appear ≥ 2 times with their scores — or "None detected."}

[reaudit modes only]
### Score drift log
| Audit ID | Orig score | Reaudit score | Delta | Type | Flag |
|---|---|---|---|---|---|
_(⚠️ = |delta| > 5 AND reaudit_type = feedback_only)_

## Image-derived findings
[spot-check only] ⚠️ _Based on image review of {x}/{n} audits (highest anomaly scores). Visual observations apply only to these audits._
[full review] _(Full image review — all {n} audits)_

### Audit {short-id} [{selection reason or "full review"}]
- **False positives:** {list — or "None detected"}
- **False negatives:** {list — or "None detected"}
- **Score calibration:** {note — or "Looks reasonable"}
- **Persona influence:** {note if personas active — or omit}
- **Design system:** {note if applicable — or omit}
- **Accessibility:** {note if applicable — or omit}
[reaudit modes] - **Pair comparison:** {what changed, what persisted, what was missed}

## Mode-specific findings
_(Omit section entirely for general mode)_

[reaudit with changes / reaudit]
### Finding delta analysis
{Pattern across pairs: % of original findings that disappeared, % that persisted, new findings introduced}

[feedback reaudit]
### Feedback incorporation assessment
{For each pair: did the reaudit ai_report change in ways that reflect feedback_comment? Was feedback substantive?}

[feedbacks]
### Feedback comment themes
{Patterns in feedback_comment text, correlation of feedback_rating with audit type and score}

## Ranked recurring issues
_(Ordered by frequency across all N audits)_

1. **{Pattern name}** — {x}/{n} audits | Engine: {engine} | Evidence: "{verbatim finding excerpt}"
2. ...

## Prompt recommendations

### {Short label}
- **What:** {specific prompt weakness identified}
- **Evidence:** {x}/{n} audits, signal: {signal type}
- **Recommendation:** {one concrete, actionable change — name the specific prompt section to edit}

## Caveats
- {Flag any metric with N < 5 as "(directional only, N={n})"}
- {If spot-check: "Visual findings based on {x}/{n} audits image-reviewed — may not represent full sample"}
- {List any ai_report fields that were null/absent in >50% of rows}
````

**Save to:** `docs/prompt-meta/YYYY-MM-DD-{mode}-N{n}.md`

Filename examples:
- `docs/prompt-meta/2026-05-07-general-N20.md`
- `docs/prompt-meta/2026-05-07-reaudit-with-changes-prototype-N10.md`
- `docs/prompt-meta/2026-05-07-feedbacks-N100.md`

If the file already exists, overwrite it. Confirm: _"Saved to `docs/prompt-meta/{filename}.md`"_
