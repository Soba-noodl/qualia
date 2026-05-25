# Testing Strategy

## Two tools, two jobs

### Playwright (`e2e/`)
Saved, script-based browser tests. Run a full flow end-to-end and assert on the result.

**Use it when:**
- You want a regression test that runs automatically on every deploy (CI)
- The flow is stable and unlikely to change often (login, audit creation, billing)
- You need assertions, not just observation

**Its value is automation, not the tests themselves.** Without CI running them, Playwright is just a slower browser-use.

---

### browser-use (CLI)
Ad-hoc, interactive browser control from Claude Code. No script to write — Claude drives the browser command by command in real time.

**Use it when:**
- Checking if a UI change looks/works right after a fix
- Walking through a flow manually to verify behavior
- Exploratory testing where you're not sure what you're looking for yet
- The UI is changing fast and maintaining a Playwright script would be friction

---

## Current recommendation

Qualia is an early-stage MVP with no CI pipeline running Playwright automatically. At this stage:

- **Playwright suite**: don't delete it, but don't invest in growing it
- **browser-use**: default tool for UI verification after changes

When CI is set up to run `e2e/` on every push, promote the most critical paths (login, create audit, view results) into proper Playwright specs.

---

## Running Playwright manually

```bash
npx playwright test          # all specs
npx playwright test e2e/auth # specific file
npx playwright test --headed # visible browser (debug mode)
```

Credentials and base URL come from `.env.e2e`.
