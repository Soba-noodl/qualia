# Drive / Notion integration – deployment

The **Google Drive and Notion** features call these Edge Functions. If they are not deployed, the app will show "Failed to fetch" when connecting or fetching documents.

## Functions to deploy

Deploy these to the same Supabase project your app uses:

- `google-drive-auth` – starts Google OAuth, returns redirect URL
- `notion-auth` – starts Notion OAuth, returns redirect URL  
- `integration-status` – returns whether Drive/Notion are connected
- `google-drive-fetch` – fetches document content from Google Drive
- `notion-fetch` – fetches page content from Notion
- `extract-project-context` – AI extraction of name/mission/archetypes from documents

## How to deploy

- **Supabase CLI:** From the project root, run:
  ```bash
  supabase functions deploy google-drive-auth
  supabase functions deploy notion-auth
  supabase functions deploy integration-status
  supabase functions deploy google-drive-fetch
  supabase functions deploy notion-fetch
  supabase functions deploy extract-project-context
  ```
- **Lovable:** If you use Lovable Cloud, use its Backend / Functions (or linked Supabase) UI to deploy these functions, or ask support how to deploy Edge Functions from this repo.

## Secrets (Supabase Dashboard → Edge Functions → Secrets)

Set these so the functions work:

| Secret | Used by | Description |
|--------|---------|-------------|
| `GOOGLE_CLIENT_ID` | google-drive-auth, google-drive-fetch | From Google Cloud Console OAuth client |
| `GOOGLE_CLIENT_SECRET` | google-drive-auth, google-drive-fetch | From Google Cloud Console |
| `NOTION_CLIENT_ID` | notion-auth, notion-fetch | From Notion integration |
| `NOTION_CLIENT_SECRET` | notion-auth, notion-fetch | From Notion integration |
| `INTEGRATION_ENCRYPTION_KEY` | All integration functions | Any 32-character string (for token encryption) |
| `APP_URL` | google-drive-auth, notion-auth | Your app URL, e.g. `https://your-app.lovable.app` |

## Google Drive Picker (frontend)

To use the Drive file picker (instead of only pasting links), enable **Google Picker API** in the same Google Cloud project and set a **frontend** env var:

- **`VITE_GOOGLE_APP_ID`** – Your Google Cloud **project number** (not the project ID). Find it in Google Cloud Console → IAM & Admin → Settings. The Picker uses this as its App ID.

## Notion OAuth redirect URI

Notion OAuth redirects to **your app** (not Supabase). If you see **"Missing or invalid redirect_uri"** from Notion, the URI we send must **exactly** match one entry in your Notion integration.

1. **Get the exact redirect URI**  
   The app uses: `{APP_URL}/auth/notion/callback` (no trailing slash). So if `APP_URL` is `https://qualia-ux.com`, the redirect URI is `https://qualia-ux.com/auth/notion/callback`.

2. **In Notion** (My integrations → your integration → **OAuth domain & URIs**):
   - Add that **exact** URL under **Redirect URIs** (e.g. `https://qualia-ux.com/auth/notion/callback`).
   - Use the same base URL as the `APP_URL` secret in Supabase (your real app URL). For local testing, also add e.g. `http://localhost:5173/auth/notion/callback` and set `APP_URL` to `http://localhost:5173` when testing locally.

3. **Redeploy** the `notion-auth` function after changing `APP_URL` so the redirect_uri in the auth request matches what you added in Notion.

After deploying and matching the URI, "Connect Notion" should work.
