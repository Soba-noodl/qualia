/**
 * Render-time substitution for legal address placeholders.
 *
 * The translation strings in `src/utils/translations/{terms,privacy}.ts`
 * use literal `<your-city>` and `<your-country>` markers so the OSS
 * publish doesn't bake the operator's real address into source. At runtime
 * (in the operator's deployed site OR a fork's), this helper substitutes
 * the markers with values from Vite env vars.
 *
 * Vercel setup (operator):
 *   VITE_LEGAL_CITY=Lucca
 *   VITE_LEGAL_COUNTRY=Italy
 *
 * Forks: set their own VITE_LEGAL_CITY + VITE_LEGAL_COUNTRY before
 * `npm run build`. If unset, the literal `<your-city>` / `<your-country>`
 * remains visible — intentional, surfaces that the fork hasn't configured
 * its legal address yet.
 */
export function substituteLegalAddress(text: string): string {
  const city = import.meta.env.VITE_LEGAL_CITY ?? "<your-city>";
  const country = import.meta.env.VITE_LEGAL_COUNTRY ?? "<your-country>";
  return text
    .replace(/<your-city>/g, city)
    .replace(/<your-country>/g, country);
}
