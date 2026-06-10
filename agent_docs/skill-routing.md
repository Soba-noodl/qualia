# Skill Routing

When to invoke a skill before acting. Trivial = execute directly. Non-trivial = load the skill first. **When unsure, treat as non-trivial.**

## Trivial (skills NOT required — execute directly)

| Category | Examples |
|---|---|
| Read-only operations | "Where is X defined?", "Show me the auth hook", search/grep requests |
| Explicit commands | "Run `npm install`", "Deploy the audit function", "Stage and commit" |
| Single-line fixes with obvious cause | Typo in a string, missing import, wrong prop name, broken URL |
| Copy changes (no layout impact) | "Change 'Submit' to 'Save'", adding/removing a sentence |
| Linter/type fixes where the fix is mechanical | "Fix the `any` type on line 42", missing useEffect dependency |
| File/lint/test checks | "Run lint", "Check if tests pass" |

## Non-trivial (skills REQUIRED — invoke before acting)

| Category | Trigger → Skill |
|---|---|
| New feature or component | "Add a search bar", "Create a team settings page" → `superpowers:brainstorming` |
| Modifying existing behavior | "Change how audit scores are calculated", redirect logic changes → `superpowers:brainstorming` |
| UI/layout changes (non-trivial) | "Move the save button", "Redesign the dashboard header" → `superpowers:brainstorming` |
| Visual or interactive output | "Show me mockups for...", "Make a landing page" → `superpowers:brainstorming` |
| Data model / DB changes | "Add a column to audits", "Create a new table" → `superpowers:brainstorming` |
| Architecture / pattern decisions | "Should we use React Query or context?" → `superpowers:brainstorming` |
| "How should I…?" / "What's the best way…?" | Any recommendation-asking → `superpowers:brainstorming` |
| Bugs without obvious cause | "Sometimes the audit fails", "The score is wrong" → `superpowers:systematic-debugging` |
| New dependency or integration | "Add Stripe", "Connect to Notion API" → `superpowers:brainstorming` |
| Process/rules/meta changes | Modifying skills, agent instructions | → `superpowers:brainstorming` |
| Multi-step implementation | Any feature touching multiple files → `superpowers:writing-plans` or `superpowers:incremental-implementation` |
| Claiming work is done | Before commit/PR → `superpowers:verification-before-completion` |
| Production-grade UI code | Complex UI components → `frontend-design:frontend-design` |

## The Gate

1. Match against the trivial table — if it fits cleanly, execute directly.
2. If non-trivial **or unsure**, load the skill via the `Skill` tool, announce usage, apply proportionally.
3. **When unsure, it IS non-trivial.** Err on the side of using the skill.
