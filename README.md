## Qualia – AI-powered UX audits

> **Status: snapshot artifact.** Qualia is no longer actively maintained as a commercial product. This repo is kept under an MIT license as a reference for anyone building AI-powered audit tooling. Issues + PRs are not actively reviewed. Fork freely.

Qualia is a Vite/React web app plus a Figma plugin backed by Supabase.  
Design teams create projects, upload screenshots or flows, and Qualia generates structured UX audits (scores, issues, recommendations) using AI running in Supabase Edge Functions.

### Core capabilities

- **Projects & personas**: Capture mission, persona, constraints, language, and scope for each project.
- **Single-screen & flow audits**: Upload one screen or an ordered flow (2–10 images) for analysis.
- **AI-driven UX analysis**: Supabase Edge Functions call AI to generate scores, issue lists, and “one big thing” summaries.
- **Per-issue feedback & re-audits**: Designers can agree/disagree with findings; feedback is stored and used as high-priority context in future audits.
- **Context documents**: Attach Notion pages, Google Drive docs, or uploaded files as extra context for audits.
- **Figma plugin**: Run audits directly from Figma, sync flows, and optionally draw highlights back on the canvas.
- **Quotas & analytics**: Enforced daily usage limits and analytics dashboards for adoption and performance.

---

## Architecture overview

### Web app (React/Vite)

- SPA built with **React + TypeScript**, using **Vite** as the build tool.
- UI built with **Tailwind CSS**, **shadcn-ui**, and **Radix UI** components.
- Routing with `react-router-dom` under `src/App.tsx`.
- Data fetching and caching with **@tanstack/react-query**.
- Supabase JS client for auth, database, and storage access.
- Analytics via **PostHog**, with consent handled in the app.

Key entry points:

- `src/main.tsx` – React bootstrap.
- `src/App.tsx` – Routes, global providers (React Query, language, auth), and analytics.
- `src/pages/*.tsx` – Screens like `Index`, `Dashboard`, `Project`, `Analytics`, `Settings`, `Auth`, `PluginAuth`, and integration callbacks.

### Supabase backend

- **Database & storage**: Supabase Postgres schemas and RLS policies defined in `supabase/migrations/*.sql`.
- **Edge Functions** (Deno + TypeScript) in `supabase/functions/*/index.ts`, including:
  - `analyze-ui` – Core UX analysis for screenshots/flows.
  - `explain-reaudit-delta`, `generate-feedback-response` – Re-audit and feedback explanation flows.
  - Figma-related: `figma-auth`, `manage-figma-token`, `fetch-figma-snapshot`, `fetch-figma-flow`, `plugin-analyze`, `plugin-upload-image`, `plugin-projects`, `plugin-issue-feedback`, `promote-plugin-audit`.
  - Drive/Notion: `google-drive-auth`, `google-drive-fetch`, `notion-auth`, `notion-fetch`, `extract-project-context`, `summarize-context`, `integration-status`.
  - Misc: `check-contrast`, `send-contact`, `delete-account`.
- Shared logic under `supabase/functions/_shared/*` for:
  - Prompt construction and AI calls.
  - Quota checks.
  - Token encryption/management.
  - Figma and integration utilities.

### Figma plugin

- Lives in `figma-plugin/`:
  - `manifest.json` – Plugin metadata and permissions.
  - `src/code.ts` – Main plugin thread: inspects selection, exports images, and draws issue highlights.
  - `src/ui/*` – React UI for plugin auth, project selection, running audits, and viewing/submitting feedback.
  - `src/ui/api.ts` – HTTP client for talking to Supabase Edge Functions.
  - Built via `esbuild` (`figma-plugin/esbuild.config.mjs`).

---

## Tech stack

### Frontend

- **Framework**: React + TypeScript.
- **Bundler**: Vite.
- **Styling**: Tailwind CSS, shadcn-ui, Radix UI, custom CSS.
- **Routing**: `react-router-dom`.
- **Data**: `@tanstack/react-query`, Supabase client.
- **UI & UX**: `sonner` (toasts), `driver.js` (product tours), `embla-carousel-react`, `react-resizable-panels`, `react-day-picker`, `recharts`, `lucide-react`.
- **Testing**: Vitest + Testing Library.
- **Linting**: ESLint 9 + TypeScript ESLint.

