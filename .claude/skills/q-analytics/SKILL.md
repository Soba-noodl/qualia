---
name: q-analytics
description: Run Qualia product analytics for a date range. Outputs a comprehensive report — overview + latency (1/1c), user activity + cohorts + project density + tours (2/2b/2c/2d), feature adoption + engine scores + source error rates (3/3b/3c), errors & quota (4), engagement + engine feedback (5/5b), integrations (6), PostHog top-of-funnel (8), AI cost + re-audit resolution (9) — plus a Claude interpretation. Saves to docs/analytics/. Trigger on: /q-analytics, "/q-analytics [date range]", "run analytics for [period]", "show me metrics for [period]".
posthog_project_id: <set $POSTHOG_PROJECT_ID in your env>
posthog_host: https://eu.i.posthog.com
gcp_gemini_project_id: <set $GCP_GEMINI_PROJECT_ID in your env>
gcp_bq_project_id: <set $GCP_BQ_PROJECT_ID in your env>
gcp_billing_account_id: <set $GCP_BILLING_ACCOUNT_ID in your env>
gcp_billing_dataset: billing_export
---

# Analytics Skill

> **Required env vars** (operator's `~/.secrets` or `.env.local`):
> - `POSTHOG_PERSONAL_KEY` — PostHog personal API key (read-only OK).
> - `POSTHOG_PROJECT_ID` — your PostHog project numeric ID.
> - `GCP_GEMINI_PROJECT_ID` — Google Cloud project hosting the Gemini API
>   key + Vertex AI usage.
> - `GCP_BQ_PROJECT_ID` — Google Cloud project hosting the BigQuery billing
>   export dataset.
> - `GCP_BILLING_ACCOUNT_ID` — your GCP billing account ID (used for cost
>   queries; format: `XXXXXX-XXXXXX-XXXXXX`).
>
> The skill's curl URLs and SQL queries reference these via shell expansion
> (e.g. `$POSTHOG_PROJECT_ID`). If they're not set, the skill fails fast
> with a clear "missing env var" message instead of hitting a wrong project.

## Step 0 — Parse Date Range

Resolve the argument to `START_DATE` and `END_DATE` (both `YYYY-MM-DD`, end is exclusive — i.e. the day after the last day included).

**Rules:**
- `jan` → `2026-01-01` to `2026-02-01` (most recent January)
- `jan to march` → `2026-01-01` to `2026-04-01`
- `jan 26 to march 21` → `2026-01-26` to `2026-03-22`
- `last week` → previous Monday to following Monday (e.g. `2026-03-30` to `2026-04-06`)
- `last month` → first day of previous month to first day of current month
- `2026-01-31 2026-02-08` → `2026-01-31` to `2026-02-09` (add 1 day to make end exclusive)
- If no year given → default to most recent occurrence

Announce resolved dates before running:
> "Running analytics for **{human label}** (`{START_DATE}` → `{END_DATE}`)…"

---

## Step 1 — Verify Working Directory

The SQL files live at `docs/analytics/queries/` relative to the project root. Confirm you are running from the repo root (or a worktree of it). If the files are not found, stop and report.

---

## Step 2a — Verify placeholder format

Before running any substitution, confirm the SQL files use the expected placeholder tokens:

```bash
# Verify placeholder format matches expected pattern
grep -q "START_DATE\|END_DATE" docs/analytics/queries/*.sql || { echo "ERROR: SQL files don't use START_DATE/END_DATE placeholders — substitution will silently produce broken queries. Inspect file format and update this skill."; exit 1; }
```

## Step 2 — Run All Modules

For each module, substitute dates into the SQL file using `sed`, write to a temp file, then run via `supabase db query --linked`. Always use `-o csv` output.

**Pattern for every module:**
```bash
TMPFILE=$(mktemp /tmp/analytics_XXXXXX.sql)
sed "s/:'start_ts'/'START_DATE'/g; s/:'end_ts'/'END_DATE'/g" \
    docs/analytics/queries/MODULE_FILE.sql > "$TMPFILE"
supabase db query --linked -o csv --file "$TMPFILE" 2>&1 | grep -v "Initialising login role"
rm "$TMPFILE"
```

Replace `START_DATE`, `END_DATE`, and `MODULE_FILE` with the actual values. Run each query, capture the CSV output. If a query returns an error, write `⚠️ query failed` in that section and continue to the next.

### Module 1 — Overview

Run `module1a_overview.sql` and `module1b_patterns.sql`.

Format 1a as a single-row summary table.
Format 1b as two separate tables:
- **Day of week** — filter rows where `breakdown_type = dow`, show label + count
- **Hour of day** — filter rows where `breakdown_type = hour`, show label + count

### Module 1c — Audit latency

Run `module1c_latency.sql`.

Format as:
- A summary table: type / audits / P50 (s) / P90 (s). Include the "overall" row first, then prototype/flow/single rows.
- A weekly trend table: ISO week / audits / P50 (s).

If `audits=0` for the overall row, render: "Audit latency: N=0 (pre-instrumentation rows excluded — `completed_at` was added 2026-05-06)" and skip the breakdowns.

### Module 2 — User Activity

Run `module2_user_activity.sql`. Format as a single-row summary table with these groupings:
- Acquisition: new_users, logged_in_window
- Retention: returning_active, returning_audited, churned_users
- Activation: new_user_activation_pct
- Depth: depth_1_audit / depth_2_5_audits / depth_6plus_audits
- Time-to-first-audit: median_hrs_to_first_audit

### Module 2b — Cohort retention

Run `module2b_cohorts.sql`.

Format as a table: Cohort week / Cohort size / D1 % / D7 % / D30 %.

If no rows returned, render: "Cohort retention: no sign-ups in the window."

### Module 2c — Project density

Run `module2c_project_density.sql`.

Format as a single-row summary: Total projects / Users with projects / Avg audits per project / Avg projects per user / Dormant projects.

### Module 2d — Onboarding tour completion

Run `module2d_tour_completion.sql`.

Format as a table: Tour name / Cohort size / Completed / Completion %.

If no rows returned, render: "Tour completion: no tour data for users who signed up in this window (either N=0 or tours not yet completed)."

### Module 3 — Feature Adoption

Run `module3_feature_adoption.sql`. Format as a summary with:
- Audit type split (single / multi / prototype)
- Source split (app / plugin)
- Feature flags (deep_figma_ui, synth_users)
- Re-audit rate and score delta (add note: positive delta = designs improved)

### Module 3b — Score distribution per engine

Run `module3b_score_per_engine.sql`.

Format as a table: Engine / Q1 / Median / Q3 / N. One row per engine.

If all N=0, render: "Score distribution: no completed audits in window."

### Module 3c — Failure rate by source

Run `module3c_source_error_rates.sql`.

Format as a table: Source / Total / Completed / Failed / Error rate %.

### Module 4 — Errors & Quota

Run three queries:
1. `module4a_audit_errors.sql` — summary row
2. `module4a_error_breakdown.sql` — ranked table of error messages
3. `module4b_non_audit_errors.sql` — table grouped by source/context

Format 4a as a summary. Format 4a error breakdown as a ranked table (error_message | occurrences | affected_users). Format 4b as source/context table.

If 4b returns no rows, add note: _(No non-audit errors logged yet — infrastructure was deployed 2026-04-07. Data accumulates from this date onward.)_

### Module 5 — Engagement & Quality

Run `module5_engagement.sql`. Format as three subsections:
- **Ratings** — avg_rating + distribution table (1★–5★ with counts)
- **Issue feedback** — total rows, users, stance breakdown
- **Enrichment fill rate** — screen_context_fill_pct and user_data_fill_pct

### Module 5b — Issue feedback by engine

Run `module5b_engine_feedback.sql`.

Format as a table: Engine / Total / Agree / Disagree / Already fixed / Not relevant / Agree % / Disagree %.

If no rows returned, render: "Issue feedback by engine: no feedback recorded in this window."

### Module 6 — Integrations

Run `module6_integrations.sql`. Format as three subsections (Figma / Notion / Google Drive).

For each integration:
- Total connected users
- New connections in window
- % of auditors in window who have it connected (= X_auditors_connected / auditors_in_window * 100)
- Stale connections (Notion and Drive only)
- Median days since last token refresh (Notion and Drive only)

Add caveat under Notion and Drive: _`updated_at` reflects token refresh activity, not direct export usage._

### Module 8 — PostHog: Top of Funnel

Requires `POSTHOG_PERSONAL_KEY` to be provided by the user in the current session. Project ID is in `$POSTHOG_PROJECT_ID`. Host is `https://eu.i.posthog.com`.

If no key was provided, skip this module and add a note: _(PostHog data unavailable — provide POSTHOG_PERSONAL_KEY to include top-of-funnel metrics.)_

Excluded emails (applied to all person-level queries):
`test@qualia-ux.com`, `<operator-email>`, `<early-user-email-1>`, `<additional-operator-email>`, `<early-user-email-2>`

Run each query below using `curl`. Replace `$POSTHOG_PERSONAL_KEY` with the key provided by the user. Replace `START_DATE` and `END_DATE` with the resolved dates (format: `YYYY-MM-DD`).

**8a — Unique visitors and identified users:**
```bash
curl -s "https://eu.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/insights/trend/" \
  -H "Authorization: Bearer $POSTHOG_PERSONAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{"id": "$pageview", "type": "events", "math": "dau"}],
    "date_from": "START_DATE",
    "date_to": "END_DATE",
    "breakdown": "is_identified"
  }'
```

Format as: Total unique visitors | Identified (logged-in) | Anonymous

**8b — Top 10 pages by views:**
```bash
curl -s "https://eu.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/insights/trend/" \
  -H "Authorization: Bearer $POSTHOG_PERSONAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{"id": "$pageview", "type": "events", "math": "total"}],
    "date_from": "START_DATE",
    "date_to": "END_DATE",
    "breakdown": "$current_url",
    "breakdown_type": "event"
  }'
```

Format as a ranked table: Rank | Path | Views. Strip the domain, keep only the path.

**8c — Audit funnel (audit_started → audit_completed):**
```bash
curl -s "https://eu.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/insights/funnel/" \
  -H "Authorization: Bearer $POSTHOG_PERSONAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {"id": "audit_started", "type": "events", "order": 0},
      {"id": "audit_completed", "type": "events", "order": 1}
    ],
    "date_from": "START_DATE",
    "date_to": "END_DATE",
    "funnel_window_interval": 1,
    "funnel_window_interval_unit": "day"
  }'
```

Format as: Started | Completed | Completion rate. If the funnel returns 0 for both events, add note: _(No audit funnel data yet — events accumulate after instrumentation is deployed.)_

**8d — Audit type breakdown:**
```bash
curl -s "https://eu.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/insights/trend/" \
  -H "Authorization: Bearer $POSTHOG_PERSONAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{"id": "audit_started", "type": "events", "math": "total"}],
    "date_from": "START_DATE",
    "date_to": "END_DATE",
    "breakdown": "audit_type",
    "breakdown_type": "event"
  }'
```

Format as: single | flow | re-audit counts.

**8e — Cookie opt-in rate:**
```bash
curl -s "https://eu.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/insights/trend/" \
  -H "Authorization: Bearer $POSTHOG_PERSONAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {"id": "$opt_in", "type": "events", "math": "dau"},
      {"id": "$pageview", "type": "events", "math": "dau"}
    ],
    "date_from": "START_DATE",
    "date_to": "END_DATE"
  }'
```

Format as: Opted-in users | Total visitors | Opt-in rate (%).

**8f — Top referrers, countries, devices:**

Run three separate curl calls:

```bash
# Referrers
curl -s "https://eu.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/insights/trend/" \
  -H "Authorization: Bearer $POSTHOG_PERSONAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"events":[{"id":"$pageview","type":"events","math":"total"}],"date_from":"START_DATE","date_to":"END_DATE","breakdown":"$referrer","breakdown_type":"event"}'

# Countries
curl -s "https://eu.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/insights/trend/" \
  -H "Authorization: Bearer $POSTHOG_PERSONAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"events":[{"id":"$pageview","type":"events","math":"total"}],"date_from":"START_DATE","date_to":"END_DATE","breakdown":"$geoip_country_name","breakdown_type":"person"}'

# Devices
curl -s "https://eu.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/insights/trend/" \
  -H "Authorization: Bearer $POSTHOG_PERSONAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"events":[{"id":"$pageview","type":"events","math":"total"}],"date_from":"START_DATE","date_to":"END_DATE","breakdown":"$device_type","breakdown_type":"event"}'
```

Format as three subsections:
- **Top 5 referrers** (exclude `$direct` or empty values)
- **Top 5 countries**
- **Device split** (Desktop / Mobile / Tablet counts + %)

Add note under visitor counts: _Anonymous visitors cannot be filtered by email — internal team traffic before login is included in totals._

### Module 9 — Economics & Quality

#### 9a — Total AI cost (Cloud Billing)

Auth probe — ADC credentials live at `~/.config/gcloud/legacy_credentials/<your-google-account>/adc.json`. Set the env var and test:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/legacy_credentials/<your-google-account>/adc.json
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
gcloud auth application-default print-access-token > /dev/null 2>&1 || echo "NO_AUTH"
```

If this fails, render `AI cost: unavailable (auth check failed)` and skip 9a. Keep `GOOGLE_APPLICATION_CREDENTIALS` set for the bq call below.

Note: `gcp_billing_dataset` must be configured first — go to GCP console → Billing → Billing export → BigQuery export, create a dataset in project `$GCP_BQ_PROJECT_ID`, then update the frontmatter. Until then, render `AI cost: unavailable (billing export not yet configured in GCP console)` and skip 9a.

If auth ok, query BigQuery billing export. Replace `START_DATE` and `END_DATE` with the resolved range; `<gcp_*>` values come from this skill's frontmatter.

```bash
bq query --use_legacy_sql=false --format=csv "
  SELECT ROUND(SUM(cost), 4) AS total_usd
  FROM \`<gcp_project_id>.<gcp_billing_dataset>.gcp_billing_export_v1_<gcp_billing_account_id>\`
  WHERE service.description IN ('Vertex AI', 'Generative Language API')
    AND usage_start_time >= TIMESTAMP('START_DATE')
    AND usage_start_time <  TIMESTAMP('END_DATE')
"
```

Format as a one-line summary: `Total AI cost (period): $X.XX USD`. If `bq query` errors, render `AI cost: unavailable (<short error>)` and continue.

#### 9b — Re-audit issue resolution

Run `module9b_reaudit_resolution.sql` per the standard SQL pattern.

Format as: `Audit pairs / Agreed findings / Resolved / Resolution rate %`. If `audit_pairs < 5`, append "(N=<n>, directional only)".

#### 9c — Cost per audit (derived)

Compute `total_usd / completed_audits_in_window` (completed_audits from §1 Overview). Render: `Cost per audit (avg, derived): $X.XXXX`. Mark as "estimate — Cloud Billing total ÷ Supabase audit count" so the reader knows it's not per-row attributed.

If 9a is unavailable, skip 9c.

---

## Step 3 — Module 7: Claude Interpretation

After formatting all 6 modules, read the assembled data and apply this prompt to yourself:

```
ROLE: You are a senior quantitative product analyst reviewing raw metrics
for an early-stage UX audit SaaS tool. You have no stake in the outcome.
Your job is to tell the truth about what the numbers mean.
When PostHog data (Module 8) is available, incorporate it into your analysis alongside the Supabase data.
You also see latency, cohort retention, project density, tour completion, per-engine score and feedback splits, total AI cost, cost per audit, and re-audit issue resolution. Treat these with the same honesty filter — call out only what's evidence-backed and significant.

PRIME DIRECTIVE — THE HONESTY FILTER:
Before making any claim, run it through this filter:
1. EVIDENCE CHECK: Is this backed by a specific number in the data?
   If not, drop the claim entirely.
2. SIGNIFICANCE CHECK: Is the sample size large enough to mean anything?
   If N < 5 for a given metric, flag it as "directional only (N=X)"
   and do not draw conclusions from it.
3. SYCOPHANCY CHECK: You are forbidden from calling any metric "impressive",
   "great", "solid", or "promising" unless you name the benchmark you are
   comparing against and explain why it clears that bar.
4. PRIORITY CHECK: What is the single highest-leverage problem visible
   in the data? Lead with that. If everything looks fine, say so plainly
   and explain why.

OUTPUT FORMAT — use exactly these four sections, no extras:

**Top signal**
One sentence. The single most important thing the data says right now.

**What's working**
≤3 bullets. Evidence-backed only. Include the specific number for each.

**What to fix**
Ordered by impact (highest first). For each: what the problem is,
the specific number that surfaces it, and one concrete action to take.

**Open questions**
What the data cannot tell you. Be explicit about measurement gaps,
low-N caveats, and things that need qualitative investigation.
```

---

## Step 4 — Assemble and Save

Structure the full report as:

```
# Qualia Analytics — {human label}
_Generated: {ISO timestamp in Europe/Rome timezone}_

## 1. Overview
## 2. User Activity
## 3. Feature Adoption
## 4. Errors & Quota
## 5. Engagement & Quality
## 6. Integrations
## 8. PostHog: Top of Funnel
## 9. Economics & Quality
## 7. Interpretation
## Known instrumentation gaps
```

At the very end of the report, always append this static block:

```markdown
## Known instrumentation gaps

The following metrics are deliberately not in this report because the underlying instrumentation does not yet exist. Each will appear here every cycle until shipped.

- **Audit-modal upstream funnel** — PostHog `modal_opened`, `type_selected`, `input_provided` events are not emitted. Only `audit_started` is partially instrumented.
- **AuditDetail page engagement** — no scroll-depth or finding-expanded events exist. We measure that audits complete, not whether users read them.
- **Notion / Drive export tracking** — no event is logged when a user actually exports an audit. Current proxy (`updated_at` on the integration row) reflects token refresh, not export.
- **Tour-step dropout** — `profiles.completed_tours` records *whether* a tour was completed, but not *where* users drop off mid-tour. Step-level dropout requires PostHog instrumentation.
```

Save to: `docs/analytics/{START_DATE}_{END_DATE}.md`

If the file already exists, overwrite it.

Output the full report in chat, then confirm: "Saved to `docs/analytics/{START_DATE}_{END_DATE}.md`."

---

## Changelog

- **2026-05-06** — Added 8 new SQL modules (1c latency, 2b cohorts, 2c project density, 2d tour completion, 3b score-per-engine, 3c source error rates, 5b engine feedback, 9b re-audit resolution) + Cloud Billing integration for 9a total AI cost. Added "Known instrumentation gaps" appendix. GCP config fields added to frontmatter (fill in after `gcloud` setup).
