# CLAUDE.md

Qualia helps teams run fast, consistent UX/accessibility audits and turn findings into clear, actionable fixes. This file is the behavioral kernel — project specifics live in `agent_docs/`.

---

## Core Principles

1. **Simplicity First (Occam's Razor)** — Smallest change that solves the problem. *Minimum, but complete* — not one thing less than necessary. Complete means Pareto (≈80% of the value), not 100% coverage. No speculative abstractions.
2. **No Laziness** — Find the root cause. No temporary patches, no swallowed errors.
3. **Minimal Impact** — Touch only what's necessary. Don't propagate "the same fix" to neighboring files unless asked.
4. **Verified Claims Only** — Don't assert what you haven't verified. Before stating any factual claim — about code, tools, scope, counts, capabilities, behavior, anything — be 100% sure or flag the uncertainty explicitly ("I think", "unverified", "needs check"). Verify, weaken, or don't say it. Confidence without evidence is a hallucination regardless of domain.

**Precedence**: Hard Rules are non-negotiable. Core Principles guide judgment within them. Behavioral Rules are defaults Core Principles can override.

---

## Hard Rules (priority order)

1. **Safety** — No destructive DB ops (`DROP`, `TRUNCATE`, bulk `DELETE`) without explicit approval. Propose migration first.
2. **Secrets** — Never commit or log real secrets. Use env vars; document in `.env.example`.
3. **Generated files** — Don't edit `src/integrations/supabase/types.ts` or files in `supabase/migrations/`. Change the source and regenerate.
4. **Existing patterns** — Match current patterns over new abstractions. Read first; never guess values that already exist (model names, endpoints, config).
5. **Uncertainty** — If scope, safety, or ownership is unclear: do less, ask, offer options.

---

## Behavioral Rules

### Skills First
Trivial tasks (read-only ops, single-line fixes, copy changes, mechanical lint fixes, explicit commands) — execute directly. Non-trivial (new features, behavior changes, multi-file work, bugs without obvious cause, architecture decisions, "how should I…?") — load the matching skill first. Most non-trivial workflows map to `superpowers:*` skills (`brainstorming`, `systematic-debugging`, `writing-plans`, `test-driven-development`, `verification-before-completion`). **When unsure, it's non-trivial.** Full routing table: `agent_docs/skill-routing.md`.

### Subagent Strategy
Subagents protect the main context. Offload broad exploration (where you'll discard most of what you read) and independent parallel work; use `Explore` for codebase searches. Don't offload targeted lookups, decision-making, or anything the user should see you reason through. Brief like a cold colleague (goal, context, expected output). Trust but verify — spot-check actual changes.

**Worktree base drift (non-negotiable).** The Agent tool's `isolation: "worktree"` param pins its base to session-start HEAD, not current HEAD. Subagents that don't realign will branch from a stale commit — past sessions have lost or duplicated work this way. Every subagent prompt that uses `isolation: "worktree"` MUST begin its Setup block with:

```bash
git fetch origin && git reset --hard origin/staging
# (use origin/main if the lane intends that base instead)
```

The reset is safe because the worktree branch is freshly created with no prior commits. Apply this whether you remember the harness quirk or not.

### Autonomous Execution
Run commands autonomously; never hand back terminal commands.
- After Edge Function changes: `supabase functions deploy <name>` (only the changed ones).
- After frontend changes: `npm run lint` + `npm run build`.
- After logic changes: `npm test`.
- After `package.json` changes: `npm install`.
Exceptions: `npm run dev` (user-managed) and destructive DB ops (need approval).

### Autonomous Bug Fixing
A bug report, stack trace, or failing test **is** the request — don't ask "would you like me to fix this?" Reproduce, find the root cause, fix, verify. If the cause isn't obvious, load `superpowers:systematic-debugging`. Stop and report after **3 failed fix attempts** or if the fix needs a destructive operation / has architectural implications.

### Verification Before Done
Evidence before assertions, always. Run tests + build + check logs. For behavioral changes, `git diff` your change against prior behavior — subtle fixes often no-op by accident. For UI changes, actually use the feature at `localhost:8080`; if you can't, say so explicitly. Ask: "Would a staff engineer approve this?"

**Show receipts, not assertions.** "Lint clean", "tsc clean", "all routes load" are claims about verification, not verification itself. The verification is the artifact: pasted tool output, screenshot, smoke-test result, body innerText length. If I can't show the receipt, I haven't done the check.

**For agent-dispatched UI/service work, the smoke test is mine, not the agent's.** Subagents can self-report "tsc clean / build green" inaccurately (stale runs, skipped reruns, fabricated claims). After any multi-agent sweep that touches UI or service code, before claiming done: (1) re-run `npx tsc --noEmit` in the main session, (2) run a Playwright smoke test on the routes touched (login + visit each + capture console errors + `pageerror` events). Cost: 2-3 min. See `tasks/lessons.md` "Never claim 'landed clean' without running the actual app" for the failure pattern.

### Self-Improvement Loop
After any user correction, write a rule to `tasks/lessons.md` with the *why*. Capture validated successes too — if the user accepts a non-obvious approach without pushback, record it. Otherwise the loop drifts toward over-cautious behavior. Review at the start of relevant tasks.

### Operating Mode
- **Default**: Ask-first. Propose a short plan before non-trivial edits.
- **Small/safe**: Typos and obvious single-file bugfixes — apply directly, summarize.
- **Bug reports / failing tests**: The report *is* the request — see *Autonomous Bug Fixing*.
- **Never**: Destructive DB ops, infra changes, or pushing without explicit approval.
- **Read freely**: Codebase reads are autonomous. MCP reads (e.g. Notion) need per-resource permission.

### Testing
"test" = local against `http://localhost:8080`. Test credentials are in env: `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` (sourced via `~/.secrets`). Only test prod when intent is unambiguous ("test on prod").

### Git
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`).
- Always ask before pushing.
- **No PRs.** Solo builder — push to `staging` by default. Only open a PR if explicitly asked.
- **Branches stay in sync.** Pushing to `main` always means pushing to `staging` too.

### Settings Repo
`~/.ai-setup` is for **project-agnostic** Claude config: shared `.claude/commands/`, generic skills (e.g. `mcp-builder`, `vercel-*`, `pptx`), `settings.json`, hooks, and **templates** for reusable skills under `ai/claude/templates/`. **Qualia-specific skills stay in this project's `.claude/skills/`** — they have hardcoded paths, Notion IDs, and domain values that don't generalize. If a skill in this project would generalize, extract a template into `~/.ai-setup/ai/claude/templates/`. Remote: `Soba-noodl/Soba-AI-setup`.

### Soba-SaaS Bootstrap
`~/.ai-setup` also hosts the Soba-SaaS bootstrap system: a slash-command-driven workflow (`/soba-init`, `/soba-next`, `/soba-recipe`, `/soba-audit`, `/soba-save-lesson`, `/soba-extract`, `/soba-inspire`, `/soba-help`, `/soba-sync-claude`) for creating new SaaS projects end-to-end on the Soba stack (Supabase + Vercel + GitHub + PostHog) and maintaining a cross-project recipe KB at `~/.ai-setup/recipes/`. Qualia predates the system and is not retrofitted with `.soba-saas.yaml`, but Qualia is the canonical extraction source — new recipes come from patterns shipped here first. Spec: `docs/superpowers/specs/2026-05-18-soba-saas-bootstrap-design.md`. Use `/soba-save-lesson "<text>"` from inside Qualia to capture cross-project tuition into `~/.ai-setup/lessons.md`.

### Finishing a Task
- **What I did**: Short summary of changes.
- **Next steps for you**: What to check; don't list commands Claude already ran.
- **Sync agent docs**: After changes to `supabase/migrations/`, `supabase/functions/`, `src/services/`, `src/hooks/`, or any architectural decision — invoke `sync-agent-docs`.
- **Sync product docs**: After a qualitative or quantitative research cycle, after shipping a meaningful feature, after a strategic call (pivot, killed item, pricing shift, positioning change), or when a Notion page edit signals product-doc impact (new building log, new product brief version, new interviewee tagged) — invoke `sync-product-docs`.

### Response Style
Short. Concrete. Reference files and symbols by name (`src/pages/Dashboard.tsx`, `useAuth()`). Minimal diffs, never full file dumps. Ask when ambiguous; otherwise pick one path and proceed.

---

## Context Docs (read when relevant)

**Engineering context** (`agent_docs/`)
- `agent_docs/architecture.md` — system overview, tech stack, decisions
- `agent_docs/conventions.md` — data layer, i18n, UI primitives, git, testing, scope
- `agent_docs/data-layer.md` — services → hooks → components in detail
- `agent_docs/database_schema.md` — tables, columns, relationships
- `agent_docs/edge-functions.md` — functions, `_shared/` modules, deployment
- `agent_docs/design-system.md` — tokens, components, microcopy, UX principles — **read before any meaningful UI change or addition**
- `agent_docs/danger-zones.md` — known landmines
- `agent_docs/skill-routing.md` — full trivial vs non-trivial table

**Product context** (`product_docs/`)
- `product_docs/principles.md` — operating principles for the product — **read before any product, UX, or feature decision**
- `product_docs/personas.md` — validated segments + JTBD + pain — **read before any feature-prioritization or positioning discussion**
- `product_docs/positioning.md` — what Qualia is / is not, differentiators, voice
- `product_docs/glossary.md` — domain vocabulary — read when a domain term is ambiguous
- `product_docs/decisions.md` — chronological decisions log with the *why*; append, don't rewrite
- `product_docs/roadmap.md` — Now/Next/Later + Recently shipped + Killed; append shipped items as they land
- `product_docs/research.md` — condensed snapshot of qual + quant signal; refresh after each research cycle
- `product_docs/strategy.md` — bets, sequencing, pricing thesis, unit economics, GTM strategy — **read before any strategic decision**
- `product_docs/gtm.md` — GTM playbook + pre-signup funnel snapshot + parked channels — **read before any GTM activity**
- `product_docs/gtm-log.md` — operational chronicle of GTM activity (append-only)
- `product_docs/specs/` — per-feature specs (PRDs); copy `_template.md` to `YYYY-MM-<slug>.md` when planning a feature