### Backend & infrastructure

- **Database/auth/storage**: Supabase.
- **Business logic**: Supabase Edge Functions (Deno + TypeScript).
- **AI orchestration**: Edge Functions calling Google Gemini via `GEMINI_API_KEY`.

### Figma plugin

- **Runtime**: Figma plugin API.
- **Language**: TypeScript.
- **UI**: React, bundled with esbuild.

---

## Project structure

High-level layout:

- `src/` – Web app source.
  - `pages/` – Top-level routes (landing, dashboard, project, analytics, settings, auth, callback pages).
  - `components/` – Reusable UI and domain components (audit forms, upload zones, project cards, context doc UIs, etc.).
  - `contexts/` – Auth and language contexts.
  - `hooks/` – Data and UI hooks for projects, audits, personas, context docs, integrations, daily limits, product tours, etc.
  - `services/` – Thin Supabase-backed services (projects, audits, feedback, integrations, context docs, analytics).
  - `integrations/` – Supabase client and DB types.
  - `lib/` – Utilities (API helpers, analytics, feature flags, PDF export, text extraction, date formatting).
  - `utils/translations/` – String dictionaries for multi-language support.
  - `styles/` – Global styles and product tour CSS.
- `supabase/`
  - `config.toml` – Supabase project config.
  - `migrations/` – Database schema and RLS migrations.
  - `functions/` – Edge Functions (`*/index.ts`) and shared helpers (`_shared/*`).
- `figma-plugin/`
  - `manifest.json` – Figma plugin manifest.
  - `src/code.ts` – Main plugin thread.
  - `src/ui/*` – Plugin React UI and API client.
  - `esbuild.config.mjs` – Build configuration.
- `public/` – Static assets.
- Tooling: `vite.config.ts`, `vitest.config.ts`, `tailwind.config.ts`, `eslint.config.js`, `tsconfig*.json`, `vercel.json`.

---

## Getting started

### Prerequisites

- **Node.js** (LTS recommended) and **npm**.
- A **Supabase project** with:
  - Database migrations from `supabase/migrations/` applied.
  - Edge Functions enabled and deployed.
- (Optional but recommended) Accounts and apps for:
  - **Figma** (for plugin + OAuth).
  - **Google Cloud** (Drive OAuth + Picker).
  - **Notion** (OAuth).

### 1. Clone and install

```sh
git clone <YOUR_GIT_URL>
cd qualia-mvp
npm install
```

### 2. Configure environment

Create a `.env` file at the repo root based on `.env.example` and fill in the values below.

#### Frontend env variables (Vite)

These are read via `import.meta.env` and configured in `vite.config.ts`:

- `VITE_SUPABASE_URL` – Supabase project URL (from Supabase dashboard).
- `VITE_SUPABASE_PUBLISHABLE_KEY` – Supabase anon/public key.
- `VITE_SUPABASE_PROJECT_ID` – Supabase project ID (used for metadata and links).
- `VITE_POSTHOG_KEY` – PostHog project API key for analytics.
- `VITE_POSTHOG_HOST` – Optional PostHog host (defaults to PostHog cloud when not set).
- `VITE_GOOGLE_APP_ID` – Google Cloud project number for Drive Picker.
- `VITE_GOOGLE_API_KEY` – Google API key for Drive Picker.

Additionally, the app honors:

- `POSTHOG_API_KEY` – Alternative for `VITE_POSTHOG_KEY`.
- `POSTHOG_HOST` – Alternative for `VITE_POSTHOG_HOST`.

> See `src/integrations/supabase/client.ts`, `src/lib/posthog.ts`, and `src/hooks/use-drive-picker.ts` for how these are used.

#### Supabase Edge Function secrets

Configure these in the Supabase project settings (Environment Variables). They are accessed via `Deno.env.get` in the various functions.

- **Core Supabase config**
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

- **App URL**
  - `APP_URL` – Base URL of the deployed web app (used in OAuth redirects and plugin links).

