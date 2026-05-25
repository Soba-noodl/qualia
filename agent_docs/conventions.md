# Conventions

Single source of truth for architectural, code-quality, security, and process rules in the Qualia app. **Read this before writing or reviewing any non-trivial change.** This document is also the rule source for the architectural-compliance linter (Skill 1) — every deterministic rule below has a stable ID the linter can reference.

> **Doc structure**
> 1. **Hard Rules** — deterministic, machine-checkable rules with stable IDs. Hoisted to one place; topical sections below clarify rationale.
> 2. **Data Layer** — strict layering rules (services → hooks → components).
> 3. **i18n** — translation system & rules.
> 4. **Routing & Navigation**.
> 5. **TypeScript**.
> 6. **Security**.
> 7. **TanStack Query**.
> 8. **Dates**.
> 9. **Error handling & logging**.
> 10. **Async & effects**.
> 11. **Imports & module hygiene**.
> 12. **Comments & test discipline**.
> 13. **Git, deploy, scope**.
> 14. **Rework Backlog**.
>
> The **visual / UI** ruleset (colors, spacing, primitives, a11y, microcopy) lives in `agent_docs/design-system.md` (`DS-*` IDs). This file does not duplicate those — cross-references only.

---

## 1. Hard Rules (Linter SOT)

Format: `ID | Rule | Detect-by | Severity | Fix`. Severity: **error** (blocking), **warn** (review), **info** (nudge). `Detect-by` is one of:
- `regex: <pattern>` — runs ripgrep across the relevant glob.
- `ast: <selector or AST description>` — for things regex can't catch.
- `eslint: <rule-name>` — defers to an ESLint rule (plugin specified inline).

### `ARCH-*` — Architecture / data layer

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `ARCH-001` | Components in `src/components/**` and `src/pages/**` MUST NOT import `@/integrations/supabase/client` directly. Go through a hook (`src/hooks/`) or a service (`src/services/`). | `ast: ImportDeclaration with source matching ^@/integrations/supabase/client$ in files under src/components/** or src/pages/**` (also: `regex: from ["']@/integrations/supabase/client["']` over `src/components/**/*.{ts,tsx}` and `src/pages/**/*.{ts,tsx}`) | runner (path-scoped, error) + eslint:no-restricted-imports (repo-wide warn, complementary import-site signal) | error | false | Add a function to the relevant `src/services/<domain>.service.ts` and a `src/hooks/use-<domain>.ts` wrapper, then consume the hook |
| `ARCH-002` | Components MUST NOT call `supabase.auth.admin.*`. Admin auth APIs are server-only (Edge Functions). | `regex: \bsupabase\.auth\.admin\.` over `src/**/*.{ts,tsx}` (also: `eslint:no-restricted-syntax` selector on the member-expression chain, scoped out of `supabase/functions/**`) | eslint:no-restricted-syntax + runner | error | false | Move the call to an Edge Function under `supabase/functions/` |
| `ARCH-003` | Generated files MUST NOT be edited by hand: `src/integrations/supabase/types.ts` and any file under `supabase/migrations/`. | `git-diff hint: any change touching src/integrations/supabase/types.ts or supabase/migrations/**` | runner | error | false | For `types.ts`: regenerate via `supabase gen types typescript --project-id <id>`. For migrations: create a new migration with `supabase migration new <name>` |
| `ARCH-004` | Hooks MUST NOT issue raw Supabase table calls — they own React-Query state, services own DB I/O. | `eslint:no-restricted-syntax` — `CallExpression[callee.object.name='supabase'][callee.property.name='from']` scoped to `src/hooks/**` via flat-config (Wave 2; at error severity) | eslint:no-restricted-syntax | error | false | Move the call into a service in `src/services/` |
| `ARCH-005` | Services MUST NOT import from `@tanstack/react-query`. Services are framework-agnostic; hooks own caching. | `eslint:no-restricted-imports` (path-scoped to `src/services/**/*.ts`) | eslint:no-restricted-imports | error | false | Wrap the service call in a hook under `src/hooks/` |
| `ARCH-006` | Services MUST NOT import React hooks (`useState`, `useEffect`, `useMemo`, etc.) or any file under `src/components/`, `src/pages/`, `src/contexts/`. | `eslint:no-restricted-imports` (path-scoped to `src/services/**/*.ts`) | eslint:no-restricted-imports | error | false | Move React-dependent code to a hook |
| `ARCH-007` | Cross-runtime imports between Figma plugin sandbox and UI are forbidden. `figma-plugin/src/code.ts` (sandbox) MUST NOT import from `figma-plugin/src/ui/**`, and vice versa. Communication is via `postMessage`. | `eslint:no-restricted-imports` — `patterns: [{ group: ["**/ui/*", "**/ui/**"] }]` scoped to `figma-plugin/src/code.ts` and non-ui/ files via flat-config (Wave 2) | eslint:no-restricted-imports | error | false | Use `figma.ui.postMessage` / `parent.postMessage` |
| `ARCH-008` | Shared Edge Function logic MUST live in `supabase/functions/_shared/`. Don't duplicate Gemini model name, plugin token validation, quota checks, or error logging into individual functions. | `eslint:no-restricted-syntax` — `Literal[value=/^gemini-[a-z0-9.-]+$/]` scoped to `supabase/functions/**` via flat-config; `_shared/` excluded by override (Wave 2; 5 existing violations) | eslint:no-restricted-syntax | warn | false | Import from `_shared/` |

