# Qualia Design System

Single source of truth for every visual and UI pattern in the app. **Read this before writing or reviewing any component, page, or style change.** This document is also the rule source for the design-system compliance linter (Skill 1) — every deterministic rule below has a stable ID (`DS-*`) the linter can reference.

> **Doc structure**
> 1. **Hard Rules** — deterministic, machine-checkable rules with stable IDs. Hoisted to one place; each rule appears here AND in its topical section.
> 2. **Tokens & Foundations** — colors, typography, spacing, radius, shadows, effects.
> 3. **Primitive Inventory** — every file in `src/components/ui/` enumerated.
> 4. **Decision Rules** — when patterns compete (Card vs glass, Dialog vs Sheet, etc.).
> 5. **Microcopy** — exact wording rules.
> 6. **Accessibility (mechanical)** — only deterministic a11y rules; semantic judgment is out of scope.
> 7. **UX Principles** — judgment-call guidance.
> 8. **Rework Backlog** — flagged issues awaiting approval, with sequential `REWORK-*` IDs.

---

## 1. Hard Rules (Linter SOT)

Format: `ID | Rule | Detect-by | Severity | Fix`. Severity: **error** (blocking), **warn** (review), **info** (nudge).

### Color rules

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `DS-COLOR-001` | No raw Tailwind palette colors in app code: `blue-*`, `indigo-*`, `violet-*`, `cyan-*`, `sky-*`, `pink-*`, `purple-*`, `slate-*`, `gray-*`, `zinc-*`, `neutral-*`, `stone-*`, `orange-*`, `lime-*`, `emerald-*`, `teal-*`, `fuchsia-*`, `rose-*`. Use semantic tokens (`primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `card`, `popover`, `surface-1/2/3`). | className regex `\b(bg\|text\|border\|ring\|from\|to\|via\|fill\|stroke\|shadow)-(blue\|indigo\|violet\|cyan\|sky\|pink\|purple\|slate\|gray\|zinc\|neutral\|stone\|orange\|lime\|emerald\|teal\|fuchsia\|rose)-` | eslint:ds-color-001-no-raw-palette | error | false | Replace with semantic token |
| `DS-COLOR-002` | Warning color is **amber**, never **yellow**. | className regex `\b(bg\|text\|border\|ring\|fill\|stroke)-yellow-` | eslint:ds-color-002-no-yellow | error | true | Replace `yellow-*` → `amber-*` |
| `DS-COLOR-003` | Allowed raw color families are exactly: `green-*`, `amber-*`, `red-*` (score states only), `white`, `black` (used inside utility recipes). All other raw families are forbidden. | inverse of `DS-COLOR-001` allow-list | runner | error | false | See `DS-COLOR-001` fix |
| `DS-COLOR-004` | Score colors must use `scoreToTailwindColor()` / `scoreToBadgeClasses()` from `src/lib/score-colors.ts`. Manual `text-green-400` / `text-amber-400` / `text-red-400` triplets are forbidden in product code (score helpers excepted). | className regex matches all three of `text-green-400`, `text-amber-400`, `text-red-400` in same file or component branching on score | audit-only | warn | false | Import score helpers. Caught by q-ux-audit Engine X (cross-sectional pattern detection); not statically lintable without high false-negative rate. |
| `DS-COLOR-005` | The `--success` token is defined but **not** mapped in `tailwind.config.ts`. Do not use `bg-success` / `text-success` — they will not render. Use `text-green-400` (via score helpers) for success-positive numeric states, or `text-primary` for confirmation states. | `eslint:no-restricted-syntax` regex on `(bg\|text\|border\|ring)-success(-foreground)?` literal/template-element (Wave 2) | eslint:no-restricted-syntax | warn | true | Use score helper or `text-primary` |
| `DS-COLOR-006` | Auth light surface tokens (`auth-form-*`) are usable **only** inside `src/pages/Auth.tsx`. Do not reference them elsewhere. | file-path-scoped: classNames containing `auth-form-` outside `Auth.tsx` | runner | error | false | Remove |
| `DS-COLOR-007` | Sidebar tokens (`sidebar-*`) are usable **only** inside `src/components/ui/sidebar.tsx` and components rendered inside the `Sidebar` tree. Do not reference them in main content. | classNames containing `sidebar-` outside `ui/sidebar.tsx` and `components/sidebar/**` | runner | error | false | Use main tokens |
| `DS-COLOR-008` | Color is never the only signal for state (success/error/warning). Pair with icon, label, or position. | AST: element with semantic-color class (`text-destructive`, `text-amber-400`, `text-green-400`, `text-red-400`) and no sibling icon nor screen-reader text | runner | warn | false | Add icon or `<span className="sr-only">` |
| `DS-COLOR-009` | Toast/Sonner success and warning variants resolve to the **same** primary purple background (see `src/components/ui/sonner.tsx`). This is a known issue — see `REWORK-005`. Until then, prefer `toast.error()` for errors and a leading icon in the message body for warnings. | usage of `toast.warning(` without leading icon in message | runner | info | false | Add icon prefix or wait for REWORK-005 |

### Spacing rules

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `DS-SPACING-001` | Allowed gap/space scale: `0`, `0.5`, `1`, `1.5`, `2`, `2.5`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `16`. Anything outside this list is suspect. | className regex `\b(gap\|space-[xy])-(?!(0\|0.5\|1\|1.5\|2\|2.5\|3\|4\|5\|6\|8\|10\|12\|16)\b)` | eslint:qualia-compliance/ds-spacing-001-no-off-scale-gap | warn | false | Snap to nearest |
| `DS-SPACING-002` | No arbitrary numeric spacing: `p-[Npx]`, `m-[Npx]`, `gap-[Npx]`, `space-[xy]-[Npx]`. | `eslint:tailwindcss/no-unnecessary-arbitrary-value` (flags arbitrary classes when an equivalent scale token exists; resolves project tokens via `tailwind.config.ts`) | eslint:tailwindcss/no-unnecessary-arbitrary-value | warn | false | Use scale token; if truly necessary, document with comment |
| `DS-SPACING-003` | Page main wrapper uses `py-12` for vertical padding. `py-8` is forbidden on the top-level `<main>`. | AST: top-level `<main>` with `py-8` | eslint:ds-spacing-003-main-py | error | false | Use `py-12` |
| `DS-SPACING-004` | Card internal padding is `p-5` (compact) or `p-6` (standard). Do not use `p-4` for top-level card surfaces (leaves content visually cramped). | `<Card>` or `.glass` with `p-4` | eslint:qualia-compliance/ds-spacing-004-no-p4-on-card-surface | warn | false | Use `p-5` or `p-6` |
| `DS-SPACING-005` | Tight label/input pairing uses `space-y-1.5` or `space-y-2`. Don't use `space-y-3`. | `<Label>` + input sibling with `space-y-3` parent | eslint:qualia-compliance/ds-spacing-005-label-input-spacing | warn | false | Use `space-y-1.5` |

### Radius rules

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `DS-RADIUS-001` | No arbitrary radius: `rounded-[Npx]`, `rounded-[Nrem]`. Use the named scale only. | `eslint:tailwindcss/no-unnecessary-arbitrary-value` (flags `rounded-[Npx]` when a scale equivalent exists; legitimate `rounded-[var(--radius)]` / `rounded-[inherit]` per DS-RADIUS-002 are not flagged) | eslint:tailwindcss/no-unnecessary-arbitrary-value | warn | false | Use `rounded-sm/md/lg/xl/2xl/full` |
| `DS-RADIUS-002` | Allowed radius classes: `rounded-none`, `rounded-sm`, `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`, `rounded-[inherit]`, `rounded-[var(--radius)]`. | inverse allow-list | eslint:ds-radius-002-allowlist | error | false | See above |
| `DS-RADIUS-003` | `rounded-[var(--radius)]` is equivalent to `rounded-lg`. Prefer `rounded-lg` for readability. | `eslint:no-restricted-syntax` regex on `rounded-[var(--radius)]` literal and template-element (Wave 2) | eslint:no-restricted-syntax | warn | true | Replace with `rounded-lg` |

### Typography rules

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `DS-TYPO-001` | Allowed font-size classes: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`. No arbitrary `text-[Npx]`. | `eslint:tailwindcss/no-unnecessary-arbitrary-value` (flags `text-[Npx]` when a scale equivalent exists) | eslint:tailwindcss/no-unnecessary-arbitrary-value | warn | false | Snap to scale |
| `DS-TYPO-002` | Inline form hints are `text-xs text-muted-foreground`. Section descriptions are `text-sm text-muted-foreground`. Don't mix. | AST: hint element under `<FormControl>` with `text-sm`, or section description with `text-xs` | eslint:qualia-compliance/ds-typo-002-hint-vs-description-size | warn | false | Match role |
| `DS-TYPO-003` | Default font family is `Inter` via `font-sans` (Tailwind default). Don't override with explicit `font-['Name']`. | `eslint:no-restricted-syntax` selector matching `font-[` in string literals and template elements | eslint:no-restricted-syntax | warn | false | Use `font-sans` / `font-mono` only |
| `DS-TYPO-004` | Allowed font-family classes: `font-sans`, `font-mono`. `font-serif` is forbidden. | `eslint:no-restricted-syntax` selector matching `font-serif` in string literals and template elements | eslint:no-restricted-syntax | warn | true | Use `font-sans` |
| `DS-TYPO-005` | Major headings (`<h1>`, `<h2>`) should pair with `tracking-tight`. Optional but recommended. | AST: `<h1\|h2>` without `tracking-tight` | eslint:qualia-compliance/ds-typo-005-heading-tracking-tight | warn | false | Add `tracking-tight` |

### Shadow rules

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `DS-SHADOW-001` | Allowed shadow classes: `shadow-none`, `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`, `glow-purple`, `glow-border`. | `eslint:no-restricted-syntax` regex on `shadow-[` literal/template-element; sidebar.tsx and AutoCrawlThumbnailStrip.tsx excluded via flat-config override (Wave 2) | eslint:no-restricted-syntax | warn | false | Use named shadow |
| `DS-SHADOW-002` | Custom glow effects use `.glow-purple` (ambient) or `.glow-border` (border ring). No ad-hoc box-shadow with purple HSL. | inline style `boxShadow:` containing `262 83%` | eslint:ds-shadow-002-no-purple-hsl | warn | false | Use utility class |

### Primitive substitution rules (raw HTML → component)

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `DS-PRIMITIVE-001` | No raw `<button>` in app code (outside `src/components/ui/`). Use `<Button>` from `@/components/ui/button`. | JSX element `<button` outside `ui/` | runner | error | false | Replace with `<Button>` (variant="ghost" if previously unstyled) |
| `DS-PRIMITIVE-002` | No raw `<select>` / `<option>`. Use `<Select>` from `@/components/ui/select`. | JSX element `<select` | runner | error | false | Replace with `<Select>` |
| `DS-PRIMITIVE-003` | No raw `<input>` for type=text/email/password/url/number/search. Use `<Input>` from `@/components/ui/input`. (`type="hidden"` is fine; `type="file"` may be raw if styled.) | `eslint:no-restricted-syntax` — `JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(hidden|file|...)$/]))` (Wave 2) | eslint:no-restricted-syntax | warn | false | Replace with `<Input>` |
| `DS-PRIMITIVE-004` | No raw `<textarea>`. Use `<Textarea>` from `@/components/ui/textarea`. | JSX `<textarea` | runner | error | false | Replace with `<Textarea>` |
| `DS-PRIMITIVE-005` | No raw `<table>`. Use `<Table>` from `@/components/ui/table`. | JSX `<table` outside `ui/` | runner | warn | false | Replace |
| `DS-PRIMITIVE-006` | No raw `<dialog>` / inline modal divs with `position: fixed` overlays. Use `<Dialog>` / `<Sheet>` / `<Drawer>` / `<AlertDialog>`. | JSX `<dialog`, or `className` regex `fixed inset-0 z-` outside `ui/` | runner | error | false | Use Dialog primitive |
| `DS-PRIMITIVE-007` | Form fields wired to react-hook-form must use `<FormField>` + `<FormItem>` + `<FormLabel>` + `<FormControl>` + `<FormMessage>` from `@/components/ui/form`. Don't manually wire `Controller` + `<Label>`. | AST: `Controller` import outside `ui/form.tsx` | runner | error | false | Use `<FormField>` |
| `DS-PRIMITIVE-008` | Score badges must be rendered with `scoreToBadgeClasses()` (or a `<Badge>` variant in the future); raw `<span class="bg-green-500/20 text-green-400">` triplets are forbidden. | see `DS-COLOR-004` | audit-only | warn | false | Use helper. Caught by q-ux-audit Engine X (cross-sectional pattern detection); not statically lintable without high false-negative rate. |
| `DS-PRIMITIVE-009` | Confirmation flows use `<AlertDialog>`, never `<Dialog>` with custom buttons. | `<Dialog>` whose action button has `variant="destructive"` and label matching `Delete\|Remove\|Discard` | eslint:qualia-compliance/ds-primitive-009-alertdialog-for-destructive | warn | false | Use `<AlertDialog>` |
| `DS-PRIMITIVE-010` | The legacy `<Toast>` system in `src/components/ui/toast.tsx` is **deprecated**. New code uses `toast()` from `@/components/ui/sonner`. See `REWORK-004`. | import from `@/components/ui/toast` or `@/components/ui/use-toast` | runner | warn | false | Migrate to sonner |
| `DS-PRIMITIVE-011` | Lucide is the only icon library. Don't import from `react-icons`, `@heroicons/*`, etc. | `eslint:no-restricted-imports` pattern group `react-icons / @heroicons/* / @radix-ui/react-icons` (Wave 2) | eslint:no-restricted-imports | error | false | Use lucide |

### Accessibility (mechanical) rules

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `DS-A11Y-001` | Every `<img>` requires an `alt` attribute. Decorative images use `alt=""`. | JSX `<img` without `alt=` | jsx-a11y:alt-text | error | false | Add `alt` |
| `DS-A11Y-002` | Icon-only `<Button>` (size="icon" or no text children) requires `aria-label` OR a child `<span className="sr-only">`. | `eslint:jsx-a11y/control-has-associated-label` (closest mechanical match — flags interactive controls without an accessible name) | eslint:jsx-a11y/control-has-associated-label | warn | false | Add `aria-label` |
| `DS-A11Y-003` | `onClick` on a non-button, non-link element (`<div>`, `<span>`, `<li>`) requires: `role="button"`, `tabIndex={0}`, AND a keyboard handler (`onKeyDown` matching Enter/Space). | `eslint:jsx-a11y/click-events-have-key-events` + `eslint:jsx-a11y/no-static-element-interactions` (combined cover keyboard handlers + role) | eslint:jsx-a11y/click-events-have-key-events + jsx-a11y/no-static-element-interactions | warn | false | Use `<Button variant="ghost">` instead, or add all three |
| `DS-A11Y-004` | Form `<Input>`, `<Textarea>`, `<Select>` must have an associated `<Label htmlFor=...>`, an `aria-label`, or be wrapped in `<FormItem>` (which auto-wires via `<FormLabel>`). | `eslint:jsx-a11y/label-has-associated-control` | eslint:jsx-a11y/label-has-associated-control | warn | false | Add `<Label>` |
| `DS-A11Y-005` | Every interactive element (button, link, input, custom click target) must have visible focus styling. The base `Button`, `Input`, `SelectTrigger`, `Tabs` already include `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`. Custom click targets must add the same recipe or `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`. | AST: element with `onClick` and no `focus-visible:` class anywhere in className | runner | error | false | Add focus-visible recipe, or use `clickableProps()` from `@/lib/a11y` which provides it. |
| `DS-A11Y-006` | Heading order must not skip levels within a route. `<h1>` once per page, then `<h2>`, then `<h3>`, etc. | runner (heading-order traversal across the full route component tree) | runner (deferred — eslint cannot lint heading order across a route; needs runner rule) | warn | false | Renumber |
| `DS-A11Y-007` | Use semantic landmarks: `<main>` once per page, `<nav aria-label=...>` for navigation, `<header>`, `<footer>`. Don't replace with `<div>`. | Sub-check 1 (one `<main>` per route): runner-deferred. Sub-check 2 (`<nav>` not `<div role="navigation">`): `eslint:jsx-a11y/prefer-tag-over-role`. Sub-check 3 (`<nav>` has `aria-label`): audit-only (no jsx-a11y rule covers this). Sub-check 4 (`<header>`/`<footer>` semantics): audit-only (heuristic). | eslint:jsx-a11y/prefer-tag-over-role + audit-only | warn | false | Use `<nav>` semantic element. For accessible-name requirement on nav: add `aria-label`; flagged by q-ux-audit Engine X. |
| `DS-A11Y-008` | Decorative icons inside text get `aria-hidden="true"`. Icons that ARE the only content of a button get the button's `aria-label` instead. | `<svg>` or lucide icon with no `aria-hidden` AND no surrounding text label | jsx-a11y:heading-has-content | info | false | Add `aria-hidden` |
| `DS-A11Y-009` | Color contrast: foreground text on its background must reach **4.5:1** for body text and **3:1** for large text (≥18pt or 14pt bold) and UI elements. Token combinations validated in section 2.1. | computed contrast on token pair | runner | error | false | Pick higher-contrast token; see `REWORK-001` |
| `DS-A11Y-010` | `<Dialog>`, `<Sheet>`, `<Drawer>`, `<AlertDialog>` require `<DialogTitle>` (or `Sheet/Drawer/AlertDialogTitle`). If visually hidden, wrap in `<VisuallyHidden>` or use `sr-only`. | `<DialogContent>` without a `<DialogTitle>` descendant | eslint:qualia-compliance/ds-a11y-010-dialog-title | warn | false | Add title. Waive with `// q-disable-next-line DS-A11Y-010` if title is rendered by a wrapper component. |
| `DS-A11Y-011` | Links must have discernible text. `<a>` with only an icon child requires `aria-label`. | `<a>` whose only child is an icon with no `aria-label` | jsx-a11y:anchor-has-content | error | false | Add label |

### Microcopy rules (mechanical)

| ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
|---|---|---|---|---|---|---|
| `DS-COPY-001` | No ellipsis (`…` or `...`) on `<Button>` labels. | `eslint:no-restricted-syntax` — `JSXElement[openingElement.name.name='Button'] > JSXText[value=/...\|…/]` (Wave 2) | eslint:no-restricted-syntax | warn | true | Drop ellipsis |
| `DS-COPY-002` | `<AlertDialogAction>` and `<AlertDialogCancel>` labels must name the outcome — no `OK` / `Cancel`. | `eslint:no-restricted-syntax` — `JSXElement[openingElement.name.name=/^AlertDialog.../] > JSXText[value=/^OK\|Cancel$/]` (Wave 2) | eslint:no-restricted-syntax | warn | false | Use action-specific labels |
| `DS-COPY-003` | Sentence case for labels and headings. (Title Case allowed for proper nouns and brand names.) | heuristic: heading text with multiple capitalized non-proper words | runner | info | false | Lowercase non-leading words |

---

## 2. Tokens & Foundations

All colors are defined as CSS custom properties in `src/index.css` and mapped to Tailwind in `tailwind.config.ts` via `hsl(var(--token))`. The app is dark-only (`.dark` class is hardcoded; light theme is not enabled).

### 2.1 Semantic Color Tokens (Dark Theme)

| Token | HSL | Tailwind | Role |
|---|---|---|---|
| `--background` | `240 10% 4%` | `bg-background` | Page background (dark navy-black) |
| `--foreground` | `0 0% 95%` | `text-foreground` | Primary text |
| `--card` | `240 10% 6%` | `bg-card` | Card surface |
| `--card-foreground` | `0 0% 95%` | `text-card-foreground` | Text on cards |
| `--popover` | `240 10% 8%` | `bg-popover` | Popovers, dropdowns, selects |
| `--popover-foreground` | `0 0% 95%` | `text-popover-foreground` | Text in popovers |
| `--primary` | `262 83% 58%` | `bg-primary` / `text-primary` | Purple accent — buttons, links, focus rings |
| `--primary-foreground` | `0 0% 100%` | `text-primary-foreground` | Text on primary surfaces |
| `--secondary` | `240 6% 12%` | `bg-secondary` | Secondary surface |
| `--secondary-foreground` | `0 0% 95%` | `text-secondary-foreground` | Text on secondary |
| `--muted` | `240 6% 15%` | `bg-muted` | Muted surface (tab bars, badges) |
| `--muted-foreground` | `240 5% 65%` | `text-muted-foreground` | Hint text, disabled labels |
| `--accent` | `262 83% 58%` | `bg-accent` | Same as primary (hover targets) |
| `--accent-foreground` | `0 0% 100%` | `text-accent-foreground` | Text on accent |
| `--destructive` | `0 62% 50%` | `bg-destructive` (text usage retired — see `REWORK-002`) | Destructive button/badge backgrounds only |
| `--destructive-foreground` | `0 0% 100%` | `text-destructive-foreground` | Text on destructive |
| `--success` | `142 71% 45%` | *(unmapped — see DS-COLOR-005)* | Success states (token only, not a Tailwind class) |
| `--success-foreground` | `0 0% 100%` | *(unmapped)* | Text on success |
| `--border` | `240 6% 18%` | `border-border` | Default border |
| `--input` | `240 6% 12%` | `bg-input` / `border-input` | Input field background and border |
| `--ring` | `262 83% 58%` | `ring-ring` | Focus ring (= primary) |
| `--glow` | `262 83% 58%` | `bg-glow` | Glow effect color |
| `--glow-muted` | `262 40% 20%` | `bg-glow-muted` | Muted glow (dark purple) |

#### Computed contrast ratios (WCAG)

Estimated using sRGB → relative luminance on the HSL pairs above. Numbers are approximate (±0.1) but accurate enough for triage.

| Foreground | Background | Ratio | 4.5:1? | 3:1? |
|---|---|---|---|---|
| `foreground` (95%) | `background` (4%) | ~17.0 | yes | yes |
| `foreground` | `card` (6%) | ~16.0 | yes | yes |
| `foreground` | `muted` (15%) | ~12.0 | yes | yes |
| `muted-foreground` (65%) | `background` | ~6.5 | yes | yes |
| `muted-foreground` | `card` | ~6.2 | yes | yes |
| `muted-foreground` | `muted` (15%) | ~5.2 | yes | yes |
| `primary` (purple, 58%) | `background` | ~6.0 | yes | yes |
| `destructive` (red, 50%) | `background` | ~4.3 | **borderline** ⚠ | yes |
| `success` (green, 45%) | `background` | ~3.5 | **no** ⚠ | yes |
| `text-green-400` (~70%) | `background` | ~9.0 | yes | yes |
| `text-amber-400` (~70%) | `background` | ~9.5 | yes | yes |
| `text-red-400` (~70%) | `background` | ~6.0 | yes | yes |

> **✓ RESOLVED — a11y** — `muted-foreground` contrast (`REWORK-001`)
> **Change:** `--muted-foreground` lightened from `240 5% 55%` → `240 5% 65%`. Raises ratio on `bg-muted` from ~4.0:1 to ~5.2:1 (passes AA), and on `bg-background` from ~5.3:1 to ~6.5:1.
> **Visual impact:** Slightly brighter hint text app-wide. No code changes needed at callsites.

> **✓ RESOLVED — a11y** — `--destructive` and `--success` token contrast (`REWORK-002` path B)
> **Decision:** Path (b) — `text-destructive` and `text-success` are retired in favor of `text-red-400` / `text-green-400`. The `bg-destructive` + `text-destructive-foreground` pairing on buttons/badges is unaffected.
> **Canonical "red text":** `text-red-400` (use `scoreToTailwindColor()` when context is a score; raw class otherwise — covered by the `red-400` exception in §2.6).
> **Canonical "green text":** `text-green-400` (same rule).
> **Note:** `--success` / `--success-foreground` were removed entirely from `index.css` per `REWORK-011`.

### 2.2 Surface Elevation Tokens

For layered UI depth instead of arbitrary bg colors:

| Token | HSL | Tailwind | When to use |
|---|---|---|---|
| `--surface-1` | `240 10% 8%` | `bg-surface-1` | First elevation (cards, panels) |
| `--surface-2` | `240 8% 12%` | `bg-surface-2` | Second elevation (nested cards, table-row hover) |
| `--surface-3` | `240 6% 16%` | `bg-surface-3` | Third elevation (popovers within modals) |

### 2.3 Sidebar Tokens (isolated)

Sidebar has its own isolated set — see `DS-COLOR-007`. Do not mix into main content.

| Token | Value |
|---|---|
| `--sidebar-background` | `240 10% 5%` |
| `--sidebar-foreground` | `0 0% 95%` |
| `--sidebar-primary` | `262 83% 58%` |
| `--sidebar-primary-foreground` | `0 0% 100%` |
| `--sidebar-accent` | `240 6% 15%` |
| `--sidebar-accent-foreground` | `0 0% 95%` |
| `--sidebar-border` | `240 6% 18%` |
| `--sidebar-ring` | `262 83% 58%` |

### 2.4 Auth Form Tokens (light override)

Auth page uses a deliberately light panel (split-surface conversion design). Tokens exist exclusively for that surface — see `DS-COLOR-006`.

| Token | HSL | Tailwind |
|---|---|---|
| `--auth-form-bg` | `0 0% 100%` | `bg-auth-form-bg` |
| `--auth-form-text` | `222.2 47.4% 11.2%` | `text-auth-form-text` |
| `--auth-form-text-muted` | `215.4 16.3% 46.9%` | `text-auth-form-text-muted` |
| `--auth-form-input-bg` | `210 40% 96.1%` | `bg-auth-form-input-bg` |
| `--auth-form-input-border` | `214.3 31.8% 91.4%` | `border-auth-form-input-border` |

### 2.5 Score Color System (SOT)

Defined in `src/lib/score-colors.ts` — **always import from here**. See `DS-COLOR-004`.

```ts
SCORE_THRESHOLDS = { GOOD: 80, WARNING: 50 }

scoreToTailwindColor(score)
// → "text-green-400" | "text-amber-400" | "text-red-400"

scoreToBadgeClasses(score)
// → "bg-green-500/20 text-green-400"
//   | "bg-amber-500/20 text-amber-400"
//   | "bg-red-500/20 text-red-400"
```

Warning color is **amber**, never yellow (`DS-COLOR-002`).

Figma plugin equivalent (mirror, inline in `figma-plugin/src/ui/views/ReportView.tsx`):
```ts
// Thresholds mirror src/lib/score-colors.ts SCORE_THRESHOLDS: GOOD=80, WARNING=50
if (score >= 80) return "#16a34a"; // green-600
if (score >= 50) return "#d97706"; // amber-600
return "#dc2626";                  // red-600
```

> **⚠ REWORK PROPOSAL — coherence** — Score thresholds duplicated
> **Current:** Thresholds and color hex strings are duplicated between `src/lib/score-colors.ts` and `figma-plugin/src/ui/views/ReportView.tsx`. They are documented as "in sync" via comment but nothing enforces it.
> **Problem:** A future change to thresholds will silently desync.
> **Proposed:** Either (a) extract a JSON constants file shared via build, or (b) add a unit test in the plugin that imports the constants from `src/lib/score-colors.ts` and asserts equality. (b) is lower-effort.
> **Affects:** `figma-plugin/src/ui/views/ReportView.tsx`, plus a new test file.
> **Status:** Awaiting approval. Tracked as `REWORK-003`.

### 2.6 Allowed raw color families (exception list)

`DS-COLOR-001` forbids almost all raw Tailwind colors. The **only** allowed raw families and where:

| Family | Where allowed | Why |
|---|---|---|
| `green-400`, `green-500`, `green-600` | Inside score helpers and components rendering scores; `bg-green-500/20` for score badges | SOT for "good" score |
| `amber-400`, `amber-500`, `amber-600` | Same as green | SOT for "warning" score |
| `red-400`, `red-500`, `red-600` | Same as green | SOT for "critical" score |
| `white`, `black` | Inside utility recipes (overlays like `bg-black/80`, sonner `text-white/90`) | Pure overlays, not theme |

All other raw families are forbidden.

### 2.7 Typography

**Font family:** `Inter` (with `system-ui`, `sans-serif` fallback) via `tailwind.config.ts`. Exposed as `font-sans` (default) and `font-mono` (default mono stack). Never use `font-serif` or arbitrary `font-['Name']` (`DS-TYPO-003`, `DS-TYPO-004`).

**Allowed font-size scale** (DS-TYPO-001):

| Class | Px | Role | Where used |
|---|---|---|---|
| `text-xs` | 12 | Badges, muted metadata, inline form hints, timestamps | `<Badge>`, FormField hints |
| `text-sm` | 14 | Body default, card descriptions, form labels, section descriptions | Most UI text |
| `text-base` | 16 | Reading-prose body | Long-form copy |
| `text-lg` | 18 | Subsection titles, dialog/sheet titles | Analytics section labels |
| `text-xl` | 20 | Section heading | Dashboard project names |
| `text-2xl` | 24 | Large section heading, `CardTitle` | Card titles, FAQ sections |
| `text-3xl` | 30 | Page title | Settings `<h1>`, hero |
| `text-4xl` | 36 | Hero (responsive) | Landing `text-3xl md:text-4xl` |

**Tracking:** `tracking-tight` on headings (recommended `DS-TYPO-005`); `tracking-wider` on uppercase metadata.

**Wrap:** `[text-wrap:balance]` on major headings. **Overflow:** `truncate` (single-line) or `line-clamp-2` / `line-clamp-3` (multi-line).

**Special:** `.text-gradient` — white-to-purple diagonal gradient for the logo and hero headings (defined in `index.css`).

### 2.8 Spacing & Layout

**Allowed gap/space scale** (`DS-SPACING-001`): `0`, `0.5`, `1`, `1.5`, `2`, `2.5`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `16`. No arbitrary `[Npx]` (`DS-SPACING-002`).

**Page container**:

```tsx
// Standard page wrapper
<main className="max-w-7xl mx-auto px-6 py-12">

// Data-rich pages (Dashboard, Analytics, Changelog index)
<main className="max-w-7xl mx-auto px-6 py-12">

// Focused / form pages — actual current usage on Settings is `max-w-3xl`
<main className="max-w-3xl mx-auto px-6 py-12 space-y-8">

// Narrow / editorial (Changelog entries)
<main className="max-w-3xl mx-auto px-6 py-12">
```

> **⚠ REWORK PROPOSAL — coherence** — Settings page max-width
> **Current:** Settings.tsx uses `max-w-3xl`. The previous design-system doc said `max-w-5xl` for "focused/form pages".
> **Problem:** Doc and code disagree.
> **Proposed:** Adopt `max-w-3xl` as the canonical "focused page" width (matches what shipped). Reserve `max-w-5xl` only if a wider focused layout returns.
> **Affects:** Documentation only (this doc reflects the resolution).
> **Status:** Documented as resolved here; tracked as `REWORK-006` for visibility.

**Section spacing** (rules of thumb):
- Major sections: `space-y-8` or `gap-8`
- Related items: `space-y-4` or `gap-4`
- Tight pairs (label + input): `space-y-1.5` or `gap-2`
- Card internal padding: `p-5` (compact) or `p-6` (standard) — `p-4` is forbidden on top-level cards (`DS-SPACING-004`)

**Grid patterns**:

```tsx
// 3-column responsive
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"

// 2-column responsive
className="grid grid-cols-1 md:grid-cols-2 gap-6"

// Sidebar + content
className="lg:grid-cols-[220px_minmax(0,1fr)]"
```

**Max-width scale**:

| Value | Use case |
|---|---|
| `max-w-7xl` | Dashboard, Analytics, Changelog, landing sections |
| `max-w-5xl` | Reserved (currently unused — see REWORK-006) |
| `max-w-3xl` | Settings, editorial, blog-style content |
| `max-w-2xl` | Dialogs, modals (default Dialog width) |
| `max-w-lg` | Compact dialogs |
| `max-w-md` | Auth form panel |

### 2.9 Border Radius

`--radius: 0.75rem` (12px) is the base. All values derive from it. Allowed scale (`DS-RADIUS-002`):

| Tailwind class | Computed value | Use case |
|---|---|---|
| `rounded-none` | 0 | Edge-to-edge surfaces |
| `rounded-sm` | 8px (`--radius - 4px`) | Tab triggers, inline badges |
| `rounded` | 4px (Tailwind default) | Tiny chips |
| `rounded-md` | 10px (`--radius - 2px`) | Buttons, inputs, dropdowns |
| `rounded-lg` | 12px (`--radius`) | Cards (shadcn default), alerts |
| `rounded-xl` | 16px | Feature cards, glass panels |
| `rounded-2xl` | 24px | Image containers, large panels |
| `rounded-full` | 50% | Pills, avatar circles, icon buttons |

`rounded-[inherit]` and `rounded-[var(--radius)]` are tolerated only inside `ui/` primitives. (`DS-RADIUS-003` prefers `rounded-lg` over `rounded-[var(--radius)]`.)

### 2.10 Shadows

| Class | When to use |
|---|---|
| `shadow-sm` | Cards, subtle elevation |
| `shadow-md` | Popovers, dropdowns, menus, tooltips |
| `shadow-lg` | Dialogs, sheets, sidebar (floating variant) |
| `shadow-xl` | Toasts, prominent overlays |
| `shadow-2xl` | Reserved (rarely needed) |
| `glow-purple` | Hero elements (`<Button>` on Dashboard "New Audit") |
| `glow-border` | Hover state on interactive cards |

Arbitrary `shadow-[...]` is forbidden in app code (`DS-SHADOW-001`). The two known exceptions are inside `ui/sidebar.tsx` and `audit/AutoCrawlThumbnailStrip.tsx` for purple ring focus recipes.

### 2.11 Effects & Special Utilities

**Glass morphism — `.glass`** (defined in `index.css`):

```css
background: hsl(240 10% 8% / 0.8);
backdrop-filter: blur(12px);
border: 1px solid hsl(240 6% 18%);
```

Use on: interactive cards, panels that float over content, sidebar overlays, header.

**Glow effects:**
- `.glow-purple` — ambient purple glow for hero elements: `box-shadow: 0 0 40px hsl(262 83% 58% / 0.2), 0 0 80px hsl(262 83% 58% / 0.1);`
- `.glow-border` — purple inset+ambient ring for hover/focus states on cards: `box-shadow: inset 0 0 0 1px hsl(262 83% 58% / 0.3), 0 0 20px hsl(262 83% 58% / 0.1);`

**Hover scale**: `hover:scale-[1.02]` — subtle lift on interactive cards. Never larger.

**Custom animations** (defined in `index.css`):
- `animate-highlight-pulse` — pulsing glow on issue cards (1.5s ease-out, fires once)
- `tour-bridge-ring` — breathing ring for tour highlights (2s ease-in-out infinite)
- `accordion-down` / `accordion-up` — collapsible accordions (Tailwind config, 0.2s ease-out)

### 2.12 Z-Index System

| Value | Use case |
|---|---|
| `z-10` | Sidebar, resizable handles |
| `z-20` | Mobile sidebar overlay |
| `z-50` | Dialogs, dropdowns, popovers, tooltips, sheets, drawers (Radix default) |
| `z-[99999]` | Toast/Sonner viewport (must be above all modals) |
| `10000` / `10001` | Google Drive Picker (external UI override, `!important` in `index.css`) |

---

## 3. Primitive Inventory

Every file in `src/components/ui/`. **48 primitives total.**

| # | Primitive | File | Replaces (raw HTML) | Variants / Props | When to use | When NOT to use |
|---|---|---|---|---|---|---|
| 1 | `Accordion` | `accordion.tsx` | `<details>` / collapsible group | Radix; `type="single"` or `"multiple"` | FAQ sections, expandable panels with multiple items | Single collapsible — use `Collapsible` |
| 2 | `Alert` | `alert.tsx` | inline notice div | `variant: "default" \| "destructive"` | In-page warnings/info that aren't transient | Transient feedback — use `toast()` |
| 3 | `AlertDialog` | `alert-dialog.tsx` | `window.confirm()` | Action/Cancel; pass `<Button variant="destructive">` via `asChild` for destructive | Destructive confirmations ("Delete audit") | Generic forms — use `Dialog` |
| 4 | `AspectRatio` | `aspect-ratio.tsx` | inline aspect-ratio CSS | Radix (single root) | Fixed aspect images / iframes / video | Free-form content |
| 5 | `Avatar` | `avatar.tsx` | `<img>` user portrait | `<AvatarImage>` + `<AvatarFallback>` | User profile portraits | Decorative icons — use lucide |
| 6 | `Badge` | `badge.tsx` | inline pill `<span>` | `variant: "default" \| "secondary" \| "destructive" \| "outline"` | Status pills, tags, counts | Score pills — use `scoreToBadgeClasses()` |
| 7 | `Breadcrumb` | `breadcrumb.tsx` | `<nav>` breadcrumb | `<BreadcrumbList>`, `<BreadcrumbItem>`, `<BreadcrumbLink>`, `<BreadcrumbPage>`, `<BreadcrumbSeparator>` | Page context navigation | Top-level nav — use header links |
| 8 | `Button` | `button.tsx` | `<button>` | `variant: default\|destructive\|outline\|secondary\|ghost\|link`; `size: default\|sm\|lg\|icon`; `asChild` | All clickable actions | Pure decoration |
| 9 | `Calendar` | `calendar.tsx` | `<input type="date">` | `react-day-picker` props | Date pickers (inside Popover) | Time picking — not implemented |
| 10 | `Card` | `card.tsx` | grouped content `<div>` | `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardDescription>`, `<CardContent>`, `<CardFooter>` | Static info groupings | Interactive hero cards — use `glass rounded-xl` recipe |
| 11 | `Carousel` | `carousel.tsx` | scrolling list | Embla; `orientation: horizontal\|vertical`; `<CarouselPrevious>`, `<CarouselNext>` | Image/screenshot galleries | Multi-page content — use `Tabs` or routes |
| 12 | `Chart` | `chart.tsx` | `<svg>` recharts wrapper | `<ChartContainer>`, `<ChartTooltip>`, `<ChartTooltipContent>`, `<ChartLegend>`, `<ChartLegendContent>`; takes a `ChartConfig` keyed by series | Recharts-based data viz | Tables — use `Table` |
| 13 | `Checkbox` | `checkbox.tsx` | `<input type="checkbox">` | Radix (single, controlled) | Boolean form inputs | Multi-select with rich items — use Command + DropdownMenu |
| 14 | `Collapsible` | `collapsible.tsx` | `<details>` | Radix (`<CollapsibleTrigger>`, `<CollapsibleContent>`) | Single-item disclosure | Multi-item — use `Accordion` |
| 15 | `Command` | `command.tsx` | search-list combo | `<Command>`, `<CommandInput>`, `<CommandList>`, `<CommandEmpty>`, `<CommandGroup>`, `<CommandItem>`, `<CommandSeparator>`, `<CommandShortcut>`, `<CommandDialog>` | Command palette (`⌘K`), filterable lists | Simple selects — use `Select` |
| 16 | `ContextMenu` | `context-menu.tsx` | right-click `<menu>` | Radix; full menu API | Right-click affordances | Always-visible menus — use `DropdownMenu` |
| 17 | `Dialog` | `dialog.tsx` | inline modal | `<Dialog>`, `<DialogTrigger>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogDescription>`, `<DialogFooter>`, `<DialogClose>`. Default `max-w-lg`. | Modals with forms or content | Destructive confirmations — use `AlertDialog`. Side panels — use `Sheet` |
| 18 | `Drawer` | `drawer.tsx` | mobile bottom sheet | `vaul` lib; same parts as Sheet | Mobile-first bottom sheets | Desktop-first overlays — use `Sheet` |
| 19 | `DropdownMenu` | `dropdown-menu.tsx` | `<select>` for actions | Radix; `<DropdownMenuTrigger>`, `<DropdownMenuContent>`, `<DropdownMenuItem>`, `<DropdownMenuCheckboxItem>`, `<DropdownMenuRadioItem>`, `<DropdownMenuLabel>`, `<DropdownMenuSeparator>`, `<DropdownMenuSub*>` | Actions menus on a trigger button | Single-value form select — use `Select` |
| 20 | `Form` | `form.tsx` | `<form>` w/ react-hook-form | `<Form>` (= `FormProvider`), `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormDescription>`, `<FormMessage>`. See `DS-PRIMITIVE-007` and section 4.2. | All react-hook-form forms | One-off uncontrolled forms (rare) |
| 21 | `HoverCard` | `hover-card.tsx` | `title` attribute | Radix; `<HoverCardTrigger>`, `<HoverCardContent>` | Rich preview on hover (user cards) | Click-required content — use `Popover` |
| 22 | `Input` | `input.tsx` | `<input type="text\|email\|...">` | Native `<input>` props | Text/email/password/url/number/search/file fields | Multi-line — use `Textarea` |
| 23 | `InputOTP` | `input-otp.tsx` | OTP entry | `input-otp` lib; `<InputOTPGroup>`, `<InputOTPSlot>`, `<InputOTPSeparator>` | One-time code inputs | Regular numeric — use `Input type="number"` |
| 24 | `Label` | `label.tsx` | `<label>` | Radix Label; native props plus `peer-disabled:` styles | Standalone labels paired with inputs | Inside `<FormItem>` — use `<FormLabel>` |
| 25 | `Menubar` | `menubar.tsx` | top app menu bar | Radix; full menu bar API | Desktop-app-style menus (rare in this app) | Most pages — use header + DropdownMenu |
| 26 | `NavigationMenu` | `navigation-menu.tsx` | top nav | Radix nav menu | Multi-section top nav with rich panels | Simple link list — plain `<nav>` with `<Button variant="ghost">` |
| 27 | `Pagination` | `pagination.tsx` | `<nav>` page-navigation | `<PaginationContent>`, `<PaginationItem>`, `<PaginationLink>`, `<PaginationPrevious>`, `<PaginationNext>`, `<PaginationEllipsis>` | Paginated tables/lists | Infinite scroll — implement separately |
| 28 | `Popover` | `popover.tsx` | inline floating panel | Radix; `<PopoverTrigger>`, `<PopoverContent>` | Filter panels, color/date pickers triggered by a button | Hover preview — use `HoverCard`. Tiny string — use `Tooltip` |
| 29 | `Progress` | `progress.tsx` | `<progress>` | `value: 0..100` | Determinate progress bars | Indeterminate / loading — use `Skeleton` or `Loader2` |
| 30 | `RadioGroup` | `radio-group.tsx` | `<input type="radio">` group | Radix; `<RadioGroup>`, `<RadioGroupItem>` | Mutually-exclusive options shown inline | Long lists — use `Select` |
| 31 | `Resizable` | `resizable.tsx` | split panes | `react-resizable-panels`; `<ResizablePanelGroup>`, `<ResizablePanel>`, `<ResizableHandle>` | IDE-style split layouts | Static layout — plain grid |
| 32 | `ScrollArea` | `scroll-area.tsx` | scroll container | Radix; `<ScrollArea>`, `<ScrollBar>` | Custom scrollbars in modals/popovers/long lists | Page-level scrolling — let the browser handle it |
| 33 | `Select` | `select.tsx` | `<select>` | Radix; `<Select>`, `<SelectTrigger>`, `<SelectValue>`, `<SelectContent>`, `<SelectItem>`, `<SelectGroup>`, `<SelectLabel>`, `<SelectSeparator>` | Single-value form selects | Action menus — use `DropdownMenu`. Searchable — use `Command` |
| 34 | `Separator` | `separator.tsx` | `<hr>` | `orientation: "horizontal" \| "vertical"`; default 1px `bg-border` | Visual divider | Layout spacing — use whitespace |
| 35 | `Sheet` | `sheet.tsx` | side drawer | `side: "top" \| "bottom" \| "left" \| "right"`; same parts as Dialog | Side panels (filters, settings drilldown) | Centered modal — use `Dialog`. Mobile bottom — use `Drawer` |
| 36 | `Sidebar` | `sidebar.tsx` | app shell sidebar | Full sidebar system: `<SidebarProvider>`, `<Sidebar>`, `<SidebarHeader>`, `<SidebarContent>`, `<SidebarFooter>`, `<SidebarMenu>`, `<SidebarMenuItem>`, `<SidebarMenuButton>`, etc. Variants: `sidebar \| floating \| inset`. Collapsible: `offcanvas \| icon \| none`. Width via CSS vars. | App shell navigation | Page-internal nav — use `Tabs` or `NavigationMenu` |
| 37 | `Skeleton` | `skeleton.tsx` | shimmer placeholder | Single root, `animate-pulse bg-muted` | Loading placeholders for content shape | Spinner — use `Loader2` icon |
| 38 | `Slider` | `slider.tsx` | `<input type="range">` | Radix slider | Numeric range inputs | Discrete steps with labels — use `RadioGroup` |
| 39 | `Sonner` | `sonner.tsx` | toast | `toast()`, `toast.error()`, `toast.success()`, `toast.warning()`, `toast.info()`. Position `top-center`, `z-[99999]`. **Canonical toast system.** | Transient feedback after async actions | In-page warnings — use `Alert` |
| 40 | `Switch` | `switch.tsx` | `<input type="checkbox">` toggle | Radix switch | Boolean toggles where on/off is the affordance | Form checkboxes (lists) — use `Checkbox` |
| 41 | `Table` | `table.tsx` | `<table>` | `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableFooter>`, `<TableRow>`, `<TableHead>`, `<TableCell>`, `<TableCaption>` | Tabular data | Card grids — use `<div className="grid">` |
| 42 | `Tabs` | `tabs.tsx` | tab strip | Radix; `<Tabs>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` | In-page section switcher | Cross-page nav — use routes; long tab lists (>7) — split |
| 43 | `Textarea` | `textarea.tsx` | `<textarea>` | Native props; `min-h-[80px]` | Multi-line text input | Single-line — use `Input` |
| 44 | `Toast` (legacy) | `toast.tsx` + `toaster.tsx` + `use-toast.ts` | Radix toast | `<Toast>`, `<ToastTitle>`, `<ToastDescription>`, `<ToastAction>`, `<ToastClose>`, `<ToastProvider>`, `<ToastViewport>`. Variants: `default \| destructive \| success`. **Deprecated — see `DS-PRIMITIVE-010` / `REWORK-004`.** | Legacy callsites only | New code — use `Sonner` (`toast()`) |
| 45 | `Toggle` | `toggle.tsx` | toggle button | `variant: "default" \| "outline"`; `size: "default" \| "sm" \| "lg"` | Single bistable button (e.g. bold/italic) | Boolean form value — use `Switch` |
| 46 | `ToggleGroup` | `toggle-group.tsx` | grouped toggles | Inherits `Toggle` variants; `type: "single" \| "multiple"` | Toolbars (text alignment, view modes) | Tab-style switchers — use `Tabs` |
| 47 | `Tooltip` | `tooltip.tsx` | `title` attribute | Radix; `<TooltipProvider>`, `<TooltipTrigger>`, `<TooltipContent>` | Short labels for icon-only buttons | Rich content — use `HoverCard` or `Popover` |
| 48 | `useToast` (hook) | `use-toast.ts` | — | Hook for legacy Toast system | Legacy callsites only | New code — call `toast()` from `sonner.tsx` |

---

## 4. Component Recipes (Detailed)

### 4.1 Button

Source: `src/components/ui/button.tsx`. Base:

```
inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium
ring-offset-background transition-colors
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:pointer-events-none disabled:opacity-50
[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0
```

| Variant | Classes | Use case |
|---|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` | Primary CTA |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | Delete, irreversible actions |
| `outline` | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` | Secondary actions |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` | Tertiary actions |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` | Toolbar/nav actions |
| `link` | `text-primary underline-offset-4 hover:underline` | Inline text links |

| Size | Classes |
|---|---|
| `default` | `h-10 px-4 py-2` |
| `sm` | `h-9 rounded-md px-3` |
| `lg` | `h-11 rounded-md px-8` |
| `icon` | `h-10 w-10` |

**Rules** (also encoded as hard rules):
- Destructive actions → `variant="destructive"`. Never ad-hoc red.
- Reconnect / secondary adjacent to destructive → `variant="outline"`.
- Icons inside buttons: auto-sized via `[&_svg]:size-4`. Don't add `mr-2` — `gap-2` handles spacing.
- Icon-only buttons need `aria-label` (`DS-A11Y-002`).

### 4.2 Form (react-hook-form pattern)

Source: `src/components/ui/form.tsx`. Pattern:

```tsx
const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues });

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input type="email" {...field} />
          </FormControl>
          <FormDescription>We'll never share this.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
    <div className="flex justify-end">
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Save changes
      </Button>
    </div>
  </form>
</Form>
```

**Why this pattern:**
- `<FormItem>` generates a stable `id` and provides `formItemId`, `formDescriptionId`, `formMessageId` via context.
- `<FormControl>` wires `id`, `aria-describedby`, `aria-invalid` automatically — satisfies `DS-A11Y-004`.
- `<FormLabel>` automatically gets `htmlFor={formItemId}` AND `text-destructive` when the field has an error.
- `<FormMessage>` auto-renders the zod error or accepts `children`.

**Don't:**
- Use `Controller` directly outside `ui/form.tsx` (`DS-PRIMITIVE-007`).
- Pair `<Label>` + `<Input>` manually inside a hook-form `<Form>` — the IDs won't be wired.

### 4.3 Badge

Source: `src/components/ui/badge.tsx`. Base: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors`.

| Variant | Classes |
|---|---|
| `default` | `border-transparent bg-primary text-primary-foreground hover:bg-primary/80` |
| `secondary` | `border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `destructive` | `border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80` |
| `outline` | `text-foreground` |

For score badges → `scoreToBadgeClasses()` (`DS-COLOR-004`).

For status pills (New, Beta, Important): `/25` opacity for sufficient contrast:
- New: `bg-primary/25 text-primary`
- Beta/Important: `bg-amber-500/25 text-amber-400`

### 4.4 Card

Source: `src/components/ui/card.tsx`.

| Part | Classes |
|---|---|
| `Card` | `rounded-lg border bg-card text-card-foreground shadow-sm` |
| `CardHeader` | `flex flex-col space-y-1.5 p-6` |
| `CardTitle` | `text-2xl font-semibold leading-none tracking-tight` |
| `CardDescription` | `text-sm text-muted-foreground` |
| `CardContent` | `p-6 pt-0` |
| `CardFooter` | `flex items-center p-6 pt-0` |

**Named card recipes (REWORK-007 phase 1).** Three utilities live in `src/index.css` under `@layer utilities` to codify the patterns below. Prefer these over ad-hoc class strings; see §5.1 for which to pick.

| Utility | Apply | Equivalent to |
|---|---|---|
| `.qa-card-static` | `rounded-lg border bg-card text-card-foreground shadow-sm` | `<Card>` defaults |
| `.qa-card-interactive` | `glass rounded-xl p-6 transition-all hover:glow-border hover:scale-[1.02] cursor-pointer` | Interactive hero card (e.g. Dashboard project card) |
| `.qa-card-info` | `rounded-xl border border-border bg-card p-5 flex items-start gap-4` | Static info card with leading icon (e.g. About page facts) |

> Note: `.glass rounded-xl` (without the hover/scale/cursor combo) is a panel-container pattern, not a card recipe — keep using `glass rounded-xl …` directly for those. The `.qa-card-interactive` utility specifically marks a clickable card affordance.

### 4.5 Input / Textarea / Select trigger

All three share these base classes (with size differences):
```
flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm
ring-offset-background placeholder:text-muted-foreground
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:cursor-not-allowed disabled:opacity-50
```

- `Input` is `h-10`; mobile `text-base` collapses to `md:text-sm`.
- `Textarea` is `min-h-[80px]`.
- `SelectTrigger` is `h-10` and uses `focus:ring-2` (not `focus-visible:`) — Radix sets focus on click. Equivalent in practice.

### 4.6 Tabs

Source: `src/components/ui/tabs.tsx`.

| Part | Classes |
|---|---|
| `TabsList` | `inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground` |
| `TabsTrigger` | `inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50` |
| `TabsContent` | `mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |

**Full-width tab bars with many labels** (e.g. Settings with 6 tabs): use `w-full flex justify-between` on `TabsList` (each trigger keeps natural width with consistent `px-3` padding; remaining space distributes evenly). **Never use `grid grid-cols-N`** — forces equal column widths and creates asymmetric outer gaps when label lengths differ.

**Danger Zone tab**: apply `data-[state=active]:text-destructive` (not `text-destructive`) so red shows only when active.

### 4.7 Dialog / AlertDialog / Sheet / Drawer (overview)

| Primitive | Visual | Animation | Default size |
|---|---|---|---|
| `Dialog` | Centered modal | Zoom + slide from top | `max-w-lg` |
| `AlertDialog` | Centered modal | Same | `max-w-lg` |
| `Sheet` | Edge-anchored panel | Slide from edge | `w-3/4 sm:max-w-sm` (left/right) |
| `Drawer` | Bottom sheet | Slide up + scale background | Full-width, height auto |

Common rules:
- Overlay: `fixed inset-0 z-50 bg-black/80`
- Title required (`DS-A11Y-010`)
- Close button: `absolute right-4 top-4` with `<X className="h-4 w-4" />`

`AlertDialogAction` does not accept a `variant` prop. For destructive actions, use `asChild`:

```tsx
<AlertDialogAction asChild>
  <Button variant="destructive" onClick={onConfirm}>
    {confirmLabel}
  </Button>
</AlertDialogAction>
```

Confirmation dialog copy rule: name both actions explicitly (`DS-COPY-002`).

### 4.8 Toast (Sonner) — canonical

Source: `src/components/ui/sonner.tsx`. Position `top-center`, `z-[99999]` (above all modals), dark theme.

```ts
import { toast } from "@/components/ui/sonner";

toast("Saved");
toast.error("Failed to save", { description: "Network unreachable" });
toast.success("Saved");
toast.warning("Almost out of audits");
toast.info("New version available");
```

> **✓ RESOLVED — coherence** — Sonner success/warning/info now distinct (REWORK-005)
> **Change:** `toast.success` → `green-500/20` tint + `green-400` text; `toast.warning` → `amber-500/20` tint + `amber-400` text; `toast.info` keeps primary purple; `toast.error` keeps destructive red. Inline rgb() values mirror the `score-colors.ts` allow-list.

> **⚠ REWORK PROPOSAL — coherence** — Two toast systems coexist
> **Current:** `src/components/ui/toast.tsx` + `toaster.tsx` + `use-toast.ts` (Radix toast) AND `src/components/ui/sonner.tsx` (Sonner) both render in the app.
> **Problem:** Two libraries doing the same job; behavior may diverge; bundles include both.
> **Proposed:** Pick Sonner as canonical (already documented as such). Migrate any `useToast` callsites to `toast()` from sonner. Delete `toast.tsx`, `toaster.tsx`, `use-toast.ts`. Hard rule: `DS-PRIMITIVE-010`.
> **Affects:** Any callsite importing `@/components/ui/toast` or `@/components/ui/use-toast`.
> **Status:** Awaiting approval. Tracked as `REWORK-004`.

### 4.9 Sidebar

Source: `src/components/ui/sidebar.tsx`. App-shell sidebar built around `<SidebarProvider>` + a context. Persists `open` state via `sidebar:state` cookie. Keyboard shortcut: `⌘B` / `Ctrl+B`. Width: `16rem` desktop, `18rem` mobile (sheet), `3rem` icon-collapsed.

Variants:
- `variant`: `sidebar` (flush) | `floating` (rounded with shadow) | `inset` (margin around main)
- `collapsible`: `offcanvas` (slides off) | `icon` (icon-only) | `none`
- `side`: `left` | `right`

Use the full part list in section 3 (#36) for menus, sub-menus, badges, actions, skeleton.

### 4.10 Separator / Skeleton / Avatar / Progress

- `Separator` — `shrink-0 bg-border`; `h-[1px] w-full` horizontal, `h-full w-[1px]` vertical.
- `Skeleton` — `animate-pulse rounded-md bg-muted`. Already includes `aria-hidden="true"`.
- `Avatar` — `relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full`. `<AvatarImage>` is `aspect-square`. `<AvatarFallback>` falls back to `bg-muted`.
- `Progress` — `h-4 w-full rounded-full bg-secondary` track; `bg-primary` indicator. Set `value` 0–100.

---

## 5. Decision Rules — When Patterns Compete

When two primitives or recipes could both solve a problem, follow these rules.

### 5.1 Card vs glass vs static info card

| Scenario | Use | Utility |
|---|---|---|
| Static information group with header + content | `<Card>` (`rounded-lg border bg-card shadow-sm`) | `.qa-card-static` |
| Interactive hero card with hover lift | `glass rounded-xl p-6 transition-all hover:glow-border hover:scale-[1.02] cursor-pointer` | `.qa-card-interactive` |
| Static info card with icon and short description | `rounded-xl border border-border bg-card p-5 flex items-start gap-4` | `.qa-card-info` |
| List rows (audits, projects) | `<Card>` if grouped sections; otherwise plain `<div>` with `bg-surface-1 hover:bg-surface-2 rounded-lg` | — |

The three named utilities (`.qa-card-static`, `.qa-card-interactive`, `.qa-card-info`) are defined in `src/index.css`. Use the utility instead of the raw class string when adding new card-shaped UI; this keeps the recipes centralized so future tweaks (radius, padding, hover effect) propagate from one place.

> **⚠ REWORK PROPOSAL — coherence** — Three card recipes for similar jobs
> **Current:** `<Card>`, the `glass` interactive recipe, and the `rounded-xl border border-border bg-card p-5` static recipe all show up as "card-shaped containers".
> **Problem:** Hard to choose; reviewers can't tell which is wrong.
> **Proposed:** Add three named utility classes to `index.css`: `.qa-card-static` (= `<Card>` defaults), `.qa-card-interactive` (= glass recipe), `.qa-card-info` (= bordered info recipe). Then mandate use of the class instead of ad-hoc string assembly. Linter rule `DS-CARD-001` (future) flags `glass rounded-xl p-6` as "use `.qa-card-interactive`".
> **Affects:** All current static-card and interactive-card sites.
> **Status:** Phase 1 done — recipes defined in `src/index.css`, awaiting user approval before Phase 2 migration. Tracked as `REWORK-007`.

### 5.2 Dialog vs Sheet vs Drawer vs AlertDialog

| Scenario | Use |
|---|---|
| Destructive confirmation ("Delete X?") | `AlertDialog` |
| Centered modal form (Edit project, New audit) | `Dialog` |
| Side panel for filters or settings drilldown | `Sheet` (right by default) |
| Mobile bottom sheet (touch-friendly action list) | `Drawer` |
| Full-page form | route, not a modal |

### 5.3 Form (react-hook-form) vs raw `<form>`

| Scenario | Use |
|---|---|
| Any form with ≥2 fields, validation, or submission state | `Form` + `FormField` (react-hook-form) |
| Single-field "search" or filter input | raw `<form>` with native `onSubmit`, no react-hook-form needed |
| Dialog with one input | raw `<form>` is fine; use `<Label>` + `<Input>` with explicit `htmlFor` |

### 5.4 Tabs vs separate routes

| Scenario | Use |
|---|---|
| Switching views of the same resource (Settings sections) | `Tabs` |
| Cross-resource navigation (Projects → Audits) | routes |
| Tabs >7 items | split or use `Sidebar` |
| Tabs that need deep linking | route per tab (use URL search param if Tabs is preferred) |

### 5.5 DropdownMenu vs Select vs Command vs ContextMenu

| Scenario | Use |
|---|---|
| Form value (one-of) | `Select` |
| Searchable form value | `Command` (often inside `Popover`) |
| Action menu on a trigger button | `DropdownMenu` |
| Right-click affordance | `ContextMenu` |
| Global command palette (`⌘K`) | `Command` inside `CommandDialog` |

### 5.6 Tooltip vs HoverCard vs Popover

| Scenario | Use |
|---|---|
| Short string label (1–4 words) for icon-only button | `Tooltip` |
| Rich preview shown on hover | `HoverCard` |
| Click-required panel (filters, color picker) | `Popover` |

### 5.7 Sonner vs in-page Alert

| Scenario | Use |
|---|---|
| Transient feedback after async action ("Saved") | `toast()` from `sonner.tsx` |
| Persistent banner that stays until acknowledged | `<Alert>` |
| Destructive irreversible warning before action | `AlertDialog` |

### 5.8 Standard page structure

```tsx
<main className="max-w-7xl mx-auto px-6 py-12">
  <div className="flex items-center justify-between mb-8">
    <div>
      <h1 className="text-3xl font-bold">Page title</h1>
      <p className="text-muted-foreground mt-1">Subtitle</p>
    </div>
    <Button>Primary action</Button>
  </div>
  {/* content */}
