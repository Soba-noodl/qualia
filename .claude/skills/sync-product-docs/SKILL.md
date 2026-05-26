---
name: sync-product-docs
description: Keep product_docs/ honest after research, feature ships, or strategy changes. Use when: "sync the product docs", "we just shipped X", "I interviewed someone new", "update positioning", "/sync-product-docs". Tiered: auto-applies mechanical updates, proposes drift-detected changes for review. Includes Notion source discovery sweep every 30 days.
---

# sync-product-docs

Keeps `product_docs/` in sync with the product, research, and market. Companion to `sync-agent-docs`; different mechanics because product docs are research-derived, not code-derived.

**Always read the spec before running:** `docs/superpowers/specs/2026-05-12-sync-product-docs-design.md`. The spec is the source of truth; this skill is the executable summary.

## Step 1 — Load state

Read the state file:

```bash
cat ~/.claude/sync-product-docs-state.json 2>/dev/null || echo "null"
```

Or invoke the helper:

```bash
npx tsx -e "import('./scripts/sync-product-docs/state.ts').then(m => m.loadState().then(s => console.log(JSON.stringify(s))))"
```

If state is null (first run), follow the "First-run bootstrap" section below.

## Step 2 — Sources scan

### Git
Run:
```bash
npx tsx scripts/sync-product-docs/git-recent.ts <last-synced-commit-sha-or-empty> staging
```

Parse JSON output. Each entry: `{sha, date, subject, type, skip}`. These are candidate sources for R2, R6, R11.

### Notion targeted scan
For each `notion_source_ids[label]` in state, query the source:
```bash
npx tsx scripts/sync-product-docs/notion-query.ts query-db <db-id>
npx tsx scripts/sync-product-docs/notion-query.ts fetch-page <page-id>
```

Filter results to those with `last_edited_time > state.last_run_at`.

### Notion discovery (conditional)
If `state.last_discovery_at` is null OR more than 30 days old, OR user passed `--discover`:
1. Ask: *"Discovery sweep is due — run it now?"* (skip ask if `--discover` was explicit)
2. If yes:
   ```bash
   npx tsx scripts/sync-product-docs/notion-query.ts search-db Qualia
   npx tsx scripts/sync-product-docs/notion-query.ts search-page Qualia
   ```
3. Diff results against `state.notion_source_ids`. For any not in state, propose adding them: *"New Notion source detected: [name]. Add to tracked list?"* (y/n per item).
4. Update `state.last_discovery_at` to today on completion.

## Step 3 — Apply Tier 1 rules (auto-apply)

See "Tier 1 rules" section below. Run R1, R2, R3, R4, R5 in order. Each rule is silent unless it actually applies a change. Log applied changes for the run summary.

## Step 4 — Run drift detection (Tier 2 + R6)

See "Tier 2 rules" and "R6" sections below. Each rule produces zero or more **proposals**.

Every proposal passes through cross-cutting guardrails (G1, G2, G3) before being shown to the user.

Surface proposals one by one. For each: y / n / edit / skip. Apply approved diffs; record skipped/declined proposals in the run summary.

## Step 5 — Save state and report

Update state:
- `last_run_at` = now
- `last_synced_commit_sha` = current `staging` HEAD
- `last_discovery_at` = today (only if discovery ran)
- `notion_source_ids` = updated map

Print the run summary (template at the bottom of this doc).

---

## Tier 1 rules (auto-apply, no confirmation)

### R1 — Date stamp refresh

Trigger (any of):
- The doc itself was modified since last sync (fs mtime).
- One of the doc's declared sources changed since last sync.
- The doc's `Last refresh:` / `Last meaningful update:` / `Today:` stamp value is not today's date (catches docs that have stale stamps even without other changes).

Action: in every `product_docs/*.md`, find lines matching `^(Last refresh|Updated|Last meaningful update|Today)[:\s]+\d{4}-\d{2}-\d{2}` and update the date to today. Use the `Edit` tool. Skip docs where none of the above conditions fire.

### R2 — roadmap.md "Recently shipped" append