### `I18N-*` — Internationalization

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `I18N-001` | No hardcoded user-facing strings as JSX text children. Wrap in `t('...')` from `useLanguage()`. Punctuation-only text (`"·"`, `","`), numbers, and pure whitespace are exempt. | `ast: JSXText whose trimmed value matches /[A-Za-z]{2,}/ AND is not the immediate child of a t() call expression` over `src/components/**/*.tsx` and `src/pages/**/*.tsx` (excluding `src/components/ui/**`) | runner | error | false | Add a key to the relevant `src/utils/translations/<domain>.ts` and use `t('key')` |
| `I18N-002` | No hardcoded string literals in user-facing attributes: `aria-label`, `placeholder`, `title`, `alt` (when non-empty). Use `t()` or a constant that itself comes from `t()`. | `ast: JSXAttribute name in {aria-label, placeholder, title, alt} with value of type StringLiteral whose trimmed length > 0` over `src/components/**/*.tsx` and `src/pages/**/*.tsx` (excluding `src/components/ui/**`) | runner | error | false | Use `t('key')` |
| `I18N-003` | Every `t('foo.bar')` must resolve to a real key in `src/utils/translations/`. Dead keys (defined but never referenced) are also flagged. | `ast: scan all t(<StringLiteral>) calls; cross-check against keys exported from src/utils/translations/index.ts` | runner | error | false | Add the key, or remove if unused |
| `I18N-004` | English (`en`) is the source of truth in `src/utils/translations/`. Any key present in `it` but missing in `en` (or vice versa) is a defect. | `ast: per-domain compare of en vs it key sets` | runner | warn | false | Add the missing translation |
| `I18N-005` | Don't import a domain translation file (e.g. `@/utils/translations/audit`) directly inside a component. Always go through `useLanguage()` / `t()`. | `regex: from ["']@/utils/translations/(?!index)` over `src/components/**` and `src/pages/**` | runner | warn | false | Use `const { t } = useLanguage()` |

### `NAV-*` — Navigation

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `NAV-001` | No `<a href="/...">` for internal navigation. Use `<Link to="...">` from `react-router-dom`. External links (`http://`, `https://`, `mailto:`, `tel:`) are exempt. | `ast: JSX <a> with href attribute whose value starts with "/"` over `src/**/*.tsx` (excluding `src/components/ui/**`) | eslint:no-anchor-internal | error | true | Replace with `<Link to="...">`. Add `target="_blank" rel="noopener noreferrer"` only for external links |
| `NAV-002` | Don't call `window.location.assign` / `window.location.href = ...` for in-app navigation. Use `useNavigate()`. External redirects (OAuth) are the exception and should be commented as such. | `eslint:no-restricted-syntax` — `window.location.assign/replace` CallExpression + `window.location.href` AssignmentExpression; posthog.ts excluded via flat-config override (Wave 2) | eslint:no-restricted-syntax | warn | false | Use `const navigate = useNavigate(); navigate(path)` |

### `TYPE-*` — TypeScript

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `TYPE-001` | No explicit `any`. | `eslint: @typescript-eslint/no-explicit-any` (already configured; relaxed for `supabase/functions/**` and `src/components/ui/**`) | eslint:@typescript-eslint/no-explicit-any | error | false | Use a real type, `unknown`, or a discriminated union |
| `TYPE-002` | No `as any` casts. Even when the underlying value is awkward, prefer `as unknown as T` with a comment explaining why. | `eslint:no-restricted-syntax` — `TSAsExpression[typeAnnotation.type='TSAnyKeyword']` (Wave 2; `as unknown as T` does not match — different AST shape) | eslint:no-restricted-syntax | warn | false | Replace with a real cast or a type guard |
| `TYPE-003` | Non-null assertions (`!`) on values that could be null require an inline comment explaining invariants. Already-narrowed values are fine. | `eslint: @typescript-eslint/no-non-null-assertion` (currently `warn`, phased rollout — see Wave 1 spec) | eslint:@typescript-eslint/no-non-null-assertion | warn | false | Add a guard, or annotate `// non-null: <reason>` |
| `TYPE-004` | Don't use `@ts-ignore`. Use `@ts-expect-error` with a comment, so the directive errors when the underlying issue is fixed. | `eslint:@typescript-eslint/ban-ts-comment` — `ts-ignore: true, ts-nocheck: true, ts-expect-error: false` (Wave 2; 0 current violations) | eslint:@typescript-eslint/ban-ts-comment | warn | false | Replace with `@ts-expect-error <reason>` |

### `SEC-*` — Security

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `SEC-001` | No hardcoded secrets. Forbid: API key prefixes (`sk_live_`, `sk_test_`, `pk_live_`), full-string JWTs (`eyJ[A-Za-z0-9_\-]{20,}`), and explicit service-role key strings. | `regex: \b(sk_(live\|test)_[A-Za-z0-9]{16,}\|eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,})\b` over `src/**` and `supabase/functions/**` | runner | error | false | Move to env var; document in `.env.example`; rotate the leaked secret |
| `SEC-002` | The React `dangerouslySetInnerHTML` prop is flagged for review. If used, the value MUST originate from a sanitizer (e.g. DOMPurify) or a trusted constant — annotate the call site. | `regex: dangerously` + `SetInnerHTML` (concatenated) over `src/**/*.{ts,tsx}` | runner | warn | false | Sanitize or restructure to render plain JSX |
| `SEC-003` | No `SUPABASE_SERVICE_ROLE_KEY` reference in `src/`. The service role key is server-only (Edge Functions). | `eslint:no-restricted-syntax` — `Identifier[name='SUPABASE_SERVICE_ROLE_KEY']` + `Literal[value='SUPABASE_SERVICE_ROLE_KEY']` (Wave 2) | eslint:no-restricted-syntax | warn | false | Remove; route privileged work through an Edge Function |
| `SEC-004` | `VITE_*` env vars are bundled into the browser. Never read a non-`VITE_` variable client-side via `import.meta.env`. | `regex: import\.meta\.env\.(?!VITE_\|MODE\b\|DEV\b\|PROD\b\|SSR\b\|BASE_URL\b)` over `src/**/*.{ts,tsx}` | eslint:qualia-compliance/sec-004-import-meta-env-allowlist | warn | false | Either rename to `VITE_*` (if truly public) or move the read into an Edge Function |
| `SEC-005` | External `<a target="_blank">` links MUST include `rel="noopener noreferrer"` to prevent reverse tabnabbing. | `ast: JSX <a> with target="_blank" missing rel containing both noopener and noreferrer` over `src/**/*.tsx` | runner | error | false | Add `rel="noopener noreferrer"` |
| `SEC-006` | Any new migration that runs `create table public.<name>` MUST also issue explicit `grant`s on that table to at least `service_role` (and to `authenticated` / `anon` if the Data API needs to read/write it) and `enable row level security`. From 2026-10-30 Supabase stops auto-granting `public` tables to API roles, so a missing grant means PostgREST `42501` errors at runtime. | `runner: per-file scan of supabase/migrations/*.sql created on/after 2026-05-14 — for each \bcreate\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)\b, require both a \bgrant\b ... \bon\b\s+(?:table\s+)?public\.\1\b and an \balter\s+table\s+public\.\1\s+enable\s+row\s+level\s+security\b in the same file` | runner | error | false | Append the grant/RLS block from §13 "New `public` tables — required migration template" to the migration before applying it |

### `REACT-*` — React

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `REACT-001` | List items rendered from `.map()` require a stable `key` prop (not array index when items can reorder/insert). | `eslint: react/jsx-key` (consider adding `eslint-plugin-react` if not present) | eslint:react/jsx-key | error | false | Use a stable id |
| `REACT-002` | `useEffect`/`useMemo`/`useCallback` deps must be exhaustive. | `eslint: react-hooks/exhaustive-deps` (already enabled at default; raise to `error`) | eslint:react-hooks/exhaustive-deps | error | false | Add the dep; if intentionally omitted, refactor or annotate |
| `REACT-003` | Components MUST NOT be defined inside other components (creates a fresh component on each render → remounts subtree). Memoised render-prop callbacks at the top level are fine. | `ast: FunctionDeclaration / VariableDeclarator with arrow returning JSX, declared inside another function whose name starts with capital letter` over `src/**/*.tsx` | eslint:no-nested-components | error | false | Move the inner component out, or convert to plain JSX |
| `REACT-004` | No direct DOM manipulation (`document.querySelector`, `document.getElementById`, `element.appendChild`, `element.style.*`) inside component render or effect bodies. Allowed in: tour/bridge utilities (`src/components/TourBridge.tsx`), `src/main.tsx`, and explicit `<input type="file">` proxies that click a hidden input. | `eslint:no-restricted-syntax` — document query/get CallExpression + .appendChild CallExpression + element.style AssignmentExpression (Wave 2; 42 existing violations) | eslint:no-restricted-syntax | warn | false | Use a `ref` and React state |
| `REACT-005` | No inline event-handler closures that capture re-rendering state when they're passed to memoised children. (Heuristic — flag for review only.) | `ast: JSXAttribute on*=... with ArrowFunctionExpression where parent is a memo()'d component import` | runner | info | false | Wrap in `useCallback` or hoist |

