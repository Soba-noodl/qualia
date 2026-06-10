import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tailwindcss from "eslint-plugin-tailwindcss";
import noOnlyTests from "eslint-plugin-no-only-tests";
import tseslint from "typescript-eslint";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const qualiaCompliance = require("./scripts/compliance/eslint-plugin/index.cjs");
const reactPlugin = require("eslint-plugin-react");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  { ignores: ["dist", ".worktrees/", "scripts/compliance/eslint-plugin/tests/", "fixtures/"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "qualia-compliance": qualiaCompliance,
      "jsx-a11y": jsxA11y,
      tailwindcss,
      "no-only-tests": noOnlyTests,
      react: reactPlugin,
    },
    settings: {
      tailwindcss: {
        config: path.join(__dirname, "tailwind.config.ts"),
      },
      // Required by eslint-plugin-react to avoid "React version not specified" warning.
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "qualia-compliance/ds-color-001-no-raw-palette": "error",
      "qualia-compliance/ds-color-002-no-yellow": "error",
      // DS-A11Y-001
      "jsx-a11y/alt-text": "error",
      // DS-A11Y-011
      "jsx-a11y/anchor-has-content": "error",
      // DS-A11Y-008 (mechanical heading content check)
      "jsx-a11y/heading-has-content": "warn",
      // --- Wave 1: additional jsx-a11y rules at warn ---
      // DS-A11Y-002 — control-has-associated-label catches icon-only buttons
      // missing accessible name (closest mechanical match for Button size="icon").
      "jsx-a11y/control-has-associated-label": "warn",
      // DS-A11Y-003 — onClick on non-interactive element needs key handlers
      // and proper role/tabIndex. The two rules together cover the spec.
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      // DS-A11Y-004 — labels must be associated with form controls
      "jsx-a11y/label-has-associated-control": "warn",
      // DS-A11Y-006 — no redundant ARIA roles (heading-has-content already on)
      "jsx-a11y/no-redundant-roles": "warn",
      // NOTE: DS-A11Y-010 (Dialog/Sheet/Drawer must have a Title) has no
      // direct jsx-a11y equivalent — it requires Radix-aware AST analysis.
      // Left for Wave 3 (custom rule).
      // --- Wave 1: tailwindcss plugin rules at warn ---
      // DS-SPACING-002, DS-RADIUS-001, DS-TYPO-001 — flag arbitrary values
      // when an equivalent scale token exists (e.g. p-[16px] → p-4).
      // Reads tailwind.config.ts to resolve the project's tokens.
      // We deliberately use the narrower `no-unnecessary-arbitrary-value`
      // (not `no-arbitrary-value`) because legitimate cases exist
      // (e.g. `rounded-[var(--radius)]`, `rounded-[inherit]` per DS-RADIUS-002).
      "tailwindcss/no-unnecessary-arbitrary-value": "warn",
      // --- Wave 1: TEST-001 — no committed `.only` ---
      "no-only-tests/no-only-tests": "error",
      // --- Wave 1: ARCH-001 (complementary to runner) ---
      "no-restricted-imports": ["warn", {
        patterns: [
          {
            group: ["@/integrations/supabase/client"],
            message:
              "ARCH-001: Components and pages must not import the supabase client directly. Use a hook from src/hooks/ or a service from src/services/.",
          },
          // --- Wave 2: IMPORT-001 — prefer @/ alias over deep relative paths ---
          {
            regex: "^\\.\\./\\.\\./",
            message: "IMPORT-001: use @/ alias instead of deep relative imports (../../).",
          },
          // --- Wave 2: IMPORT-002 — no cross-imports src/ <-> figma-plugin/src/ ---
          {
            group: ["@/figma-plugin/*", "**/figma-plugin/**"],
            message: "IMPORT-002: src/ and figma-plugin/src/ are separate apps — no cross-imports.",
          },
          // --- Wave 2: DS-PRIMITIVE-011 — Lucide is the only icon library ---
          {
            group: ["react-icons", "react-icons/*", "@heroicons/*", "@radix-ui/react-icons"],
            message: "DS-PRIMITIVE-011: Lucide is the only icon library. Use lucide-react.",
          },
        ],
        paths: [
          // --- Wave 2: IMPORT-004 — legacy toast deprecation ---
          { name: "@/components/ui/toast", message: "IMPORT-004: legacy toast — use sonner." },
          { name: "@/components/ui/use-toast", message: "IMPORT-004: legacy toast — use sonner." },
          { name: "@/hooks/use-toast", message: "IMPORT-004: legacy toast — use sonner." },
          // --- Wave 3a: DS-PRIMITIVE-007 — form fields use <FormField>, not raw Controller.
          // src/components/ui/form.tsx is the one legitimate consumer — excluded via override below.
          { name: "react-hook-form", importNames: ["Controller"], message: "DS-PRIMITIVE-007: use <FormField> from ui/form instead of raw Controller." },
        ],
      }],
      // --- Wave 1 + Wave 2: no-restricted-syntax for declarative AST checks ---
      "no-restricted-syntax": ["warn",
        // ----------------------------------------------------------------
        // Wave 1 rules (preserved)
        // ----------------------------------------------------------------
        {
          // DS-TYPO-003: no arbitrary font-family in className (font-['Inter'])
          selector: "Literal[value=/\\bfont-\\[/]",
          message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono.",
        },
        {
          // DS-TYPO-003: same for template-literal classNames
          selector: "TemplateElement[value.raw=/\\bfont-\\[/]",
          message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono.",
        },
        {
          // DS-TYPO-004: no font-serif
          selector: "Literal[value=/\\bfont-serif\\b/]",
          message: "DS-TYPO-004: font-serif is forbidden. Use font-sans.",
        },
        {
          // DS-TYPO-004: same in template literals
          selector: "TemplateElement[value.raw=/\\bfont-serif\\b/]",
          message: "DS-TYPO-004: font-serif is forbidden. Use font-sans.",
        },
        {
          // ARCH-002: no supabase.auth.admin.* in client code
          selector: "MemberExpression[object.object.property.name='auth'][object.property.name='admin']",
          message: "ARCH-002: supabase.auth.admin.* is server-only. Move to an Edge Function.",
        },
        // ----------------------------------------------------------------
        // Wave 2 rules
        // ----------------------------------------------------------------
        // DS-COPY-001 — no ellipsis on Button labels
        {
          selector: "JSXElement[openingElement.name.name='Button'] > JSXText[value=/(?:\\.\\.\\.|\\u2026)\\s*$/]",
          message: "DS-COPY-001: no ellipsis on Button labels. Use a Spinner or loading state instead.",
        },
        // DS-COPY-002 — AlertDialog actions must name the outcome, not OK/Cancel
        {
          selector: "JSXElement[openingElement.name.name=/^AlertDialog(Action|Cancel)$/] > JSXText[value=/^\\s*(OK|Cancel)\\s*$/]",
          message: "DS-COPY-002: AlertDialog actions must name the outcome (e.g. 'Delete project', 'Keep project').",
        },
        // DS-RADIUS-003 — prefer rounded-lg over rounded-[var(--radius)]
        {
          selector: "Literal[value=/rounded-\\[var\\(--radius\\)\\]/]",
          message: "DS-RADIUS-003: prefer rounded-lg over rounded-[var(--radius)].",
        },
        {
          selector: "TemplateElement[value.raw=/rounded-\\[var\\(--radius\\)\\]/]",
          message: "DS-RADIUS-003: prefer rounded-lg over rounded-[var(--radius)].",
        },
        // DS-SHADOW-001 — use named shadow scale, not arbitrary shadow-[...]
        // (exceptions: src/components/ui/sidebar.tsx, src/components/audit/AutoCrawlThumbnailStrip.tsx
        //  are handled via a per-file override block below)
        {
          selector: "Literal[value=/\\bshadow-\\[/]",
          message: "DS-SHADOW-001: use named shadow scale (shadow-sm, shadow-md, shadow-lg, etc.).",
        },
        {
          selector: "TemplateElement[value.raw=/\\bshadow-\\[/]",
          message: "DS-SHADOW-001: use named shadow scale (shadow-sm, shadow-md, shadow-lg, etc.).",
        },
        // DS-PRIMITIVE-003 — no raw <input> for text-like types (hidden/file are allowed)
        {
          selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(hidden|file|checkbox|radio|submit|reset|button|image|range|color)$/]))",
          message: "DS-PRIMITIVE-003: use <Input> from ui/. Raw <input> is only allowed for type='hidden' or type='file'.",
        },
        // DS-COLOR-005 — --success / --success-foreground tokens are unmapped
        {
          selector: "Literal[value=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]",
          message: "DS-COLOR-005: --success token is unmapped. Use a score helper or a semantic color token.",
        },
        {
          selector: "TemplateElement[value.raw=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]",
          message: "DS-COLOR-005: --success token is unmapped. Use a score helper or a semantic color token.",
        },
        // NAV-002 — window.location for in-app navigation (posthog.ts is excluded below)
        {
          selector: "CallExpression[callee.object.object.name='window'][callee.object.property.name='location'][callee.property.name=/^(assign|replace)$/]",
          message: "NAV-002: use useNavigate() for in-app navigation instead of window.location.assign/replace.",
        },
        {
          selector: "AssignmentExpression[left.object.object.name='window'][left.object.property.name='location'][left.property.name='href']",
          message: "NAV-002: use useNavigate() for in-app navigation instead of window.location.href.",
        },
        // TYPE-002 — no `as any` casts
        {
          selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']",
          message: "TYPE-002: no `as any` casts. Use `as unknown as T` if you must cast.",
        },
        // SEC-003 — SUPABASE_SERVICE_ROLE_KEY must not appear in src/
        {
          selector: "Identifier[name='SUPABASE_SERVICE_ROLE_KEY']",
          message: "SEC-003: SUPABASE_SERVICE_ROLE_KEY is server-only. Never reference it in src/.",
        },
        {
          selector: "Literal[value='SUPABASE_SERVICE_ROLE_KEY']",
          message: "SEC-003: SUPABASE_SERVICE_ROLE_KEY is server-only. Never reference it in src/.",
        },
        // REACT-004 — no direct DOM manipulation (useRef + callback-ref are the React way)
        {
          selector: "CallExpression[callee.object.name='document'][callee.property.name=/^(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)$/]",
          message: "REACT-004: no direct DOM access. Use useRef or a callback-ref instead.",
        },
        {
          selector: "CallExpression[callee.property.name='appendChild']",
          message: "REACT-004: no .appendChild. Use React portals (createPortal) instead.",
        },
        {
          selector: "AssignmentExpression[left.object.property.name='style']",
          message: "REACT-004: no element.style mutation. Use className or CSS variables instead.",
        },
        // DATE-001 — no .toLocaleString / .toLocaleDateString / .toLocaleTimeString
        // (known false-positive: pure number.toLocaleString() also fires — accepted trade-off)
        {
          selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]",
          message: "DATE-001: use @/lib/dateFormat helpers instead of .toLocale*String().",
        },
        // ERR-001 — no empty .catch(() => {}) arrow
        {
          selector: "CallExpression[callee.property.name='catch'][arguments.0.type='ArrowFunctionExpression'][arguments.0.body.type='BlockStatement'][arguments.0.body.body.length=0]",
          message: "ERR-001: empty .catch arrow swallows errors. At minimum log or rethrow.",
        },
        // ENV-001 — no process.env in src/ (use import.meta.env)
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message: "ENV-001: use import.meta.env instead of process.env in Vite/browser code.",
        },
        // TW-IMPORTANT-001 — no !-prefixed Tailwind classes (use specificity or CSS variables)
        {
          selector: "Literal[value=/(?:^|\\s)![A-Za-z]/]",
          message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes. Increase specificity or use CSS variables instead.",
        },
        {
          selector: "TemplateElement[value.raw=/(?:^|\\s)![A-Za-z]/]",
          message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes. Increase specificity or use CSS variables instead.",
        },
        // QUERY-001 — query keys must come from @/lib/query-keys
        {
          selector: "CallExpression[callee.name='useQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child",
          message: "QUERY-001: inline query key literals. Import from @/lib/query-keys instead.",
        },
        {
          selector: "CallExpression[callee.name='useInfiniteQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child",
          message: "QUERY-001: inline query key literals. Import from @/lib/query-keys instead.",
        },
        {
          selector: "CallExpression[callee.name='useMutation'] > ObjectExpression > Property[key.name='mutationKey'] > ArrayExpression > Literal:first-child",
          message: "QUERY-001: inline mutation key literals. Import from @/lib/query-keys instead.",
        },
        // DS-SHADOW-002 — no ad-hoc box-shadow referencing --primary HSL (262 83%)
        // Catches inline style props like style={{ boxShadow: '0 0 0 3px hsl(262 83% ...)' }}
        {
          selector: "Property[key.name='boxShadow'] > Literal[value=/262\\s+83%/]",
          message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden. Use a named shadow token or CSS variable.",
        },
        {
          selector: "Property[key.name='boxShadow'] > TemplateLiteral > TemplateElement[value.raw=/262\\s+83%/]",
          message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden. Use a named shadow token or CSS variable.",
        },
        // ----------------------------------------------------------------
        // Wave 3b rules (Group C — global selectors; per-file exemptions via override blocks below)
        // ----------------------------------------------------------------
        // DS-COLOR-006 — auth-form-* tokens are only allowed in src/pages/Auth.tsx.
        // Override block for Auth.tsx below omits this selector.
        {
          selector: "Literal[value=/\\bauth-form-/]",
          message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only.",
        },
        {
          selector: "TemplateElement[value.raw=/\\bauth-form-/]",
          message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only.",
        },
        // DS-COLOR-007 — sidebar-* tokens are only allowed in the sidebar tree.
        // sidebar.tsx override block below omits this selector.
        {
          selector: "Literal[value=/\\bsidebar-/]",
          message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only.",
        },
        {
          selector: "TemplateElement[value.raw=/\\bsidebar-/]",
          message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only.",
        },
        // DATE-002 — Intl.DateTimeFormat allowed only in src/lib/dateFormat.ts.
        // Override block for dateFormat.ts below omits this selector.
        {
          selector: "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']",
          message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts. Use the canonical helpers exported from @/lib/dateFormat.",
        },
        {
          selector: "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']",
          message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts. Use the canonical helpers exported from @/lib/dateFormat.",
        },
        // QUERY-003 — invalidate by factory key, not array literal
        {
          selector: "CallExpression[callee.property.name='invalidateQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child",
          message: "QUERY-003: use query-key factory (e.g. queryKeys.audits()) not inline array literals for invalidation.",
        },
        {
          selector: "CallExpression[callee.property.name='setQueryData'] > ArrayExpression > Literal:first-child",
          message: "QUERY-003: use query-key factory not inline array literal for setQueryData.",
        },
        {
          selector: "CallExpression[callee.property.name='getQueryData'] > ArrayExpression > Literal:first-child",
          message: "QUERY-003: use query-key factory not inline array literal for getQueryData.",
        },
        {
          selector: "CallExpression[callee.property.name='removeQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child",
          message: "QUERY-003: use query-key factory not inline array literal for removeQueries.",
        },
      ],
      // --- Wave 1: typescript-eslint rules at warn (phased rollout) ---
      // TYPE-001
      "@typescript-eslint/no-explicit-any": "warn",
      // TYPE-003
      "@typescript-eslint/no-non-null-assertion": "warn",
      // --- Wave 2: TYPE-004 — prefer @ts-expect-error over @ts-ignore ---
      "@typescript-eslint/ban-ts-comment": ["warn", {
        "ts-ignore": true,
        "ts-expect-error": false,
        "ts-nocheck": true,
        "ts-check": false,
      }],
      // --- Wave 2: ASYNC-002 — async without await is almost always a mistake ---
      "require-await": "warn",
      // --- Wave 2: ERR-001 (first half) — no empty catch blocks ---
      "no-empty": ["warn", { allowEmptyCatch: false }],
      // --- Wave 2: ERR-002 — no console.log in src/ ---
      // console.warn, console.error, console.info are allowed for intentional logging.
      // src/main.tsx is excluded via a per-file override block below.
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      // ----------------------------------------------------------------
      // Wave 3a — Group B: eslint-plugin-react rules
      // ----------------------------------------------------------------
      // DS-PRIMITIVE-001/002/004/005/006 — forbid raw HTML elements that have
      // DS-approved counterparts in ui/. src/components/ui/** and figma-plugin/**
      // are exempted via the override block at the bottom of this file.
      "react/forbid-elements": ["warn", {
        forbid: [
          { element: "button",   message: "DS-PRIMITIVE-001: use <Button> from ui/." },
          { element: "select",   message: "DS-PRIMITIVE-002: use <Select> from ui/." },
          { element: "option",   message: "DS-PRIMITIVE-002: use <Select>/<SelectItem> from ui/." },
          { element: "textarea", message: "DS-PRIMITIVE-004: use <Textarea> from ui/." },
          { element: "table",    message: "DS-PRIMITIVE-005: use <Table> from ui/." },
          { element: "dialog",   message: "DS-PRIMITIVE-006: use <Dialog> from ui/." },
        ],
      }],
      // REACT-003 — no unstable nested component definitions (re-creates on every render).
      // allowAsProps: true permits render-prop patterns (e.g. renderHeader={() => <X />}).
      "react/no-unstable-nested-components": ["warn", { allowAsProps: true }],
      // SEC-002 — raw innerHTML prop is XSS-prone; flag for review.
      // Zero violations on first wire → promoted to error.
      "react/no-danger": "error",
      // SEC-005 — external target="_blank" without rel="noreferrer noopener" is a
      // reverse-tabnapping vector.
      // Zero violations on first wire → promoted to error.
      "react/jsx-no-target-blank": ["error", { allowReferrer: false, enforceDynamicLinks: "always" }],
    },
  },
  // Supabase Edge Functions run in Deno — relax rules that don't apply there
  {
    files: ["supabase/functions/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-control-regex": "off",
      // ARCH-002 forbids supabase.auth.admin.* in CLIENT code — Edge Functions
      // are exactly where this API belongs. Re-declare no-restricted-syntax
      // without the ARCH-002 selector so the rest of the patterns still apply.
      // ENV-001 also doesn't apply (Edge Functions use Deno.env.get).
      "no-restricted-syntax": ["warn",
        {
          selector: "Literal[value=/\\bfont-\\[/]",
          message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono.",
        },
        {
          selector: "TemplateElement[value.raw=/\\bfont-\\[/]",
          message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono.",
        },
        {
          selector: "Literal[value=/\\bfont-serif\\b/]",
          message: "DS-TYPO-004: font-serif is forbidden. Use font-sans.",
        },
        {
          selector: "TemplateElement[value.raw=/\\bfont-serif\\b/]",
          message: "DS-TYPO-004: font-serif is forbidden. Use font-sans.",
        },
        // --- Wave 2 rules applicable to Edge Functions ---
        // TYPE-002 — no `as any` casts
        {
          selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']",
          message: "TYPE-002: no `as any` casts. Use `as unknown as T` if you must cast.",
        },
        // ERR-001 — no empty .catch arrows
        {
          selector: "CallExpression[callee.property.name='catch'][arguments.0.type='ArrowFunctionExpression'][arguments.0.body.type='BlockStatement'][arguments.0.body.body.length=0]",
          message: "ERR-001: empty .catch arrow swallows errors. At minimum log or rethrow.",
        },
        // ARCH-008 — gemini model name must be imported from _shared/
        // (scoped to supabase/functions/** via this block; _shared/ is excluded by the override below)
        {
          selector: "Literal[value=/^gemini-[a-z0-9.-]+$/]",
          message: "ARCH-008: import the Gemini model name from supabase/functions/_shared/ instead of hardcoding it.",
        },
        // --- Wave 3b: ENV-002 — Edge Functions must use Deno.env.get(), not process.env ---
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message: "ENV-002: Edge Functions run on Deno — use Deno.env.get('KEY') instead of process.env.",
        },
      ],
    },
  },
  // ARCH-008 exception: _shared/ IS where the canonical model name lives
  {
    files: ["supabase/functions/_shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Wave 4: `console.log` is the legitimate output mechanism for CLI tools (scripts/)
  // and Deno Edge Functions (no Pino/Winston in Deno runtime). Turn off no-console
  // there; src/, e2e/, and figma-plugin/ keep the rule.
  {
    files: ["scripts/**/*.{ts,tsx,mjs,js}", "supabase/functions/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
    },
  },
  // Wave 4: scripts/ and *.config.ts run in Node — `process.env` is correct there,
  // not `import.meta.env`. ENV-001 doesn't apply. We turn off the whole rule rather
  // than carry forward 30+ unrelated selectors; the trade-off is that minor checks
  // (TYPE-002 `as any`, ERR-001 empty catch) aren't enforced in build/CI tooling,
  // which is acceptable for non-runtime code.
  {
    files: ["scripts/**/*.{ts,tsx,mjs,js}", "*.config.{ts,js,mjs}"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Wave 4: figma-plugin has no `@/` alias configured (separate sub-project, separate
  // tsconfig). The IMPORT-001 `../../` ban does not apply to its tests/UI internals.
  {
    files: ["figma-plugin/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Wave 4: figma-plugin/code.ts runs in the Figma sandbox VM, not the browser.
  // `.appendChild` on Figma nodes is the canonical API (not React's DOM); `figma.ui.show()`
  // etc. are not React lifecycle. REACT-004 selectors do not apply.
  {
    files: ["figma-plugin/src/code.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // shadcn/ui primitives — auto-generated, empty interface pattern is intentional
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  // Context files intentionally co-export provider component + hook — fast-refresh warning is expected
  {
    files: ["src/contexts/**/*.{ts,tsx}", "figma-plugin/src/ui/components/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // ARCH-005 / ARCH-006 — services are framework-agnostic.
  // Forbid React, React Query, components, pages, contexts in src/services/**.
  // NOTE: services legitimately own DB I/O per ARCH-001 — the supabase client
  // import is INTENTIONALLY allowed here. The global ARCH-001 ban applies only
  // to src/components/** and src/pages/**.
  {
    files: ["src/services/**/*.ts"],
    rules: {
      "no-restricted-imports": ["warn", {
        patterns: [
          {
            group: ["@tanstack/react-query"],
            message:
              "ARCH-005: Services are framework-agnostic — no @tanstack/react-query. Wrap the service call in a hook under src/hooks/.",
          },
          {
            group: ["react", "@/components/*", "@/pages/*", "@/contexts/*"],
            message:
              "ARCH-006: Services must not import React or app-layer modules (components/pages/contexts). Move React-dependent code to a hook.",
          },
          // Wave 2: carry forward IMPORT-001 + DS-PRIMITIVE-011 for services too
          {
            regex: "^\\.\\./\\.\\./",
            message: "IMPORT-001: use @/ alias instead of deep relative imports (../../).",
          },
          {
            group: ["react-icons", "react-icons/*", "@heroicons/*", "@radix-ui/react-icons"],
            message: "DS-PRIMITIVE-011: Lucide is the only icon library. Use lucide-react.",
          },
        ],
        paths: [
          { name: "@/components/ui/toast", message: "IMPORT-004: legacy toast — use sonner." },
          { name: "@/components/ui/use-toast", message: "IMPORT-004: legacy toast — use sonner." },
          { name: "@/hooks/use-toast", message: "IMPORT-004: legacy toast — use sonner." },
        ],
      }],
    },
  },
  // --- Wave 2: ARCH-004 — hooks MUST NOT call supabase.from() directly ---
  // Services own DB I/O; hooks orchestrate services.
  {
    files: ["src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error",
        {
          selector: "CallExpression[callee.object.name='supabase'][callee.property.name='from']",
          message: "ARCH-004: hooks must not call supabase.from() directly. Delegate to a service in src/services/.",
        },
      ],
    },
  },
  // --- Wave 2: ARCH-007 — figma-plugin sandbox cannot import from ui/ ---
  {
    files: ["figma-plugin/src/code.ts", "figma-plugin/src/**/*.ts"],
    ignores: ["figma-plugin/src/ui/**", "figma-plugin/src/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["**/ui/*", "**/ui/**"],
            message: "ARCH-007: figma sandbox (code.ts) cannot import from ui/ — separate runtimes.",
          },
        ],
      }],
    },
  },
  // --- Wave 2: DS-SHADOW-001 exception for AutoCrawlThumbnailStrip.tsx ---
  // This file has a documented ad-hoc shadow recipe. DS-COLOR-007 applies (it's not a sidebar file).
  {
    files: ["src/components/audit/AutoCrawlThumbnailStrip.tsx"],
    rules: {
      // Override no-restricted-syntax to remove DS-SHADOW-001 patterns only
      // (flat-config: this block replaces the global one for this file)
      "no-restricted-syntax": ["warn",
        // Wave 1 (keep)
        { selector: "Literal[value=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "TemplateElement[value.raw=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "Literal[value=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "TemplateElement[value.raw=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "MemberExpression[object.object.property.name='auth'][object.property.name='admin']", message: "ARCH-002: supabase.auth.admin.* is server-only. Move to an Edge Function." },
        // Wave 2 (keep — DS-SHADOW-001 intentionally omitted)
        { selector: "JSXElement[openingElement.name.name='Button'] > JSXText[value=/(?:\\.\\.\\.|\\u2026)\\s*$/]", message: "DS-COPY-001: no ellipsis on Button labels." },
        { selector: "JSXElement[openingElement.name.name=/^AlertDialog(Action|Cancel)$/] > JSXText[value=/^\\s*(OK|Cancel)\\s*$/]", message: "DS-COPY-002: name the outcome." },
        { selector: "Literal[value=/rounded-\\[var\\(--radius\\)\\]/]", message: "DS-RADIUS-003: prefer rounded-lg." },
        { selector: "TemplateElement[value.raw=/rounded-\\[var\\(--radius\\)\\]/]", message: "DS-RADIUS-003: prefer rounded-lg." },
        { selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(hidden|file|checkbox|radio|submit|reset|button|image|range|color)$/]))", message: "DS-PRIMITIVE-003: use <Input> from ui/." },
        { selector: "Literal[value=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]", message: "DS-COLOR-005: --success token is unmapped." },
        { selector: "TemplateElement[value.raw=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]", message: "DS-COLOR-005: --success token is unmapped." },
        { selector: "CallExpression[callee.object.object.name='window'][callee.object.property.name='location'][callee.property.name=/^(assign|replace)$/]", message: "NAV-002: use useNavigate()." },
        { selector: "AssignmentExpression[left.object.object.name='window'][left.object.property.name='location'][left.property.name='href']", message: "NAV-002: use useNavigate()." },
        { selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']", message: "TYPE-002: no `as any` casts." },
        { selector: "Identifier[name='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "Literal[value='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)$/]", message: "REACT-004: no direct DOM access." },
        { selector: "CallExpression[callee.property.name='appendChild']", message: "REACT-004: no .appendChild." },
        { selector: "AssignmentExpression[left.object.property.name='style']", message: "REACT-004: no element.style mutation." },
        { selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]", message: "DATE-001: use @/lib/dateFormat helpers." },
        { selector: "CallExpression[callee.property.name='catch'][arguments.0.type='ArrowFunctionExpression'][arguments.0.body.type='BlockStatement'][arguments.0.body.body.length=0]", message: "ERR-001: empty .catch arrow swallows errors." },
        { selector: "MemberExpression[object.object.name='process'][object.property.name='env']", message: "ENV-001: use import.meta.env." },
        { selector: "Literal[value=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes." },
        { selector: "TemplateElement[value.raw=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes." },
        { selector: "CallExpression[callee.name='useQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.name='useInfiniteQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.name='useMutation'] > ObjectExpression > Property[key.name='mutationKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.property.name='invalidateQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='setQueryData'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='getQueryData'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='removeQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        // Wave 3b (keep all — this file is not in the sidebar tree, DS-COLOR-007 applies)
        { selector: "Property[key.name='boxShadow'] > Literal[value=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Property[key.name='boxShadow'] > TemplateLiteral > TemplateElement[value.raw=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Literal[value=/\\bauth-form-/]", message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only." },
        { selector: "TemplateElement[value.raw=/\\bauth-form-/]", message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only." },
        { selector: "Literal[value=/\\bsidebar-/]", message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only." },
        { selector: "TemplateElement[value.raw=/\\bsidebar-/]", message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only." },
        { selector: "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
        { selector: "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
      ],
    },
  },
  // --- Wave 2/3b: DS-SHADOW-001 exception for sidebar.tsx + DS-COLOR-007 exemption ---
  // sidebar.tsx has a documented ad-hoc shadow recipe AND is the canonical home of sidebar tokens.
  {
    files: ["src/components/ui/sidebar.tsx"],
    rules: {
      // Override no-restricted-syntax to remove DS-SHADOW-001 AND DS-COLOR-007 (sidebar IS the sidebar tree)
      // (flat-config: this block replaces the global one for this file)
      "no-restricted-syntax": ["warn",
        // Wave 1 (keep)
        { selector: "Literal[value=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "TemplateElement[value.raw=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "Literal[value=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "TemplateElement[value.raw=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "MemberExpression[object.object.property.name='auth'][object.property.name='admin']", message: "ARCH-002: supabase.auth.admin.* is server-only. Move to an Edge Function." },
        // Wave 2 (keep — DS-SHADOW-001 intentionally omitted)
        { selector: "JSXElement[openingElement.name.name='Button'] > JSXText[value=/(?:\\.\\.\\.|\\u2026)\\s*$/]", message: "DS-COPY-001: no ellipsis on Button labels." },
        { selector: "JSXElement[openingElement.name.name=/^AlertDialog(Action|Cancel)$/] > JSXText[value=/^\\s*(OK|Cancel)\\s*$/]", message: "DS-COPY-002: name the outcome." },
        { selector: "Literal[value=/rounded-\\[var\\(--radius\\)\\]/]", message: "DS-RADIUS-003: prefer rounded-lg." },
        { selector: "TemplateElement[value.raw=/rounded-\\[var\\(--radius\\)\\]/]", message: "DS-RADIUS-003: prefer rounded-lg." },
        { selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(hidden|file|checkbox|radio|submit|reset|button|image|range|color)$/]))", message: "DS-PRIMITIVE-003: use <Input> from ui/." },
        { selector: "Literal[value=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]", message: "DS-COLOR-005: --success token is unmapped." },
        { selector: "TemplateElement[value.raw=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]", message: "DS-COLOR-005: --success token is unmapped." },
        { selector: "CallExpression[callee.object.object.name='window'][callee.object.property.name='location'][callee.property.name=/^(assign|replace)$/]", message: "NAV-002: use useNavigate()." },
        { selector: "AssignmentExpression[left.object.object.name='window'][left.object.property.name='location'][left.property.name='href']", message: "NAV-002: use useNavigate()." },
        { selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']", message: "TYPE-002: no `as any` casts." },
        { selector: "Identifier[name='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "Literal[value='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)$/]", message: "REACT-004: no direct DOM access." },
        { selector: "CallExpression[callee.property.name='appendChild']", message: "REACT-004: no .appendChild." },
        { selector: "AssignmentExpression[left.object.property.name='style']", message: "REACT-004: no element.style mutation." },
        { selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]", message: "DATE-001: use @/lib/dateFormat helpers." },
        { selector: "CallExpression[callee.property.name='catch'][arguments.0.type='ArrowFunctionExpression'][arguments.0.body.type='BlockStatement'][arguments.0.body.body.length=0]", message: "ERR-001: empty .catch arrow swallows errors." },
        { selector: "MemberExpression[object.object.name='process'][object.property.name='env']", message: "ENV-001: use import.meta.env." },
        { selector: "Literal[value=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes." },
        { selector: "TemplateElement[value.raw=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes." },
        { selector: "CallExpression[callee.name='useQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.name='useInfiniteQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.name='useMutation'] > ObjectExpression > Property[key.name='mutationKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.property.name='invalidateQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='setQueryData'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='getQueryData'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='removeQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        // Wave 3b — DS-SHADOW-001 and DS-COLOR-007 intentionally omitted (sidebar is the canonical home)
        { selector: "Property[key.name='boxShadow'] > Literal[value=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Property[key.name='boxShadow'] > TemplateLiteral > TemplateElement[value.raw=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Literal[value=/\\bauth-form-/]", message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only." },
        { selector: "TemplateElement[value.raw=/\\bauth-form-/]", message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only." },
        // DS-COLOR-007 intentionally omitted — sidebar.tsx IS the canonical sidebar tree
        { selector: "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
        { selector: "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
      ],
    },
  },
  // --- Wave 2: NAV-002 exception — posthog.ts uses window.location for external redirects ---
  {
    files: ["src/lib/posthog.ts"],
    rules: {
      "no-restricted-syntax": ["warn",
        // Wave 1 (keep)
        { selector: "Literal[value=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family." },
        { selector: "TemplateElement[value.raw=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family." },
        { selector: "Literal[value=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden." },
        { selector: "TemplateElement[value.raw=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden." },
        { selector: "MemberExpression[object.object.property.name='auth'][object.property.name='admin']", message: "ARCH-002: server-only." },
        // Wave 2 (keep — NAV-002 intentionally omitted for posthog external redirects)
        { selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']", message: "TYPE-002: no `as any` casts." },
        { selector: "Identifier[name='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "Literal[value='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)$/]", message: "REACT-004: no direct DOM access." },
        { selector: "CallExpression[callee.property.name='appendChild']", message: "REACT-004: no .appendChild." },
        { selector: "AssignmentExpression[left.object.property.name='style']", message: "REACT-004: no element.style mutation." },
        { selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]", message: "DATE-001: use @/lib/dateFormat helpers." },
        { selector: "CallExpression[callee.property.name='catch'][arguments.0.type='ArrowFunctionExpression'][arguments.0.body.type='BlockStatement'][arguments.0.body.body.length=0]", message: "ERR-001: empty .catch arrow." },
        { selector: "MemberExpression[object.object.name='process'][object.property.name='env']", message: "ENV-001: use import.meta.env." },
        { selector: "Literal[value=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed classes." },
        { selector: "TemplateElement[value.raw=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed classes." },
        // Wave 3b (keep — NAV-002 remains omitted for posthog external redirects)
        { selector: "Property[key.name='boxShadow'] > Literal[value=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Property[key.name='boxShadow'] > TemplateLiteral > TemplateElement[value.raw=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Literal[value=/\\bauth-form-/]", message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only." },
        { selector: "TemplateElement[value.raw=/\\bauth-form-/]", message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only." },
        { selector: "Literal[value=/\\bsidebar-/]", message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only." },
        { selector: "TemplateElement[value.raw=/\\bsidebar-/]", message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only." },
        { selector: "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
        { selector: "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
      ],
    },
  },
  // --- Wave 2: ERR-002 exception — src/main.tsx bootstrapping uses console.log ---
  {
    files: ["src/main.tsx"],
    rules: {
      "no-console": "off",
    },
  },
  // --- Wave 3a: DS-PRIMITIVE-001/002/004/005/006 exceptions ---
  // The ui/ primitives themselves use raw HTML elements — that is intentional.
  // figma-plugin/ has its own design system and does not use shadcn primitives.
  {
    files: ["src/components/ui/**/*.{ts,tsx}", "figma-plugin/**/*.{ts,tsx}"],
    rules: {
      "react/forbid-elements": "off",
    },
  },
  // --- Wave 3a: DS-PRIMITIVE-007 exception ---
  // src/components/ui/form.tsx is the one legitimate consumer of react-hook-form
  // Controller directly — it wraps it into the <FormField> abstraction the rest
  // of the codebase must use.
  {
    files: ["src/components/ui/form.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // -----------------------------------------------------------------------
  // Wave 3b — Group C rules
  // -----------------------------------------------------------------------
  // NOTE on flat-config semantics: no-restricted-syntax and no-restricted-imports are
  // REPLACED (not merged) when a later config block matches the same file.
  // Per-file exemptions therefore use dedicated override blocks that re-declare all
  // global selectors MINUS the exempted one — same pattern as Wave 2 sidebar override.

  // DS-COLOR-006 exemption — Auth.tsx IS the canonical home of auth-form tokens.
  // All global selectors are carried forward; DS-COLOR-006 is intentionally omitted.
  {
    files: ["src/pages/Auth.tsx"],
    rules: {
      "no-restricted-syntax": ["warn",
        // Wave 1 (keep)
        { selector: "Literal[value=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "TemplateElement[value.raw=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "Literal[value=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "TemplateElement[value.raw=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "MemberExpression[object.object.property.name='auth'][object.property.name='admin']", message: "ARCH-002: supabase.auth.admin.* is server-only. Move to an Edge Function." },
        // Wave 2 (keep)
        { selector: "JSXElement[openingElement.name.name='Button'] > JSXText[value=/(?:\\.\\.\\.|\\u2026)\\s*$/]", message: "DS-COPY-001: no ellipsis on Button labels." },
        { selector: "JSXElement[openingElement.name.name=/^AlertDialog(Action|Cancel)$/] > JSXText[value=/^\\s*(OK|Cancel)\\s*$/]", message: "DS-COPY-002: name the outcome." },
        { selector: "Literal[value=/rounded-\\[var\\(--radius\\)\\]/]", message: "DS-RADIUS-003: prefer rounded-lg." },
        { selector: "TemplateElement[value.raw=/rounded-\\[var\\(--radius\\)\\]/]", message: "DS-RADIUS-003: prefer rounded-lg." },
        { selector: "Literal[value=/\\bshadow-\\[/]", message: "DS-SHADOW-001: use named shadow scale." },
        { selector: "TemplateElement[value.raw=/\\bshadow-\\[/]", message: "DS-SHADOW-001: use named shadow scale." },
        { selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(hidden|file|checkbox|radio|submit|reset|button|image|range|color)$/]))", message: "DS-PRIMITIVE-003: use <Input> from ui/." },
        { selector: "Literal[value=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]", message: "DS-COLOR-005: --success token is unmapped." },
        { selector: "TemplateElement[value.raw=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]", message: "DS-COLOR-005: --success token is unmapped." },
        { selector: "CallExpression[callee.object.object.name='window'][callee.object.property.name='location'][callee.property.name=/^(assign|replace)$/]", message: "NAV-002: use useNavigate()." },
        { selector: "AssignmentExpression[left.object.object.name='window'][left.object.property.name='location'][left.property.name='href']", message: "NAV-002: use useNavigate()." },
        { selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']", message: "TYPE-002: no `as any` casts." },
        { selector: "Identifier[name='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "Literal[value='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)$/]", message: "REACT-004: no direct DOM access." },
        { selector: "CallExpression[callee.property.name='appendChild']", message: "REACT-004: no .appendChild." },
        { selector: "AssignmentExpression[left.object.property.name='style']", message: "REACT-004: no element.style mutation." },
        { selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]", message: "DATE-001: use @/lib/dateFormat helpers." },
        { selector: "CallExpression[callee.property.name='catch'][arguments.0.type='ArrowFunctionExpression'][arguments.0.body.type='BlockStatement'][arguments.0.body.body.length=0]", message: "ERR-001: empty .catch arrow swallows errors." },
        { selector: "MemberExpression[object.object.name='process'][object.property.name='env']", message: "ENV-001: use import.meta.env." },
        { selector: "Literal[value=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes." },
        { selector: "TemplateElement[value.raw=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes." },
        { selector: "CallExpression[callee.name='useQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.name='useInfiniteQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.name='useMutation'] > ObjectExpression > Property[key.name='mutationKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.property.name='invalidateQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='setQueryData'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='getQueryData'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='removeQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        // Wave 3b (keep — DS-COLOR-006 intentionally omitted; Auth.tsx IS the canonical auth-form home)
        { selector: "Property[key.name='boxShadow'] > Literal[value=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Property[key.name='boxShadow'] > TemplateLiteral > TemplateElement[value.raw=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Literal[value=/\\bsidebar-/]", message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only." },
        { selector: "TemplateElement[value.raw=/\\bsidebar-/]", message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only." },
        { selector: "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
        { selector: "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
      ],
    },
  },

  // DATE-002 exemption — src/lib/dateFormat.ts IS where Intl.DateTimeFormat belongs.
  // All global selectors are carried forward; DATE-002 is intentionally omitted.
  {
    files: ["src/lib/dateFormat.ts"],
    rules: {
      "no-restricted-syntax": ["warn",
        // Wave 1 (keep)
        { selector: "Literal[value=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "TemplateElement[value.raw=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "Literal[value=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "TemplateElement[value.raw=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "MemberExpression[object.object.property.name='auth'][object.property.name='admin']", message: "ARCH-002: supabase.auth.admin.* is server-only. Move to an Edge Function." },
        // Wave 2 (keep)
        { selector: "JSXElement[openingElement.name.name='Button'] > JSXText[value=/(?:\\.\\.\\.|\\u2026)\\s*$/]", message: "DS-COPY-001: no ellipsis on Button labels." },
        { selector: "JSXElement[openingElement.name.name=/^AlertDialog(Action|Cancel)$/] > JSXText[value=/^\\s*(OK|Cancel)\\s*$/]", message: "DS-COPY-002: name the outcome." },
        { selector: "Literal[value=/rounded-\\[var\\(--radius\\)\\]/]", message: "DS-RADIUS-003: prefer rounded-lg." },
        { selector: "TemplateElement[value.raw=/rounded-\\[var\\(--radius\\)\\]/]", message: "DS-RADIUS-003: prefer rounded-lg." },
        { selector: "Literal[value=/\\bshadow-\\[/]", message: "DS-SHADOW-001: use named shadow scale." },
        { selector: "TemplateElement[value.raw=/\\bshadow-\\[/]", message: "DS-SHADOW-001: use named shadow scale." },
        { selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(hidden|file|checkbox|radio|submit|reset|button|image|range|color)$/]))", message: "DS-PRIMITIVE-003: use <Input> from ui/." },
        { selector: "Literal[value=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]", message: "DS-COLOR-005: --success token is unmapped." },
        { selector: "TemplateElement[value.raw=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]", message: "DS-COLOR-005: --success token is unmapped." },
        { selector: "CallExpression[callee.object.object.name='window'][callee.object.property.name='location'][callee.property.name=/^(assign|replace)$/]", message: "NAV-002: use useNavigate()." },
        { selector: "AssignmentExpression[left.object.object.name='window'][left.object.property.name='location'][left.property.name='href']", message: "NAV-002: use useNavigate()." },
        { selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']", message: "TYPE-002: no `as any` casts." },
        { selector: "Identifier[name='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "Literal[value='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)$/]", message: "REACT-004: no direct DOM access." },
        { selector: "CallExpression[callee.property.name='appendChild']", message: "REACT-004: no .appendChild." },
        { selector: "AssignmentExpression[left.object.property.name='style']", message: "REACT-004: no element.style mutation." },
        { selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]", message: "DATE-001: use @/lib/dateFormat helpers." },
        { selector: "CallExpression[callee.property.name='catch'][arguments.0.type='ArrowFunctionExpression'][arguments.0.body.type='BlockStatement'][arguments.0.body.body.length=0]", message: "ERR-001: empty .catch arrow swallows errors." },
        { selector: "MemberExpression[object.object.name='process'][object.property.name='env']", message: "ENV-001: use import.meta.env." },
        { selector: "Literal[value=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes." },
        { selector: "TemplateElement[value.raw=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes." },
        { selector: "CallExpression[callee.name='useQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.name='useInfiniteQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.name='useMutation'] > ObjectExpression > Property[key.name='mutationKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.property.name='invalidateQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='setQueryData'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='getQueryData'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='removeQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        // Wave 3b (keep — DATE-002 intentionally omitted; dateFormat.ts IS the canonical helper)
        { selector: "Property[key.name='boxShadow'] > Literal[value=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Property[key.name='boxShadow'] > TemplateLiteral > TemplateElement[value.raw=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Literal[value=/\\bauth-form-/]", message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only." },
        { selector: "TemplateElement[value.raw=/\\bauth-form-/]", message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only." },
        { selector: "Literal[value=/\\bsidebar-/]", message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only." },
        { selector: "TemplateElement[value.raw=/\\bsidebar-/]", message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only." },
      ],
    },
  },

  // IMPORT-003 — ui/ primitives must not import upward into app layers.
  // Scoped via flat-config files to src/components/ui/** only.
  // NOTE on flat-config: no-restricted-imports is REPLACED (not merged) per file scope.
  // All global no-restricted-imports patterns are carried forward here.
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["warn", {
        patterns: [
          // --- Carry-forward: global patterns (ARCH-001, IMPORT-001, IMPORT-002, DS-PRIMITIVE-011) ---
          {
            group: ["@/integrations/supabase/client"],
            message: "ARCH-001: Components and pages must not import the supabase client directly. Use a hook from src/hooks/ or a service from src/services/.",
          },
          {
            regex: "^\\.\\./\\.\\./",
            message: "IMPORT-001: use @/ alias instead of deep relative imports (../../).",
          },
          {
            group: ["@/figma-plugin/*", "**/figma-plugin/**"],
            message: "IMPORT-002: src/ and figma-plugin/src/ are separate apps — no cross-imports.",
          },
          {
            group: ["react-icons", "react-icons/*", "@heroicons/*", "@radix-ui/react-icons"],
            message: "DS-PRIMITIVE-011: Lucide is the only icon library. Use lucide-react.",
          },
          // --- IMPORT-003: ui/ leaf layer cannot depend on app layers ---
          {
            group: ["@/hooks/**"],
            message: "IMPORT-003: ui/ primitives must not import from hooks/. Keep ui/ framework-agnostic.",
          },
          {
            group: ["@/services/**"],
            message: "IMPORT-003: ui/ primitives must not import from services/. Keep ui/ framework-agnostic.",
          },
          {
            group: ["@/pages/**"],
            message: "IMPORT-003: ui/ primitives must not import from pages/. Keep ui/ framework-agnostic.",
          },
          {
            group: ["@/contexts/**"],
            message: "IMPORT-003: ui/ primitives must not import from contexts/. Keep ui/ framework-agnostic.",
          },
        ],
        paths: [
          // --- Carry-forward: IMPORT-004 legacy toast ---
          { name: "@/components/ui/toast", message: "IMPORT-004: legacy toast — use sonner." },
          { name: "@/components/ui/use-toast", message: "IMPORT-004: legacy toast — use sonner." },
          { name: "@/hooks/use-toast", message: "IMPORT-004: legacy toast — use sonner." },
        ],
      }],
    },
  },

  // I18N-005 — do not import a domain translation file directly.
  // Only import from the barrel index: @/utils/translations (without a sub-path).
  // Scope: all src/** EXCEPT src/utils/translations/ itself (which assembles the barrel).
  // NOTE on flat-config: no-restricted-imports is REPLACED per scope; global patterns carried forward.
  {
    files: ["src/**/*.{ts,tsx}"],
    // services/** and components/ui/** have their own no-restricted-imports overrides
    // that we must not clobber (flat-config replacement semantics).
    ignores: ["src/utils/translations/**", "src/services/**", "src/components/ui/**"],
    rules: {
      "no-restricted-imports": ["warn", {
        patterns: [
          // --- Carry-forward: global patterns ---
          {
            group: ["@/integrations/supabase/client"],
            message: "ARCH-001: Components and pages must not import the supabase client directly. Use a hook from src/hooks/ or a service from src/services/.",
          },
          {
            regex: "^\\.\\./\\.\\./",
            message: "IMPORT-001: use @/ alias instead of deep relative imports (../../).",
          },
          {
            group: ["@/figma-plugin/*", "**/figma-plugin/**"],
            message: "IMPORT-002: src/ and figma-plugin/src/ are separate apps — no cross-imports.",
          },
          {
            group: ["react-icons", "react-icons/*", "@heroicons/*", "@radix-ui/react-icons"],
            message: "DS-PRIMITIVE-011: Lucide is the only icon library. Use lucide-react.",
          },
          // --- I18N-005: domain translation files must come through the barrel index ---
          {
            group: ["@/utils/translations/*"],
            message: "I18N-005: import from @/utils/translations (the barrel index), not directly from domain files.",
          },
        ],
        paths: [
          // --- Carry-forward: IMPORT-004 legacy toast ---
          { name: "@/components/ui/toast", message: "IMPORT-004: legacy toast — use sonner." },
          { name: "@/components/ui/use-toast", message: "IMPORT-004: legacy toast — use sonner." },
          { name: "@/hooks/use-toast", message: "IMPORT-004: legacy toast — use sonner." },
        ],
      }],
    },
  },

  // DS-COLOR-006 + DS-COLOR-007 exemption — tailwind.config.ts defines the token names.
  // The definitions of "auth-form-*" and "sidebar-*" are legitimate here.
  {
    files: ["tailwind.config.ts"],
    rules: {
      "no-restricted-syntax": ["warn",
        // Wave 1 (keep)
        { selector: "Literal[value=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "TemplateElement[value.raw=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "Literal[value=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "TemplateElement[value.raw=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "MemberExpression[object.object.property.name='auth'][object.property.name='admin']", message: "ARCH-002: supabase.auth.admin.* is server-only. Move to an Edge Function." },
        // Wave 2 (keep)
        { selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']", message: "TYPE-002: no `as any` casts." },
        { selector: "Identifier[name='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "Literal[value='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "MemberExpression[object.object.name='process'][object.property.name='env']", message: "ENV-001: use import.meta.env." },
        // Wave 3b — DS-COLOR-006 and DS-COLOR-007 intentionally omitted
        // (tailwind.config.ts IS the canonical token definition file)
        { selector: "Property[key.name='boxShadow'] > Literal[value=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Property[key.name='boxShadow'] > TemplateLiteral > TemplateElement[value.raw=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
        { selector: "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
      ],
    },
  },

  // TEST-003 — tests must target localhost:8080, not the production URL.
  // Scoped to e2e/ and src/test/ only. Global no-restricted-syntax selectors are carried forward
  // so e2e tests keep all other rules (REACT-004 etc.) — flat-config replacement semantics.
  {
    files: ["e2e/**/*.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["warn",
        // Wave 1 (keep)
        { selector: "Literal[value=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "TemplateElement[value.raw=/\\bfont-\\[/]", message: "DS-TYPO-003: No arbitrary font-family. Use font-sans or font-mono." },
        { selector: "Literal[value=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "TemplateElement[value.raw=/\\bfont-serif\\b/]", message: "DS-TYPO-004: font-serif is forbidden. Use font-sans." },
        { selector: "MemberExpression[object.object.property.name='auth'][object.property.name='admin']", message: "ARCH-002: supabase.auth.admin.* is server-only. Move to an Edge Function." },
        // Wave 2 (keep)
        { selector: "JSXElement[openingElement.name.name='Button'] > JSXText[value=/(?:\\.\\.\\.|\\u2026)\\s*$/]", message: "DS-COPY-001: no ellipsis on Button labels." },
        { selector: "JSXElement[openingElement.name.name=/^AlertDialog(Action|Cancel)$/] > JSXText[value=/^\\s*(OK|Cancel)\\s*$/]", message: "DS-COPY-002: name the outcome." },
        { selector: "Literal[value=/rounded-\\[var\\(--radius\\)\\]/]", message: "DS-RADIUS-003: prefer rounded-lg." },
        { selector: "TemplateElement[value.raw=/rounded-\\[var\\(--radius\\)\\]/]", message: "DS-RADIUS-003: prefer rounded-lg." },
        { selector: "Literal[value=/\\bshadow-\\[/]", message: "DS-SHADOW-001: use named shadow scale." },
        { selector: "TemplateElement[value.raw=/\\bshadow-\\[/]", message: "DS-SHADOW-001: use named shadow scale." },
        { selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(hidden|file|checkbox|radio|submit|reset|button|image|range|color)$/]))", message: "DS-PRIMITIVE-003: use <Input> from ui/." },
        { selector: "Literal[value=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]", message: "DS-COLOR-005: --success token is unmapped." },
        { selector: "TemplateElement[value.raw=/\\b(bg|text|border|ring)-success(-foreground)?\\b/]", message: "DS-COLOR-005: --success token is unmapped." },
        { selector: "CallExpression[callee.object.object.name='window'][callee.object.property.name='location'][callee.property.name=/^(assign|replace)$/]", message: "NAV-002: use useNavigate()." },
        { selector: "AssignmentExpression[left.object.object.name='window'][left.object.property.name='location'][left.property.name='href']", message: "NAV-002: use useNavigate()." },
        { selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']", message: "TYPE-002: no `as any` casts." },
        { selector: "Identifier[name='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        { selector: "Literal[value='SUPABASE_SERVICE_ROLE_KEY']", message: "SEC-003: server-only." },
        // REACT-004 selectors intentionally omitted — Playwright tests use document.* APIs
        // inside page.evaluate(() => ...) callbacks where they execute in browser context.
        { selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]", message: "DATE-001: use @/lib/dateFormat helpers." },
        { selector: "CallExpression[callee.property.name='catch'][arguments.0.type='ArrowFunctionExpression'][arguments.0.body.type='BlockStatement'][arguments.0.body.body.length=0]", message: "ERR-001: empty .catch arrow swallows errors." },
        // ENV-001 selector intentionally omitted — e2e tests run in Node (Playwright), `process.env` is correct.
        { selector: "Literal[value=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes." },
        { selector: "TemplateElement[value.raw=/(?:^|\\s)![A-Za-z]/]", message: "TW-IMPORTANT-001: no !-prefixed Tailwind classes." },
        { selector: "CallExpression[callee.name='useQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.name='useInfiniteQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.name='useMutation'] > ObjectExpression > Property[key.name='mutationKey'] > ArrayExpression > Literal:first-child", message: "QUERY-001: import from @/lib/query-keys." },
        { selector: "CallExpression[callee.property.name='invalidateQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='setQueryData'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='getQueryData'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        { selector: "CallExpression[callee.property.name='removeQueries'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", message: "QUERY-003: use query-key factory." },
        // Wave 3b (keep all)
        { selector: "Property[key.name='boxShadow'] > Literal[value=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Property[key.name='boxShadow'] > TemplateLiteral > TemplateElement[value.raw=/262\\s+83%/]", message: "DS-SHADOW-002: ad-hoc box-shadow with --primary HSL is forbidden." },
        { selector: "Literal[value=/\\bauth-form-/]", message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only." },
        { selector: "TemplateElement[value.raw=/\\bauth-form-/]", message: "DS-COLOR-006: auth-form-* tokens are scoped to src/pages/Auth.tsx only." },
        { selector: "Literal[value=/\\bsidebar-/]", message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only." },
        { selector: "TemplateElement[value.raw=/\\bsidebar-/]", message: "DS-COLOR-007: sidebar-* tokens are scoped to the sidebar component tree only." },
        { selector: "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
        { selector: "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']", message: "DATE-002: Intl.DateTimeFormat is allowed only in src/lib/dateFormat.ts." },
        // TEST-003 — prod URL forbidden in test files
        {
          selector: "Literal[value=/https:\\/\\/qualia-ux\\.com/]",
          message: "TEST-003: tests must use localhost:8080, not the production URL (qualia-ux.com).",
        },
        {
          selector: "TemplateElement[value.raw=/https:\\/\\/qualia-ux\\.com/]",
          message: "TEST-003: tests must use localhost:8080, not the production URL (qualia-ux.com).",
        },
      ],
      // --- Wave 3c: custom plugin rules ---
      // DS-SPACING-001: gap/space scale enforcement (warn)
      "qualia-compliance/ds-spacing-001-no-off-scale-gap": "warn",
      // DS-SPACING-004: Card/glass surface uses p-5/p-6 not p-4 (warn)
      "qualia-compliance/ds-spacing-004-no-p4-on-card-surface": "warn",
      // DS-SPACING-005: Label+input pairing spacing (info)
      "qualia-compliance/ds-spacing-005-label-input-spacing": "warn",
      // DS-TYPO-002: hint vs description size (info-level heuristic)
      "qualia-compliance/ds-typo-002-hint-vs-description-size": "warn",
      // DS-TYPO-005: h1/h2 should use tracking-tight (info)
      "qualia-compliance/ds-typo-005-heading-tracking-tight": "warn",
      // DS-PRIMITIVE-009: AlertDialog for destructive actions (warn)
      "qualia-compliance/ds-primitive-009-alertdialog-for-destructive": "warn",
      // EFFECT-001: useEffect cleanup mandatory (error — real memory leak class)
      "qualia-compliance/effect-001-cleanup-required": "error",
      // TEST-002: .skip requires comment with ticket/reason (warn)
      "qualia-compliance/test-002-skip-needs-comment": "warn",
      // SEC-004: import.meta.env allow-list (warn)
      "qualia-compliance/sec-004-import-meta-env-allowlist": "warn",
      // ERR-003: useMutation onError required (warn)
      "qualia-compliance/err-003-mutation-onerror-required": "warn",
      // ERR-004: thrown errors are English only (warn — heuristic, info intent)
      "qualia-compliance/err-004-throw-english-only": "warn",
      // --- Wave 3d: a11y rules ---
      // DS-A11Y-005: custom click targets (lowercase HTML elements with onClick) need focus-visible styling
      "qualia-compliance/ds-a11y-005-focus-visible": "warn",
      // DS-A11Y-007 (sub-check 2): prefer semantic <nav> over <div role="navigation">
      // Fixture-verified: prefer-tag-over-role fires on <div role="navigation"> ✓
      // Sub-check 3 (nav aria-label) has no jsx-a11y equivalent — audit-only.
      // Sub-checks 1 and 4 are runner-deferred / audit-only per spec.
      "jsx-a11y/prefer-tag-over-role": "warn",
      // DS-A11Y-010: Dialog/Sheet/Drawer/AlertDialog Content must have a Title descendant
      "qualia-compliance/ds-a11y-010-dialog-title": "warn",
    },
  },
);