Trigger: `git-recent.ts` output contains commits not already in `product_docs/roadmap.md` Recently Shipped section.

Procedure:
1. Read `product_docs/roadmap.md`.
2. For each candidate commit (type ∈ {feat, fix, refactor}, skip=false):
   - Check if a bullet for it already exists (match commit subject excluding inline `[log #N]`).
   - If not, build a bullet: `- <descriptive form of subject> (<short SHA>, <date>)`.
   - Strip Conventional Commit prefix (`feat(plugin):` → `(plugin)` in the descriptive text).
3. Append the bullet(s) under the current month section (heading like `### 2026-05 (May 2026) ...`). If the month section doesn't exist, create it at the top of "Recently Shipped".

Edge cases:
- **Anti-elevation (G3 in spirit)**: NEVER use words like "biggest", "single largest", "core retention move", "the unlock". Factual descriptions only.
- Multi-part series — already collapsed by `git-recent.ts`.
- Don't auto-mark items as shipped in Now/Next/Later — that's R11.

### R3 — research.md Sources table append

Trigger: a Notion page in `Qualia - Research DB` has an `id` not present in `state.research_sources_seen`.

Procedure:
1. Query the Research DB: `npx tsx scripts/sync-product-docs/notion-query.ts query-db <research-db-id>`.
2. For each row whose `id` is not in `state.research_sources_seen`:
   - Append a row to `research.md`'s Sources table with: name (title), date (`last_edited_time`), product state inferred from date, weight tag, "What's in it" = `(needs summary)`.
   - Add the row's `id` to `state.research_sources_seen`.
3. Insert in chronological order in the table.
4. Save state at end of run.

Edge case: do NOT extract a summary from the page content.

**Why id-matching, not name-matching:** Notion source names use one format (e.g. `Web App - 4° Qualitative research`) while research.md uses a display format (e.g. `` `Qual round 4 (` ``2026-05_qual_4.md`` ` `) ``). String comparison would over-fire on every run. Page UUIDs are stable.

### R4 — research.md Participants table append

Trigger: a new interviewee exists in any targeted interviewee DB / inline page, not in `research.md` Participants.

Procedure:
1. For each interviewee DB (MVP-1, qual_1, qual_3): query; extract title (Name) + tag (`Qualia segment`).
2. For each inline qual page (qual_2, qual_4): fetch blocks; parse interviewee sections (heading_3 with `Name - Role` OR "Role: ..." paragraph blocks).
3. For each interviewee not in `research.md` Participants:
   - Append row: name, tag (or `tag-pending` if Notion property unset), rounds count (=1 if first appearance; increment if name matches existing), influence flag = false, marked `(new — needs review)`.
4. If a name matches an existing entry, increment rounds count instead of duplicating.

Edge cases:
- `tag-pending` rows count into R5's "unassigned" bucket, not a controlled-set tag.
- Name normalization: replace ` ` (U+00A0 non-breaking space) with regular space; trim.

### R5 — research.md Tag distribution recompute

Trigger: Participants table changed in this run (R4 fired) OR user passed `--recount`.

Procedure:
1. Parse `research.md` Participants table; count occurrences of each tag.
2. Rows with `tag-pending` count into a separate "unassigned" bucket.
3. Replace the tag-distribution numbers in `research.md` "By tag" section.

Edge case: if any tag value appears that's neither in the controlled set [`in-house-designer`, `in-house-design-lead`, `consultant`, `agency-designer`, `freelancer-product`, `pm`, `dev`, `founder`, `unclear`] nor `tag-pending` — STOP, raise error pointing at the offending row. Don't auto-add unauthorized tags.

---

## Tier 2 rules (propose-and-confirm)

For every Tier 2 rule, the procedure is:
1. Detect the trigger condition.
2. Draft a proposed change.
3. Run the proposal through guardrails G1, G2, G3. Annotate.
4. Surface to user: *"[Rule] detected [trigger]. [Proposed change]. Apply? (y/n/edit/skip)"*.
5. Apply or skip per response.