### `QUERY-*` — TanStack Query

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `QUERY-001` | Query keys MUST come from `src/lib/query-keys.ts`. Inline array literals (`['audits', id]`) are forbidden. | `eslint:no-restricted-syntax` — `useQuery/useInfiniteQuery/useMutation` options where `queryKey` ArrayExpression first child is a Literal (Wave 2; catches direct inline keys, misses variable indirection) | eslint:no-restricted-syntax | warn | false | Add or reuse a factory in `src/lib/query-keys.ts` (e.g. `queryKeys.audits.detail(id)`) |
| `QUERY-002` | `useQuery({ queryKey, queryFn })` `queryFn` MUST come from a service (`src/services/*.service.ts`) — not be defined inline with `supabase.from(...)`. | `ast: useQuery options object whose queryFn is an ArrowFunction containing supabase.from(` over `src/hooks/**/*.{ts,tsx}` | runner | error | false | Move the call into the service |
| `QUERY-003` | After successful mutations, invalidate queries by key factory, not by string array. | `eslint:no-restricted-syntax` — `invalidateQueries/setQueryData/getQueryData/removeQueries` where queryKey ArrayExpression first child is a Literal (Wave 2) | eslint:no-restricted-syntax | warn | false | Use `queryKeys.<domain>(...)` |