- **AI**
  - `GEMINI_API_KEY` – Google Gemini API key, used by `analyze-ui` and the other analysis functions.

- **Figma integration**
  - `FIGMA_CLIENT_ID`
  - `FIGMA_CLIENT_SECRET`
  - `FIGMA_TOKEN_ENCRYPTION_KEY` – Key for encrypting stored Figma tokens.
  - `PLUGIN_ANALYZE_IMAGE_SOURCE` – Controls how plugin images are sourced (e.g., from Figma vs uploaded URLs).

- **Drive / Notion integrations**
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `NOTION_CLIENT_ID`
  - `NOTION_CLIENT_SECRET`
  - `INTEGRATION_ENCRYPTION_KEY` – Symmetric key for encrypting integration and Figma tokens.

- **Email**
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`

> For more detailed setup of Google Drive and Notion, see `supabase/functions/README-DRIVE-NOTION.md`.

#### Feature flags

- `FEATURE_DRIVE_NOTION_IMPORT` – Frontend feature flag (boolean-like string) to enable/disable the Drive/Notion import UX.
  - Defined in `src/lib/feature-flags.ts` and used around the Dashboard/import features.

### 3. Seed cron + trigger config (`private.cron_config`)

Several Postgres triggers and pg_cron jobs read shared values from the
`private.cron_config` table at runtime (URL, allowlists, webhook secrets).
The seed migration `supabase/migrations/20260523189500_set_db_settings.sql`
ships with placeholder values — **edit it before applying to a fresh
project**, or `UPSERT` the real values manually:

```sql
INSERT INTO private.cron_config (name, value) VALUES
  ('functions_base_url',        'https://<YOUR_REF>.supabase.co/functions/v1'),
  ('operator_email',            '<your-operator-email>'),
  ('showcase_publisher_emails', '<your-operator-email>,<additional-email>'),
  ('welcome_webhook_secret',    '<openssl rand -base64 32>'),
  ('retention_webhook_secret',  '<openssl rand -base64 32>'),
  ('storage_cron_secret',       '<openssl rand -base64 32>')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;
```

The three webhook/cron secrets must match the corresponding Edge Function
env vars (`WEBHOOK_SECRET`, `RETENTION_CRON_SECRET`, `STORAGE_CRON_SECRET`)
or the cron jobs and triggers will return 401. See
`tasks/lessons.md` → "Cron secrets live in TWO stores".

### 4. Fork-specific edits

Some identifiers are baked into config files that Vercel/Figma schemas
don't allow to be templated. Edit these by hand for your fork:

- **`figma-plugin/manifest.json`** — `networkAccess.allowedDomains`:
  replace `https://qualia-ux.com` with your app's domain. Without this,
  the plugin can't `fetch` your backend from inside Figma.
- **`vercel.json`** — `rewrites[].destination` for `/mcp` and `/mcp-auth`:
  replace `zujbauyrpisjdqmjhmgr.supabase.co` with your Supabase project ref.
  See `agent_docs/danger-zones.md` → "vercel.json — Strict Schema" for why
  these can't be env-templated.
- **`supabase/config.toml`** — `project_id`: replace with your ref. This
  is public-by-design (already exposed via the anon key in the web bundle).
- **`figma-plugin/esbuild.config.mjs`** — already reads `APP_URL` from env
  via `define`. Export `APP_URL=https://your-domain.com` before
  `npm run build` inside `figma-plugin/`.

### 5. Test fixtures (optional)

- See `e2e/fixtures/README.md` for the Playwright opt-in fixture pattern
  (BYOK Gemini key, Figma OAuth) — without these, ~7 e2e tests skip with
  clear messages.
- See `docs/analytics/queries/README.md` for the operator-filter pattern
  used by all 18 analytics queries (gitignored `_operator_emails.local.sql`).

---

## Running the app locally

From the repo root:

```sh
# Start the web app (Vite dev server)
npm run dev
```

By default, Vite is configured to:

- Bind to all interfaces (`host: '::'`).
- Use port **8080**.

You can customize host/port via standard Vite environment variables or CLI flags.

For a production build:

