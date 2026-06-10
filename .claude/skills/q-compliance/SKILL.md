---
name: q-compliance
description: Codebase deterministic compliance audit. Reads Hard Rules tables in agent_docs/design-system.md and agent_docs/conventions.md and enforces them via a hybrid ESLint plugin + custom runner. Triggers on /q-compliance, "run compliance", "lint the rules".
---

# /q-compliance

Deterministic linter that enforces every yes/no rule defined in the Hard Rules
tables of `agent_docs/design-system.md` and `agent_docs/conventions.md`.

It is the *truth* skill — a sibling to `q-ux-audit`, which is the *judgment*
skill. Use this when you want a fast machine answer to "does the code comply
with our rules?", not "is this a good design?".

## When to use

- After implementing a feature, before staging.
- After a bulk refactor, to find regressions.
- During the rework backlog, to find candidates for the next batch.
- In CI on the diff, to block obviously broken changes.

## Inputs

`/q-compliance [scope] [flags]`

| Scope input | Resolves to |
|---|---|
| (no args) | changed files since `main` |
| `full repo` / `everything` / `scan all` / `--full` | full repository |
| `src/components/audit` (any path) | scoped to path |
| `--since main` / `--since HEAD~5` | changed since ref |

| Flag | Effect |
|---|---|
| `--include-warn` | Show `warn`-tier findings (default: error only) |
| `--include-info` | Show `info`-tier findings (default: error only) |
| `--fix` | Dry-run autofix; produces `proposed-changes.diff` |
| `--apply` | Apply fixes (only with `--fix`); commits to a separate branch with verifier-gate guards |

## Procedure

```bash
grep -q '"compliance"' package.json || { echo "ERROR: 'compliance' script not found in package.json. Either add it: \"compliance\": \"tsx scripts/compliance/run.ts\" — or invoke directly via the tsx command below."; }
```

```bash
npm run compliance -- [scope] [flags]
# or:
tsx scripts/compliance/run.ts [scope] [flags]
```

What the runner does:

1. Resolves scope to a file list via `git ls-files` or `git diff --name-only`.
2. Reads the rule registry from both Hard Rules markdown tables.
3. Runs three engines in parallel and merges findings:
   - `qualia-compliance` ESLint plugin (per-file AST rules)
   - `eslint-plugin-jsx-a11y` (mechanical accessibility)
   - Custom runner (`scripts/compliance/runners/runner.ts`) for cross-file rules
4. Applies waivers (inline pragmas + `.q-compliance-waivers.json`).
5. Filters by severity (default: error only).
6. Writes reports to `tmp-qa/q-compliance/<timestamp>/`.

## Outputs

- `tmp-qa/q-compliance/<timestamp>/report.md` — findings grouped by rule
- `tmp-qa/q-compliance/<timestamp>/worst-files.md` — files ranked by violation count
- `tmp-qa/q-compliance/<timestamp>/findings.json` — machine-readable
- `tmp-qa/q-compliance/<timestamp>/waivers-audit.md` — every active waiver
- `tmp-qa/q-compliance/<timestamp>/proposed-changes.diff` — only with `--fix`

## Waiver mechanism

```tsx
// q-disable-next-line DS-COLOR-001 (auth panel uses light surface by design)
<div className="bg-white text-slate-900">…</div>
```

```tsx
// q-disable DS-COLOR-001 (entire file is the auth surface)
```

Or, repo-root `.q-compliance-waivers.json`:
```json
{ "src/components/landing/PluginMockups.tsx": { "DS-COLOR-002": "intentional yellow per landing brand" } }
```

**Reason required.** A waiver without `(reason)` fails the run.

## What it does NOT do

- No judgment-based UX review — that's `q-ux-audit`.
- No rules outside the docs — every rule lives in a Hard Rules table or it
  doesn't exist.
- No LLM in the fix path — fixes are deterministic literal transforms only.

## Adding a new rule

1. Add a row to the Hard Rules table in the appropriate doc (design-system.md or conventions.md).
2. Run `npm run lint:rules` — validates syntax (regex compiles, severity valid, engine recognised).
3. If `engine: runner`: add a rule file in `scripts/compliance/runner-rules/` and register it in `run.ts`.
4. If `engine: eslint:<id>`: add a rule file in `scripts/compliance/eslint-plugin/rules/` and export it from `index.cjs`.
5. Run `/q-compliance --include-warn` against a known-violating file to confirm.
6. Bump severity to `error` once it's stable.

## Common mistakes

| Mistake | Fix |
|---|---|
| Editing `Detect-by` to prose, not regex/AST/eslint | Wrap the regex in backticks. The first `regex:` code-span wins. |
| Claiming `Auto-fixable: true` without a literal transform | The runner ignores `autoFixable: true` unless the rule emits a `fixTransform`. |
| Running `/q-compliance --apply` on a dirty tree | The verifier gate may roll back. Stash first. |
| Adding a waiver without a reason | Hard error. Document why or unwaive. |