### `DATE-*` — Date formatting

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `DATE-001` | No `.toLocaleString()`, `.toLocaleDateString()`, `.toLocaleTimeString()`, or raw `new Date(...).toString()` for user-facing dates in components/pages. Use `formatDate`, `formatDateTime`, `formatRelativeTime`, `formatDateRange` from `src/lib/dateFormat.ts`. | `eslint:no-restricted-syntax` — `CallExpression[callee.property.name=/^toLocale(Date\|Time)?String$/]` (Wave 2; known false-positive on number.toLocaleString — accepted trade-off) | eslint:no-restricted-syntax | warn | false | Import from `@/lib/dateFormat` |
| `DATE-002` | `Intl.DateTimeFormat` use is allowed only in `src/lib/dateFormat.ts` and timezone-sensitive utilities (e.g. `useProjectDailyLimit` for Europe/Rome midnight). Elsewhere it bypasses the locale-neutral house style. | `regex: Intl\.DateTimeFormat` over `src/**/*.{ts,tsx}` excluding the allowlist | runner | warn | false | Use `@/lib/dateFormat` |
| `DATE-003` | Number formatting via `.toLocaleString()` for numbers (not dates) is allowed. The detector for `DATE-001` should not flag pure-number callsites — disambiguate by AST receiver type when feasible. | informational note for the linter | runner | info | false | n/a |

### `ERR-*` — Error handling & logging

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `ERR-001` | No empty catch blocks. `catch (e) {}` and `.catch(() => {})` must do something: re-throw, log via `console.error` / `console.warn`, surface to the user via `toast.error`, or write to `error_events`. | `eslint:no-empty` (`allowEmptyCatch: false`) for `try/catch` blocks; `eslint:no-restricted-syntax` for empty `.catch(() => {})` arrow (Wave 2) | eslint:no-empty + eslint:no-restricted-syntax | warn | false | Log + surface; if intentional, annotate `// swallow: <reason>` |
| `ERR-002` | No `console.log` in `src/**`. `console.warn`, `console.error`, and `console.info` are allowed when intentional. | `eslint:no-console` (`allow: [warn, error, info]`); `src/main.tsx` excluded via flat-config override (Wave 2) | eslint:no-console | warn | true | Remove, or replace with `console.warn` / `console.error` if surfacing a real issue |
| `ERR-003` | User-facing errors in mutations and async actions MUST surface to the user — either via `toast.error()` (sonner) or an inline error UI. Silent failure is a defect. | `ast: useMutation options object missing onError when the mutationFn can throw` (heuristic) | eslint:qualia-compliance/err-003-mutation-onerror-required | warn | false | Add `onError: (e) => toast.error(...)` |
| `ERR-004` | Don't `throw new Error(<hardcoded English string>)` for user-facing failures — throw an error code/key, and translate at the UI layer. Internal/programmer errors are fine to throw with English. | `ast: ThrowStatement with NewExpression(Error, string containing non-ASCII characters)` | eslint:qualia-compliance/err-004-throw-english-only | warn | false | Throw a typed error or a known key, translate via `t()` |