```sh
npm run build        # Production build
npm run preview      # Preview the production build locally
```

---

## Supabase database and functions

### Applying migrations

Migrations live under `supabase/migrations/`. To apply them to your Supabase project, either:

- Use the **Supabase Studio** migration tools, or
- Use the **Supabase CLI**:

```sh
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

(Adjust for your workflow if you manage migrations differently.)

### Deploying Edge Functions

Each function has its own folder under `supabase/functions/` with an `index.ts`. After configuring env vars, deploy them with the Supabase CLI:

```sh
supabase functions deploy <function-name>
```

See `supabase/functions/` for the full list of functions.

---

## Figma plugin development

The plugin lives in `figma-plugin/` and is built with TypeScript + React UI.

### 1. Configure plugin endpoints

The plugin currently uses hard-coded URLs in `figma-plugin/src/ui/api.ts`:

- `SUPABASE_FUNCTIONS_BASE` – Supabase Functions base URL (e.g. `https://<project>.supabase.co/functions/v1`).
- `QUALIA_APP_URL` – Qualia web app base URL (e.g. `https://qualia-ux.com`).
- Derived constants like:
  - `PLUGIN_AUTH_IFRAME_URL` – `${QUALIA_APP_URL}/plugin-auth`
  - `QUALIA_SETTINGS_URL` – `${QUALIA_APP_URL}/settings`
  - `QUALIA_PROJECTS_URL` – `${QUALIA_APP_URL}/dashboard`

If you self-host Qualia, update these constants to match your deployment and Supabase project.

### 2. Install and build

```sh
cd figma-plugin
npm install

# One-off build
npm run build

# Or watch mode during development
npm run dev
```

The build outputs `dist/code.js`, `dist/ui.html`, and `dist/ui.js`, which are referenced by `manifest.json`.

### 3. Load in Figma

1. In Figma, open **Plugins → Development → Import plugin from manifest**.
2. Select `figma-plugin/manifest.json`.
3. With `npm run dev` running, make changes to the plugin code and reload in Figma to see updates.

Ensure your Supabase Edge Functions are deployed and accessible from the Figma environment (CORS, network permissions, and Supabase `config.toml`/JWT verification settings).

---

## Testing and linting

Run tests with Vitest:

```sh
npm run test        # Single run
npm run test:watch  # Watch mode
```

Run linting with ESLint:

```sh
npm run lint
```

---

## Deployment

### Web app

The web app is a standard Vite SPA and can be deployed to:

- **Vercel** (see `vercel.json` for CSP and headers), or
- Any static hosting provider that can serve the Vite build output.

Typical static deployment flow:

```sh
npm run build
# Deploy the contents of the `dist/` directory to your hosting provider
```

Ensure that:

- `APP_URL` matches the final deployed URL.
- Supabase env vars (in both frontend and Edge Functions) are configured with this URL for redirects and links.

### Supabase

Edge Functions and database live entirely in Supabase:

- Functions are deployed via the Supabase CLI (`supabase functions deploy ...`) or via the dashboard.
- Database migrations are applied via Supabase migrations (CLI or Studio).

Make sure the function URLs and `APP_URL` are consistent with the web and plugin deployments.

---

## Useful scripts and utilities

- `npm run dev` – Start the web app dev server.
- `npm run build` – Production build for the web app.
- `npm run build:dev` – Development-mode build.
- `npm run preview` – Preview the production build.
- `npm run lint` – Run ESLint over the project.
- `npm run test`, `npm run test:watch` – Run tests.
- `figma-plugin/npm run build` – Build the Figma plugin bundle.
- `figma-plugin/npm run dev` – Watch and rebuild the plugin during development.

---

## Notes and further references

- Database schema and RLS policies: see `supabase/migrations/`.
- Drive and Notion integration details: see `supabase/functions/README-DRIVE-NOTION.md`.
- Supabase shared logic and patterns: see `supabase/functions/_shared/*`.

If you’re extending Qualia, consider:

- Reusing existing services in `src/services/` and hooks in `src/hooks/`.
- Respecting quotas and feedback flows by going through the existing Edge Functions instead of calling AI directly.
