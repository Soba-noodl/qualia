<!--
This repo is a snapshot artifact (MIT). PRs are not actively reviewed.
If you're submitting one anyway, this template makes it easier for a
future maintainer (or another fork operator) to evaluate.
-->

## What

<!-- Short summary of the change. -->

## Why

<!-- Motivation. Skip if it's obvious from the diff. -->

## How tested

<!-- Receipts, not assertions. Paste relevant `npm run lint` / `npm test`
/ `npm run test:e2e` / `deno test` output. Screenshots for UI changes. -->

## Checklist

- [ ] Existing tests still pass locally
- [ ] If touching auth / RLS / Supabase migrations: read `agent_docs/danger-zones.md` first
- [ ] No new hardcoded operator-specific values (URLs, project IDs, personal emails) — see `agent_docs/danger-zones.md` → "vercel.json — Strict Schema, No Comments" + `tasks/lessons.md` → "Cron secrets live in TWO stores"
- [ ] If changing an Edge Function: redeployed via `supabase functions deploy <name>`
- [ ] Conventional Commits used in the commit message(s)
