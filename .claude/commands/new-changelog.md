---
allowed-tools: Read, Edit, Bash(git log:*), Bash(git show:*)
description: Draft and write a new changelog entry based on commits since the last entry
---

## Context

- Last changelog entry date: !`node -e "const f=require('fs').readFileSync('src/utils/translations/changelog.ts','utf8');const m=f.match(/changelogDate\d{8}\":\s*\"([^\"]+)\"/);console.log(m?m[1]:'unknown')"`
- Last version: !`node -e "const f=require('fs').readFileSync('src/utils/translations/changelog.ts','utf8');const m=f.match(/changelogVersion\d{8}\":\s*\"([^\"]+)\"/);console.log(m?m[1]:'unknown')"`
- Latest changelog entry key: !`node -e "const f=require('fs').readFileSync('src/lib/changelog.ts','utf8');const m=f.match(/dateKey:\s*\"(changelogDate(\d{8}))\"/);console.log(m?m[2]:'unknown')"`
- Commits since last entry: !`git log --oneline --format="%h %ad %s" --date=short $(git log --oneline --format="%h" --after="$(node -e "const f=require('fs').readFileSync('src/utils/translations/changelog.ts','utf8');const m=f.match(/changelogDate(\d{8})\":\s*\"([^\"]+)\"/);if(m){const d=m[2];const y=d.slice(0,4),mo=d.slice(4,6),da=d.slice(6,8);console.log(y+'-'+mo+'-'+da);}else{console.log('2026-04-30');}")" | tail -1).. 2>/dev/null || git log --oneline --format="%h %ad %s" --date=short -20`
- Today's date: !`date +%Y-%m-%d`

## Your task

You are writing a new changelog entry for the Qualia product changelog. Follow these steps exactly:

### Step 1 — Analyze the commits

Read the commit list above. Filter to **user-facing changes only** — ignore docs, chores, internal refactors, and test changes. Group remaining commits into themes (e.g. "MCP improvements", "new UI feature", "bug fixes").

### Step 2 — Decide the release level

Apply this rubric:
- **`major`**: new capability that didn't exist before (new feature category, new integration, public launch)
- **`important`**: significant reliability fix to an existing feature, notable UX improvement, or multiple meaningful fixes that users will notice
- **no label (omit `releaseLevel`)**: minor fixes, polish, internal improvements

### Step 3 — Draft the entry

Produce:
- **Date**: today in the format used by existing entries (e.g. "May 5, 2026")
- **Version**: increment the patch version of the last entry (e.g. v9.0 → v9.1), or minor if it's a significant release
- **Title**: short (≤7 words), names the 2–3 main themes, no verb
- **Body**: 1–2 sentences. What changed and why it matters to the user. No technical jargon. Match the tone of existing entries exactly.
- **3 bullet items**: each one specific and user-facing. Start with the outcome ("X is now Y"), not the mechanism. ≤25 words each.

Then produce the **Italian translation** of all five fields, matching the tone of existing Italian entries.

### Step 4 — Write to the codebase

**File 1: `src/lib/changelog.ts`**

Add a new entry object at the **top** of the `entries` array inside the most recent month (or create a new month section if the date is in a new month). Use the date as the key suffix (YYYYMMDD format).

Example shape:
```ts
{
  dateKey: "changelogDate20260505",
  versionKey: "changelogVersion20260505",
  titleKey: "changelogTitle20260505",
  bodyKey: "changelogBody20260505",
  itemKeys: ["changelogItem20260505A", "changelogItem20260505B", "changelogItem20260505C"],
  releaseLevel: "important", // omit if no label
},
```

If the date is in a new month (not already in `CHANGELOG_MONTHS`), add a new month object at the top of the array with the appropriate `id` and `labelKey`.

**File 2: `src/utils/translations/changelog.ts`**

Add all new translation keys at the top of the `en` block (just after `changelogNavLabel`) and at the top of the `it` block. Include:
- `changelogDateYYYYMMDD`
- `changelogVersionYYYYMMDD`
- `changelogTitleYYYYMMDD`
- `changelogBodyYYYYMMDD`
- `changelogItem20260505A/B/C`

If a new month label key is needed, add `changelogMonthMMMYYYY` in both languages too.

Also update the `changelogUpdatedLabel` date in `src/pages/Changelog.tsx` to today's date key.

### Step 5 — Confirm

After writing both files, report:
- The entry you wrote (English version)
- The release level chosen and why
- The version number