### R7 — Persona drift

Triggers (any fires):
- New Notion interviewee with `Qualia segment` X where `personas.md` has no anchor for X.
- An anchor's Notion `Qualia segment` property changed since last sync.
- An anchor's Notion `Company` property differs from text in `personas.md`.
- A new qual round occurred (new row in Research DB classified as qualitative) and `personas.md` `Last meaningful update` is older.

Proposal shape:
> *"Persona [X] reference [Name] — [reason]. Proposed update: [draft text change]."*

Note: external lookups (LinkedIn etc.) are NOT in R7 — only Notion-tracked fields. Re-verification is a separate user pass.

### R8 — Positioning claim verification

Triggers:
- A differentiator in `positioning.md` references a function/file/symbol that no longer exists (grep verifies).
- A "we do X" claim contradicts code reality (e.g. "math contrast on all modes" should be verifiable via `grep` of `check-contrast`).
- A new product brief version (v3, v4) detected in Notion since last sync.
- `positioning.md` `Last meaningful update` more than 60 days old.

Proposal shape:
> *"Positioning claim [X] may be stale — evidence at [code-path or notion-source]. Suggested edit: [draft]."*

### R9 — Principle vs. code consistency

Triggers:
- A code pattern in any commit since last sync contradicts a documented principle (no `q-disable` waiver).
- A principle references a file or symbol that no longer exists.
- 3+ commits since last sync show a new recurring pattern not documented.

Proposal shape:
> *"Principle [Y] may be stale OR a new principle is emerging — [code evidence with commit hashes]. Suggested action: [update / add / remove]."*

### R10 — Glossary completeness

Triggers:
- A term appears in `agent_docs/` or `product_docs/` but not in `glossary.md`.
- A new code symbol (edge function name, DB table) in commits since last sync, not in glossary.
- A glossary term's code pointer doesn't resolve.

Proposal shape:
> *"Glossary needs term [X] — please provide a definition. [file paths where it appears]."*

Note: skill does NOT draft definitions — that's judgment.

New terms expected after the strategy/gtm docs land: `bet`, `stop condition`, `North Star`, `playbook`, `outreach campaign`, `funnel metric`, `CAC`, `LTV`, `MRR`. R10 will fire on each the first time it appears outside `glossary.md`.

### R11 — Roadmap activity check