### `ASYNC-*` — Async hygiene

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `ASYNC-001` | No floating promises. Every promise-returning expression must be awaited, returned, or have a `.catch(...)`. | `eslint: @typescript-eslint/no-floating-promises` (requires `parserOptions.project`; configure if not present) | eslint:@typescript-eslint/no-floating-promises | error | false | `await`, `return`, or `.catch()` |
| `ASYNC-002` | `async` functions without `await` are suspicious — usually wrong. | `eslint:require-await` (built-in, non-type-aware; Wave 2; `@typescript-eslint/require-await` would add promise-return-type detection but requires `parserOptions.project`) | eslint:require-await | warn | false | Remove `async`, or add the missing `await` |
| `ASYNC-003` | Don't mix `await` and `.then()` chaining in the same function. Pick one. | `ast: function whose body contains both AwaitExpression and CallExpression .then` | runner | info | false | Refactor for consistency |

### `EFFECT-*` — useEffect hygiene

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `EFFECT-001` | `useEffect` containing `setInterval`, `setTimeout` (when used as a long-running timer), `addEventListener`, or any subscription pattern (`*.subscribe(`) MUST return a cleanup function. | `ast: CallExpression useEffect whose first arg is an arrow whose body contains setInterval/setTimeout/addEventListener/.subscribe AND does not return a function` over `src/**/*.{ts,tsx}` | eslint:qualia-compliance/effect-001-cleanup-required | error | false | Return a cleanup that calls `clearInterval` / `clearTimeout` / `removeEventListener` / `unsubscribe` |
| `EFFECT-002` | `useEffect` MUST NOT have an empty dependency array if its body reads from props or state. (Common bug: stale closure.) | `ast: useEffect with [] deps where body references a name from the enclosing function's params or other hook calls` | runner | warn | false | Add the deps, or refactor with a ref |
| `EFFECT-003` | Don't mutate refs or state synchronously inside the render body — only inside effects, event handlers, or `useMemo`. | `ast: AssignmentExpression to a ref.current or setState call directly in a function-component body, outside hooks/handlers` | runner | warn | false | Move to an effect |

### `IMPORT-*` — Imports & module hygiene

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `IMPORT-001` | Use `@/` path alias instead of relative imports going up 2+ levels. Sibling and one-level-up imports are fine. | `eslint:no-restricted-imports` — `patterns: [{ regex: "^\\.\\./" }]` (Wave 2; 20 existing violations) | eslint:no-restricted-imports | warn | true | Replace with `@/...` |
| `IMPORT-002` | Don't import `figma-plugin/**` from `src/**` and vice versa. They are separate Vite apps. | `eslint:no-restricted-imports` — `patterns: [{ group: ["@/figma-plugin/*", "**/figma-plugin/**"] }]` (Wave 2) | eslint:no-restricted-imports | warn | false | Duplicate the small utility, or extract a shared package (out of scope today) |
| `IMPORT-003` | Within `src/components/ui/`, primitives MUST NOT import from `src/components/` (non-`ui/`), `src/hooks/`, or `src/services/`. Primitives are leaf-level and reusable. | `regex: from ["']@/(components/(?!ui/)\|hooks/\|services/)` over `src/components/ui/**/*.{ts,tsx}` | runner | error | false | Move the dependency upstream |
| `IMPORT-004` | The legacy toast system (`@/components/ui/toast`, `@/components/ui/use-toast`, `@/hooks/use-toast`) is deprecated. New code uses `toast()` from `sonner`. See `DS-PRIMITIVE-010` and `REWORK-004`. | `eslint:no-restricted-imports` — `paths: [{name: "@/components/ui/toast"}, ...]` (Wave 2; 5 existing violations) | eslint:no-restricted-imports | warn | false | Migrate to `import { toast } from "sonner"` |

### `ENV-*` — Environment access

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `ENV-001` | No `process.env.X` in `src/**`. Vite uses `import.meta.env.X`. (Edge Functions / Deno still use `Deno.env.get(...)`.) | `eslint:no-restricted-syntax` — `MemberExpression[object.object.name='process'][object.property.name='env']` (Wave 2; 15 existing violations) | eslint:no-restricted-syntax | warn | true | Use `import.meta.env.<VITE_KEY>` (note `SEC-004` constraints) |
| `ENV-002` | Edge Functions MUST read env via `Deno.env.get('KEY')`, not via Node-style globals. | `regex: \bprocess\.env\.` over `supabase/functions/**/*.ts` | runner | error | false | Use `Deno.env.get('KEY')` |

### `TODO-*` — Comment markers

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `TODO-001` | `// TODO`, `// FIXME`, `// HACK`, `// XXX` without an owner (`@username`), ticket reference (`#123`, `JIRA-123`, URL), or date (ISO `YYYY-MM-DD`) is flagged for review. | `regex: //\s*(TODO\|FIXME\|HACK\|XXX)\b(?!.*(@\w+\|#\d+\|[A-Z]+-\d+\|\d{4}-\d{2}-\d{2}\|https?://))` over `src/**/*.{ts,tsx}` | runner | warn | false | Add an owner or a ticket reference |