</main>
```

**One hero action per view.** Competing CTAs = broken hierarchy.

### 5.9 Form footer

```tsx
<div className="flex justify-end">
  <Button type="submit" disabled={isPending}>
    Save changes
  </Button>
</div>
```

Right-aligned. Not full-width inside form panels.

### 5.10 Empty state

Every list, table, or data view must have an empty state. Never a blank void. Standard recipe:

```tsx
<div className="flex flex-col items-center justify-center py-24 text-center">
  <div className="w-20 h-20 rounded-full bg-surface-2 flex items-center justify-center mb-6">
    <Icon className="h-10 w-10 text-muted-foreground" />
  </div>
  <h2 className="text-xl font-semibold mb-2">{title}</h2>
  <p className="text-muted-foreground mb-6 max-w-md">{description}</p>
  <Button>{primaryActionLabel}</Button>
</div>
```

---

## 6. Microcopy Rules

- **Button labels name the outcome, not the action.** "Save changes", "Create audit" — not "Submit" or "OK".
- **No ellipsis (`…`) on button labels** (`DS-COPY-001`). Ellipsis implies a dialog will follow — use only when literally true; even then, prefer explicit labels.
- **Error messages:** explain what happened + why + what to do next.
- **Confirmation dialogs:** name both actions explicitly (`DS-COPY-002`). "Delete audit / Keep it", never "OK / Cancel".
- **No jargon:** "Connect your account" beats "Authenticate via OAuth".
- **Sentence case** for all labels, section descriptions, and microcopy (`DS-COPY-003`). Title Case only for proper nouns and brand names.
- **Section descriptions** (below `<h2>` headings): `text-sm text-muted-foreground`. Inline form hints (next to inputs): `text-xs text-muted-foreground`.
- **Submit buttons** are right-aligned in form panels, not full-width.
- **Loss-aversion framing** at high-stakes moments. "Don't lose your progress" beats "Save your progress".

---

## 7. Accessibility (mechanical)

The hard rules `DS-A11Y-001` through `DS-A11Y-011` enumerate everything the linter checks. Summary:

- **alt text** required on every `<img>`; decorative gets `alt=""`.
- **Accessible names** on icon-only buttons/links — `aria-label` or `<span className="sr-only">`.
- **Form inputs** need an associated `<Label htmlFor>`, an `aria-label`, or `<FormItem>` wrapper.
- **Semantic HTML** over `<div>` for landmarks: `<main>`, `<nav aria-label>`, `<header>`, `<footer>`.
- **Focus-visible** required on every interactive element. Base primitives include the recipe `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- **Heading order** must not skip levels.
- **`onClick` on non-button** requires `role="button"` + `tabIndex={0}` + keyboard handler. **Better: use `<Button variant="ghost">` instead.**
- **Color must not be the only signal** — pair with icon, label, position, or sr-only text.
- **Color contrast** ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI elements. See section 2.1 for token-level audit and `REWORK-001`/`REWORK-002`.
- **Dialog/Sheet/Drawer/AlertDialog** require a title (visible or `sr-only`).
- **Links** with only an icon need `aria-label`.