Triggers:
- An item in `roadmap.md` Now has no commit activity in 14+ days.
- An item in Next has commit activity (matched by feature keyword).
- A Recently Shipped item was rolled back (look for `git revert` or follow-up `fix:` commits explicitly referencing the same SHA).
- A bet in `strategy.md § Bet portfolio` has no corresponding `roadmap.md` Now/Next item (strategy declares; roadmap doesn't reflect).

Proposal shape:
> *"Roadmap item [X] activity mismatch — [evidence]. Suggested action: [move / mark stuck / mark rolled back]."*

### R12 — Research freshness

Triggers:
- A new quant cycle exists in `Qualia - Research DB` newer than the current quant anchor in `research.md`.
- A new qual round occurred and `research.md` "What we've heard repeatedly" table counts are provably stale.
- A new quant cycle in Notion newer than `gtm.md § Funnel snapshot` date stamp.

Proposal shape:
> *"Research [X] needs refresh — [source]. Suggested action: [update quant anchors / recount themes]."*

For `gtm.md § Funnel snapshot` updates, replace only pre-signup metrics (referrer, channel attribution, outreach). Activation / retention / audit mix stay in `research.md`.

### R13 — Cross-doc consistency

Triggers:
- `personas.md` mentions a tag not in the controlled set.
- `positioning.md` cites a metric different from `research.md`.
- A glossary term referenced in another doc doesn't exist in `glossary.md`.
- A direct conflict between two product docs.
- `strategy.md § Pricing thesis` ↔ `positioning.md § Pricing positioning` disagree.
- `strategy.md § Bet portfolio` declares bets without corresponding `roadmap.md` Now/Next/Later items.
- `strategy.md § GTM strategy` declares a channel not in `gtm.md § Playbook`.
- `gtm.md § Funnel snapshot` contains metrics also in `research.md § Quant snapshot` (signup-line boundary violation).

Proposal shape:
> *"Cross-doc conflict: [details]. Suggested fix: [draft change]."*

### R14 — GTM-log gap detection

Triggers:
- A Notion building log mentions an outreach campaign, demo post, content shipment, or channel test within a date range.
- That activity is not already in `product_docs/gtm-log.md`.

Detection:
1. Scan recent Notion building-log pages (queried via `notion-query.ts`) for keywords: `cold outreach`, `LinkedIn post`, `demo`, `messaggi`, `inviato a`, `audit demo`, `content`, `posted`, `messaggio a`, `outreach`, `campaign`.
2. For each matched mention, compute a signature: SHA-256 of `<date>|<channel>|<activity summary>`.
3. Compare against `state.gtm_log_seen_signatures`. Skip those already seen.

Proposal shape:
> *"Building log #N mentions [activity] on [date]. Add to `gtm-log.md`? Drafted entry:*
>
> ```markdown
> - **<date>** · <channel> · <activity> · <outcome — from log>
>   - *Source*: building log #N (Notion)
> ```
>
> *(y/n/edit/skip)"*

On accept:
- Append the entry to `product_docs/gtm-log.md` under the appropriate month section.
- Add the signature to `state.gtm_log_seen_signatures`.

---

## R6 — Decision detection (active, propose-and-confirm)

Strong-signal triggers (any one fires):
- New bullet in `roadmap.md` Killed / parked.
- Change to `positioning.md` headline / one-liner.
- New anti-goal added or removed in `positioning.md`.
- Materially changed differentiator in `positioning.md` (rewrite of bullet OR addition/removal; whitespace/typo fixes do not count).
- Pricing-model shift detected in `positioning.md`.
- Building log (Notion) keyword: "pivot", "killed", "deprecated", "we decided", "scegliamo", "abbiamo deciso", "rollback", "abandon".
- New product brief version detected in Notion.
- A persona's primary tag bucket changes.
- New bet added to `strategy.md § Bet portfolio`.
- A bet's status changes (active → won / lost / parked).
- `strategy.md § North Star` materially changes.
- `strategy.md § Pricing thesis` materially changes.

Two-step interaction:

**Step 1 — Surface:**
> *"I detected [X — link to source]. This looks decision-worthy. Add to `decisions.md`? (y/n)"*

**Step 2 — On yes, draft:**
> *"Drafted entry below. Approve / edit / discard?"*
>
> ```markdown
> ## YYYY-MM-DD — <Short title>
> **Decision** — <single sentence>
> **Why** — <extracted from source>
> **Source** — <link / commit / log #>
> ```

Apply via `Edit` tool to append to `decisions.md` on approval.

---

## Cross-cutting guardrails

Run on every Tier 2 and R6 proposal.

### G1 — Multi-dimensional evidence weight

Use `scripts/sync-product-docs/weight.ts` to compute weight on every proposed claim:

1. Identify the evidence backing the claim (which interviews, which commits, which logs).
2. Build an `EvidenceInput`: `{sources: [{date, round, sourceType}...], contradictedBy: N, asOf: today}`.
3. Call `computeWeight(input)`. Inspect the returned `bucket`.
4. Annotate the proposal:
   - **HIGH**: include, no caveat.
   - **MEDIUM**: light caveat — *"validated by N interviewees in [rounds]"*.
   - **LOW**: explicit weight tag — *"single-source signal — needs corroboration"*.
   - **VERY_LOW**: do NOT show; flag as *"unsupported claim — needs more data"*.

**Retroactive audit**: at run start, re-weight existing claims in `product_docs/` and flag claims whose bucket dropped since last run.

**Persona anchor re-ranking**: anchor lists should reflect weight computation, but narrative is human-curated. PROPOSE "promote X" / "demote Y" via R7; do NOT auto-rewrite narrative.

### G2 — Code-grounded capability

Positioning differentiator claims must include a code pointer (file + line OR module:symbol).

Procedure:
1. For every proposal touching a positioning differentiator, check that the proposed claim text includes a code reference.
2. Grep the repo to verify the reference exists.
3. If missing or broken, surface to user:
   > *"Claim [X] has no valid code pointer. Provide one (file:line), drop the claim, or mark as aspirational?"*

Do NOT silently drop — always surface.

### G3 — No editorializing

Scan drafted text for: `biggest`, `single largest`, `core bet`, `the unlock`, `the killer feature`, `the moment`, `the answer`, `game-changer`, `revolutionary`, `transforms`, `redefines`.

If found, surface:
> *"Proposed text contains editorializing: [highlighted phrase]. Suggest neutral wording: [neutral rewrite]. Approve original / approve rewrite / edit?"*

---

## Error handling

- **Notion unreachable / 401**: skip Notion-dependent rules (R3, R4, R5, R6 Notion-trigger paths, R7 anchor checks, R12). Run git-dependent rules anyway. Report in summary.
- **Tag mismatch** (interviewee has a tag not in controlled set, not `tag-pending`): STOP the run. Show clear error pointing at the offending row + Notion URL. Don't auto-fix.
- **Code pointer broken** (G2 fails): surface the prompt; user decides per claim.
- **User cancels mid-review**: save partial state up to the last completed rule; on next run, resume from there.
- **G1 VERY_LOW**: don't show proposal; flag in summary.

---

## First-run bootstrap

When state is null:

1. Surface: *"No prior state. First sync — full audit + discovery. Continue?"*
2. On yes, populate initial state with known Notion source IDs:

```json
{
  "research_db":         "2f1be682-21dc-8029-983c-d8049b958856",
  "building_logs_db":    "2b2be682-21dc-802b-a84e-eb4398b5d049",
  "product_documents_db":"2b2be682-21dc-80e3-a9a1-e445fb04aeb2",
  "system_prompts_db":   "2b5be682-21dc-809b-833c-e87ab6ed4135",
  "mvp1_research_db":    "2b7be682-21dc-8016-bb31-f4512369861c",
  "qual_1_db":           "2f7be682-21dc-804f-9725-d1a28d99b7cd",
  "qual_3_db":           "310be682-21dc-8055-bcdb-e100eccd1bb0",
  "qual_2_page":         "300be682-21dc-801b-aa61-c9c344e29e6a",
  "qual_4_page":         "35dbe682-21dc-8175-a6ac-d23dc93c664d",
  "building_qualia_page":"2a9be682-21dc-8021-9a28-f0ec76ac588d"
}
```

3. Query the Research DB and prime `state.research_sources_seen` with every page id returned — this marks the existing `research.md` Sources table as the trusted baseline. (Without this, R3 would over-fire on the first real sync, proposing to re-add every source the founder already curated.)
4. Initialize `state.gtm_log_seen_signatures` to `[]`. R14 (GTM-log gap detection) populates it as building-log imports are accepted on subsequent runs.
5. Set `last_synced_commit_sha` to current `staging` HEAD.
6. Set `last_discovery_at` to today (known sources just imported).
7. Run full Tier 1 + skip Tier 2 (no baseline to compare).
8. Save state. Report: *"State initialized. Future runs detect changes from this baseline."*

---

## Run summary template

At the end of every run:

```
sync-product-docs run summary — <timestamp>

Tier 1 (auto-applied):
  R1: <N docs date-stamped>
  R2: <N commits appended to roadmap>
  R3: <N research sources added>
  R4: <N participants added>
  R5: <recomputed: yes/no>

Tier 2 (proposed):
  Shown: <N>, Approved: <M>, Skipped: <K>, Edited: <L>

R6 decisions:
  Prompts: <N>, Added to decisions.md: <K>

Guardrails:
  G1 retroactive flagged: <N stale claims>
  G2 broken pointers: <N>
  G3 editorializing flagged: <N>

Errors / skipped rules:
  <list>

Next discovery sweep: <date>
```