### `TEST-*` — Test discipline

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `TEST-001` | No `it.only`, `describe.only`, `test.only` left in committed tests. | `regex: \b(it\|describe\|test)\.only\(` over `src/**/*.{test,spec}.{ts,tsx}` and `tests/**` | eslint:no-only-tests | error | true | Remove `.only` |
| `TEST-002` | `.skip` requires an inline comment with a ticket or `// reason: ...`. | `ast: CallExpression (it\|describe\|test).skip not preceded by a comment containing a ticket or "reason"` | eslint:qualia-compliance/test-002-skip-needs-comment | warn | false | Add justification, or unskip |
| `TEST-003` | Tests must use `http://localhost:8080` for the local app, not production. Production URLs in tests trigger an explicit-intent check. | `regex: https://qualia-ux\.com` over `tests/**` | runner | warn | false | Use `http://localhost:8080`; if the test must hit prod, label it `prod-` and gate behind `RUN_PROD_TESTS` |

### `TW-IMPORTANT-*` — Tailwind important escape hatch

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `TW-IMPORTANT-001` | Tailwind `!`-prefixed classes (`!bg-card`, `!text-foreground`, etc.) and inline-style `!important` are forbidden in app code. The single legitimate use today is the Google Drive Picker override in `src/index.css` (z-index recipes). | `eslint:no-restricted-syntax` — `Literal/TemplateElement[value.raw=/(?:^|\s)![A-Za-z]/]` (Wave 2) | eslint:no-restricted-syntax | warn | false | Restructure CSS specificity properly; if truly necessary, document the reason |

---

## 2. Data Layer (strict layering — never skip)

```
src/services/<domain>.service.ts   ← raw Supabase DB / function calls
  └─ src/hooks/use-<domain>.ts     ← TanStack Query wrappers
       └─ Components               ← consume hooks only, never services or supabase directly
```

**Why:** caching, RLS surface, and error mapping are concentrated in one place. Bypassing the chain breaks cache invalidation and makes RLS violations invisible.

- Services are framework-agnostic — no React, no React Query (`ARCH-005`, `ARCH-006`).
- Hooks own React Query state; query keys come from `src/lib/query-keys.ts` (`QUERY-001`).
- Components consume hooks. Components MUST NOT import `@/integrations/supabase/client` (`ARCH-001`).
- Edge Functions are invoked via `supabase.functions.invoke(...)` from a service — same rule.

See `agent_docs/data-layer.md` for the catalog of services/hooks already in place.

## 3. i18n (every user-facing string)

All user-facing strings go through `t()` from `useLanguage()`. English (`en`) and Italian (`it`) are both supported; English is the source of truth.

```tsx
const { t } = useLanguage();
return <Button>{t('save_changes')}</Button>;  // ✓
return <Button>Save Changes</Button>;          // ✗ — bug
```

Translation keys live in `src/utils/translations/<domain>.ts` and are merged in `src/utils/translations/index.ts`. Add new keys there; `I18N-003` enforces existence.

Attributes that are visible to users (`aria-label`, `placeholder`, `title`, `alt`) also need `t()` (`I18N-002`). Decorative `alt=""` is fine.

## 4. Routing & Navigation

- Use `<Link to="...">` from `react-router-dom` for internal navigation (`NAV-001`).
- Use `useNavigate()` for programmatic navigation (`NAV-002`). The exception is OAuth redirects to external URLs (Google, Notion, Figma) — those are intentionally `window.location.href = ...`.
- External links open in a new tab and require `rel="noopener noreferrer"` (`SEC-005`).

## 5. TypeScript

`tsconfig.json` is intentionally permissive (`strictNullChecks: false`, `noImplicitAny: false`) for legacy reasons. ESLint compensates (`@typescript-eslint/no-explicit-any` is the canonical lever).

- No `any` (`TYPE-001`); no `as any` casts (`TYPE-002`).
- `@ts-expect-error` over `@ts-ignore` (`TYPE-004`).
- DB row types come from `src/integrations/supabase/types.ts` (auto-generated). Re-export project-typed wrappers from services (e.g. `Audit`, `Project`).

## 6. Security

- No secrets in client code (`SEC-001`, `SEC-003`, `SEC-004`). `VITE_*` is the only namespace bundled into the browser.
- The React inner-HTML escape hatch is flagged for review (`SEC-002`); sanitize input or restructure.
- Admin auth APIs (`supabase.auth.admin.*`) and the service role key are server-only — they belong in Edge Functions (`ARCH-002`, `SEC-003`).
- External tab-link safety: `rel="noopener noreferrer"` (`SEC-005`).

`.env` is gitignored. Document new env vars in `.env.example`.

## 7. TanStack Query

Query keys are centralised in `src/lib/query-keys.ts`. Use the factory functions; never inline arrays (`QUERY-001`).

```ts
// ✓
useQuery({ queryKey: queryKeys.audits(projectId), queryFn: () => listAudits(projectId) });
queryClient.invalidateQueries({ queryKey: queryKeys.audits(projectId) });

// ✗
useQuery({ queryKey: ['audits', projectId], queryFn: ... });
```