---

## 8. UX Principles (judgment calls)

Qualia evaluates design quality — its own UI must reflect that bar. These principles complement section 1's hard rules; apply when judgment arises.

### Visual & Layout
- **Alignment is not optional.** Consistent vertical grid; zig-zag layouts signal low craft.
- **Match the context.** Dense data = compact and scannable. Focused tasks = calm and minimal.
- **Whitespace is structure.** Don't fill empty space.
- **Padding must be visually equal** on left and right. If it isn't, the layout approach is wrong.

### Interaction
- **Every interactive element needs all states.** Default, hover, active, loading, error, success, disabled.
- **Feedback must be immediate and visible.** After async actions, show success/error.
- **No false affordance.** Static elements must not look interactive.

### Decision Architecture
- **Keep choices under 5–7 per decision point** (Hick's Law).
- **Set smart defaults.** Pre-select the most common or safest option.
- **Loss-aversion framing** at high-stakes moments.

### Quality Bar
- **Steelman before changing.** If a reasonable designer could have made the choice intentionally, justify before overriding.
- **Prioritize the highest-stakes element.** Critical-path weakness > polish elsewhere.
- **No decorative complexity.** Clean and functional beats clever and cluttered.

---

## 9. Required States Reference

Every interactive element must support all of these:

| State | Pattern |
|---|---|
| Default | Base classes |
| Hover | `hover:bg-*`, `hover:text-*`, `hover:scale-[1.02]` (cards) |
| Focus | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| Active / pressed | `active:scale-[0.98]` where relevant |
| Loading | Show `<Loader2 className="h-4 w-4 animate-spin" />`, disable button |
| Error | Show error text (FormMessage), destructive border |
| Disabled | `disabled:pointer-events-none disabled:opacity-50` |

### Radix data attributes used app-wide

| Attribute | Values | Use |
|---|---|---|
| `data-[state=open]` / `data-[state=closed]` | — | Dialogs, dropdowns, modals, accordions |
| `data-[state=active]` / `data-[state=inactive]` | — | Tab triggers |
| `data-[state=checked]` / `data-[state=unchecked]` | — | Checkboxes, switches |
| `data-[state=on]` / `data-[state=off]` | — | Toggle, ToggleGroup |
| `data-[state=selected]` | — | Table row, calendar day |
| `data-[disabled]` | — | Radix disabled |
| `data-[side=top\|right\|bottom\|left]` | — | Popover/Tooltip/DropdownMenu side-aware animations |
| `data-[motion=from-*]` / `data-[motion=to-*]` | — | NavigationMenu transitions |

### Animation patterns

- **Enter:** `data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`
- **Exit:** `data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`
- **Slide:** `data-[side=bottom]:slide-in-from-top-2` etc. (popover/tooltip/dropdown)
- **Loading:** `animate-spin` on `Loader2`
- **Skeleton:** `animate-pulse` on placeholder blocks
- **Custom:** `animate-highlight-pulse` (1.5s once), `tour-bridge-ring` (2s infinite), `accordion-down/up` (0.2s)
- **Transitions:** `transition-colors` (hover color), `transition-opacity` (fades), `transition-all` sparingly
- **Duration:** default 200ms; explicit `duration-300`, `duration-500` for slower

---

## 10. Icons

**Library:** `lucide-react` — the only icon library (`DS-PRIMITIVE-011`).

**Sizes:**

| Size | Context |
|---|---|
| `h-3 w-3` | Compact badges, tight UI |
| `h-4 w-4` | Buttons (auto via `[&_svg]:size-4`), inline text icons |
| `h-5 w-5` | Card headers, section icons |
| `h-6 w-6` | Feature icons |
| `h-8 w-8` | Large prominent icons, loading spinners |

**Color:** pair with `text-primary`, `text-muted-foreground`, or score colors. Add `shrink-0` when the icon is inside a flex row that might compress.

**In buttons:** auto-sized to `size-4` by `[&_svg]:size-4 [&_svg]:shrink-0`. Don't add `mr-2` — `gap-2` handles spacing.

**Decorative icons** in text need `aria-hidden="true"` (`DS-A11Y-008`).

---

## 11. Responsive Breakpoints

Standard Tailwind: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1400 (container max).

Common patterns:
- `hidden sm:flex` / `hidden sm:inline` — show on desktop
- `flex-col sm:flex-row` — stack on mobile, row on desktop
- `text-3xl md:text-4xl` — responsive heading scale
- `px-4 sm:px-6 lg:px-8` — responsive horizontal padding

---

## 12. Rework Backlog

Sequential `REWORK-*` IDs raised inline above. Status: all **Awaiting approval** unless noted. Each requires user decision before code is touched.

| ID | Type | Summary | Affects |
|---|---|---|---|
| `REWORK-001` | a11y | ✓ **Resolved.** `--muted-foreground` lightness raised 55% → 65% in `src/index.css`. New ratios: ~5.2:1 on `bg-muted`, ~6.5:1 on `bg-background`. | `src/index.css` |
| `REWORK-002` | a11y | ✓ **Resolved (path B).** Retired `text-destructive` / `text-success` foreground-token usage. Canonical "red text" = `text-red-400`, "green text" = `text-green-400`. `bg-destructive` + `text-destructive-foreground` button/badge pairing is unchanged. | 23 files, 39 callsites migrated |
| `REWORK-003` | coherence | Score thresholds duplicated between `src/lib/score-colors.ts` and `figma-plugin/src/ui/views/ReportView.tsx` with no enforcement. Add a sync test. | `figma-plugin` test |
| `REWORK-004` | coherence | Two toast systems coexist (Radix `<Toast>` + Sonner). Pick Sonner as canonical and delete `toast.tsx`/`toaster.tsx`/`use-toast.ts` after migrating callsites. | Any `useToast` callsite |
| `REWORK-005` | coherence | ✓ **Resolved.** `toast.success` → green-500/20 tint + green-400 text; `toast.warning` → amber-500/20 tint + amber-400 text; `toast.info` stays primary; `toast.error` stays destructive. | `src/components/ui/sonner.tsx` |
| `REWORK-006` | coherence | Settings page max-width is `max-w-3xl` in code but old doc said `max-w-5xl`. Documented as resolved (`max-w-3xl` wins). | Doc-only |
| `REWORK-007` | coherence | Three competing card recipes (`<Card>`, `glass rounded-xl p-6`, `rounded-xl border border-border bg-card p-5`). Add named utilities `.qa-card-static`, `.qa-card-interactive`, `.qa-card-info` and mandate them. **Phase 1 done — recipes defined in `src/index.css`, awaiting user approval before Phase 2 migration.** | All static- and interactive-card sites |
| `REWORK-008` | coherence | Raw `bg-blue-*` / `text-blue-*` used in `src/components/NewProjectDialog.tsx` (Alert callout) and raw `bg-yellow-500/60` in `src/components/landing/PluginMockups.tsx` and `UseCaseMockups.tsx`. Replace with semantic tokens (or amber for warning) per `DS-COLOR-001` / `DS-COLOR-002`. | `NewProjectDialog.tsx`, `PluginMockups.tsx`, `UseCaseMockups.tsx` |
| `REWORK-009` | coherence | Numerous components hard-code `text-green-400` / `text-amber-400` / `text-red-400` triplets for score-state UI instead of importing `scoreToTailwindColor()` (e.g. `AuditDetail.tsx`, `AccessibilityCard.tsx`, `ScoreCard.tsx`). Migrate to helper. | `ScoreCard.tsx`, `AccessibilityCard.tsx`, `AuditDetail.tsx`, others |
| `REWORK-010` | coherence | `text-violet-500` in `src/components/ProWaitlistDialog.tsx` violates `DS-COLOR-001`. Replace with `text-primary`. | `ProWaitlistDialog.tsx` |
| `REWORK-011` | coherence | ✓ **Resolved.** Removed `--success` and `--success-foreground` from `index.css` (never mapped in Tailwind; rendered as dead code after `REWORK-002` path B). | `src/index.css` |
| `REWORK-012` | a11y | Several non-button click targets in `src/components/ProjectContextCard.tsx`, `src/components/PersonaManager.tsx` and elsewhere use `onClick` on `<div>` without `role="button"` + `tabIndex` + key handler. Audit and either convert to `<Button variant="ghost">` or add the trio. | Multiple components |
| `REWORK-013` | coherence | ✓ **Resolved.** `bg-gradient-radial` utility was a transparent no-op — definition removed from `index.css` and all callsites cleaned up. | Doc-only |
| `REWORK-014` | UX/affordance | Landing footer "Also available as a Figma plugin →" link reads as plain text (uses `text-muted-foreground`) despite the `→` arrow. Affordance doesn't match action. Promote to clear link styling (`text-primary hover:underline`) or wrap the row in a clickable card surface. _Surfaced during 2026-05-08 visual review of REWORK branches._ | landing footer component — **Resolved 2026-05-08 — see commit 5e9d9c9** |
| `REWORK-015` | UX/coherence (Engine X) | Team danger zone (Settings → Team) and account danger zone use **different visual treatments**: team has red-tinted bg + outline button (poor contrast on body copy); account uses filled `Button variant="destructive"`. Same UX concept, two implementations. Standardize on one danger-zone recipe. | `src/components/settings/TeamSettings.tsx` + account danger zone — **Resolved 2026-05-08 — see commit d1009f0** |
| `REWORK-016` | UX/coherence | Cookie controls render with three different button variants ("Withdraw cookie consent" looks primary, "Reset cookie banner" looks ghost, "Cookie preferences" looks like a plain link with icon) without clear hierarchy explaining the differences. Decide priority order and apply consistently — if all three are co-equal, use the same variant. | cookie consent UI — **Resolved 2026-05-08 — see commit 4605447** |
| `REWORK-017` | UX/coherence (Engine X) | "Save time — Get the plugin" CTA banner is present in the single-screen audit form but absent from the flow audit form. Cross-sectional inconsistency. Either add to flow form or remove from both. | `src/components/audit/SingleScreenForm.tsx`, `src/components/audit/FlowAnalysisForm.tsx` — **Resolved 2026-05-08 — see commits 87eb0fe + 61fa9b4** |

---

## 13. Things I couldn't decide — flagging for the user

- **`REWORK-002`** has two viable paths (raise token lightness vs retire the foreground tokens). Lower-risk is path (b) — please pick.
- **`REWORK-007`** introduces named utility classes; this changes how new components are written. OK to introduce, or stay with the raw recipes?
- **Sidebar token isolation (`DS-COLOR-007`)** — current code has only sidebar files using sidebar tokens, but the rule severity is set to `warn` rather than `error` because I'm not sure if any sidebar-adjacent shells (e.g. mobile menu) intentionally bridge them. Confirm severity.
- **`DS-PRIMITIVE-007`** is set to `warn` (not `error`) for `Controller` outside `ui/form.tsx` — there may be one-off controller usages in legacy code I haven't traced. Confirm severity.