`queryFn` calls a service (`QUERY-002`). Mutations invalidate by factory, not by string (`QUERY-003`).

## 8. Dates

Use `src/lib/dateFormat.ts` exclusively for user-facing dates (`DATE-001`):

| Helper | Output |
|---|---|
| `formatDate(d)` | `23 Feb 2025` |
| `formatDateTime(d)` | `23 Feb 2025, 14:30` |
| `formatRelativeTime(d)` | `2 days ago` |
| `formatDateRange(from, to)` | `23 Feb 2025 - 2 Mar 2025` |

Format is locale-neutral by design — avoids MM/DD vs DD/MM ambiguity. `Intl.DateTimeFormat` is reserved for `dateFormat.ts` and timezone-sensitive utilities (`DATE-002`).

Number formatting via `.toLocaleString()` (e.g. `12345.toLocaleString()` → `12,345`) is allowed.

## 9. Error handling & logging

- No empty catch (`ERR-001`). Either re-throw, log, or surface.
- No `console.log` in `src/**` (`ERR-002`); `console.warn` / `console.error` are allowed when intentional.
- Mutations should surface failures to the user via `toast.error()` (`ERR-003`).
- Service-layer errors should throw typed/known keys; UI translates (`ERR-004`).
- Edge Function errors should call `logError` from `supabase/functions/_shared/log-error.ts`.

## 10. Async & effects

- No floating promises (`ASYNC-001`). `await`, `return`, or `.catch`.
- `useEffect` cleanup is mandatory for intervals, timeouts, listeners, and subscriptions (`EFFECT-001`).
- Don't lie about deps (`EFFECT-002`, `REACT-002`).
- Don't define components inside components (`REACT-003`).
- Direct DOM access is allowed only in tour bridges, `main.tsx`, and the hidden-input file-picker pattern (`REACT-004`).

## 11. Imports & module hygiene

- Prefer `@/` over `../../` chains (`IMPORT-001`).
- `src/` and `figma-plugin/src/` are separate apps — no cross-imports (`IMPORT-002`, `ARCH-007`).
- `src/components/ui/` primitives are leaves: no upward imports (`IMPORT-003`).
- Toast: import from `sonner`, not the legacy `use-toast` (`IMPORT-004`).

## 12. Comments & test discipline

- TODO/FIXME without an owner or ticket → flagged (`TODO-001`).
- No `.only` in tests (`TEST-001`); `.skip` requires justification (`TEST-002`).
- Tests run against `http://localhost:8080`; production tests are explicit-intent only (`TEST-003`). Test credentials: `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` from `~/.secrets`.

## 13. Git, deploy, scope

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
- `main` — production, always deployable. `staging` — integration. Default push target is `staging`. Pushing to `main` always means pushing to `staging` too.
- Solo builder — no PRs unless explicitly requested.
- After Edge Function changes: `supabase functions deploy <name>` (only the changed ones).
- After frontend changes: `npm run lint` + `npm run build`.
- After logic changes: `npm test`.
- After `package.json` changes: `npm install`.

**Generated files** (never edit by hand — `ARCH-003`):

| File | Generated by | How to update |
|---|---|---|
| `src/integrations/supabase/types.ts` | Supabase CLI | `supabase gen types typescript --project-id <id>` |
| `supabase/migrations/*.sql` | Supabase CLI | `supabase migration new <name>` (never edit existing) |
| `agent_docs/database_schema.md` | `sync-agent-docs` | Run `/sync-agent-docs` |
| `agent_docs/edge-functions.md` | `sync-agent-docs` | Run `/sync-agent-docs` |
| `agent_docs/data-layer.md` | `sync-agent-docs` | Run `/sync-agent-docs` |

**Scope (Non-Goals unless asked):**
- Redesigning UI/UX beyond local tweaks (visual rules: see `design-system.md`).
- Changing deployment/CI.
- Adding major dependencies without discussing trade-offs.
- Destructive DB ops (`DROP`, `TRUNCATE`, bulk `DELETE`) — propose a migration first.

**New `public` tables — required migration template** (enforced by `SEC-006`):

Supabase removes auto-grants on `public` tables for the Data API roles starting **2026-10-30** for existing projects (and 2026-05-30 for any new project). Every new migration that creates a table in `public` must include explicit grants and enable RLS. Without this, `supabase-js`/PostgREST will return `42501 permission denied`.

```sql
create table public.<name> ( ... );

alter table public.<name> enable row level security;

-- Always:
grant select, insert, update, delete on public.<name> to service_role;
-- If the table is read/written by signed-in users via the Data API:
grant select, insert, update, delete on public.<name> to authenticated;
-- If the table must be readable by unauthenticated visitors (rare — interest_leads-style):
grant select on public.<name> to anon;

create policy "<name>_owner_select" on public.<name>
  for select to authenticated using (auth.uid() = user_id);
-- + insert/update/delete policies as needed
```

Server-only tables (touched exclusively by Edge Functions via `service_role` — e.g. `mcp_sessions`, `oauth_state`, `email_sends`, `ai_usage_events`, `crawl_jobs`, `error_events`, `plugin_link_codes`) can stop after the `service_role` grant + `enable row level security` with zero policies. Existing tables created before 2026-05-14 keep their grandfathered grants — no retrofit required.

---

## 14. Rework Backlog

Sequential `REWORK-CONV-*` IDs. Status: all **Awaiting approval** unless noted. Each requires user decision before code changes.

| ID | Type | Summary | Affects |
|---|---|---|---|
| `REWORK-CONV-001` | architecture | Multiple components in `src/components/**` and `src/pages/**` import `@/integrations/supabase/client` directly (e.g. `AuditDetail.tsx`, `audit/SingleScreenForm.tsx`, `audit/FlowAnalysisForm.tsx`, `audit/ContextImageUploader.tsx`, `pages/Auth.tsx`, `pages/Settings.tsx`, `pages/Project.tsx`, `pages/PluginAuth.tsx`, `pages/AcceptInvite.tsx`, `pages/ResetPassword.tsx`). Move to services + hooks per `ARCH-001`. | ~10 files |
| `REWORK-CONV-002` | code-quality | `console.log` calls remain in `src/lib/posthog.ts` and a handful of other locations. Convert to `console.warn` / `console.info` or remove (`ERR-002`). | `src/lib/posthog.ts`, ~12 callsites |
| `REWORK-CONV-003` | code-quality | `.toLocaleDateString` / `.toLocaleString` for *dates* in `src/components/ProWaitlistDialog.tsx` (Europe/Rome formatting). Either move into `src/lib/dateFormat.ts` as a `formatRomeDate` helper, or annotate as the legitimate timezone exception per `DATE-002`. | `ProWaitlistDialog.tsx` |
| `REWORK-CONV-004` | code-quality | Two `as any` casts present in `src/`. Audit and replace with proper types or `as unknown as T` with a comment (`TYPE-002`). | 2 callsites |
| `REWORK-CONV-005` | tooling | `eslint.config.js` does not enable `@typescript-eslint/no-floating-promises` or `@typescript-eslint/require-await` (these need `parserOptions.project`). To enforce `ASYNC-001` / `ASYNC-002`, add type-aware linting. | `eslint.config.js`, possibly slower CI |
| `REWORK-CONV-006` | tooling | `react-hooks/exhaustive-deps` runs at default severity (`warn`). To enforce `REACT-002` at error, raise it explicitly. Pre-existing warnings would surface as errors and need triage first. | `eslint.config.js` |
| `REWORK-CONV-007` | tooling | No ESLint plugin currently enforces `react/jsx-key` (`REACT-001`). Add `eslint-plugin-react`, configure with React 18 settings, and enable only the rules we want. | `eslint.config.js`, `package.json` |
| `REWORK-CONV-008` | tooling | `tsconfig.json` has `strictNullChecks: false` and `noImplicitAny: false` repo-wide. This is the root reason `TYPE-*` rules need ESLint as a backstop. Long-term: enable `strict: true` per-folder via project references. | `tsconfig.app.json`, broad surface |
| `REWORK-CONV-009` | code-quality | Both `package-lock.json` and `bun.lockb` are checked in. Per `danger-zones.md`, npm is canonical. Delete `bun.lockb` and add to `.gitignore`. | repo root |

---

## 15. Things I couldn't decide — flagging for the user

- **`SEC-001` regex** — I used a conservative set (`sk_live_/sk_test_/pk_live_` + JWT shape). If the project considers other identifier shapes sensitive (e.g. session tokens, plugin tokens, decrypted Figma access tokens shaped like `figd_*`), tell me and I'll widen the pattern.
- **`REACT-004` allowlist** — I allowed `src/components/TourBridge.tsx`, `src/main.tsx`, and the hidden-input file-picker pattern. Confirm or expand.
- **`I18N-001` exemption set** — punctuation, single characters, and pure numbers are exempt. Do we want brand names (`Qualia`, `Figma`) hardcoded, or routed through `t()` for consistency? Today the codebase mixes both.
- **`DATE-001` vs number formatting** — `String#toLocaleString` is overloaded across `Date` and `Number`. The detector needs receiver-type awareness; until then it may false-positive on number formatting. Acceptable trade-off?
- **`ARCH-008`** is set to `warn` because `_shared/` drift is hard to detect deterministically without a manifest of forbidden duplicate strings. Worth promoting to `error` once we list the canonical tokens.
- **`TW-IMPORTANT-001`** — could equally live in `design-system.md` since it's a styling escape hatch. Kept here because it's a code-quality rule (escape hatch usage) more than a design-system rule. If you'd rather it move, say the word.
