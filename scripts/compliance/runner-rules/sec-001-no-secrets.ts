import type { RunnerRule, SourceFile, PerFileHit } from '../runners/runner.js';

/**
 * SEC-001 — No hardcoded secrets.
 *
 * Patterns covered:
 *   - Stripe keys: sk_live_*, sk_test_*, pk_live_*
 *   - JWTs: eyJ<base64>.<base64>.<base64>
 *   - Figma access tokens: figd_*
 *   - PostHog project keys: phc_*
 *   - Slack tokens: xoxb-*, xoxp-*
 *   - Supabase service role key references
 *   - Full Supabase URLs with embedded apikey query strings
 */

/**
 * Returns true when the line is merely reading the env var via an accessor —
 * i.e. `Deno.env.get("KEY")`, `process.env.KEY`, `import.meta.env.KEY`.
 * These are the correct runtime patterns and must NOT be flagged.
 */
function isEnvAccessor(line: string, keyName: string): boolean {
  // Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get('...')
  if (/env\.get\(/.test(line)) return true;
  // process.env.SUPABASE_SERVICE_ROLE_KEY  (property access, not a string literal)
  if (new RegExp(`process\\.env\\.${keyName}\\b`).test(line)) return true;
  // import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  if (new RegExp(`import\\.meta\\.env\\.${keyName}\\b`).test(line)) return true;
  return false;
}

interface SecPattern {
  name: string;
  re: RegExp;
  /** Optional: env var name used to detect accessor patterns. */
  envKey?: string;
}

const PATTERNS: SecPattern[] = [
  { name: 'Stripe', re: /\b(sk|pk)_(live|test)_[A-Za-z0-9]{16,}\b/ },
  {
    name: 'JWT',
    re: /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/,
  },
  { name: 'Figma access token', re: /\bfigd_[A-Za-z0-9_-]{20,}\b/ },
  { name: 'PostHog project key', re: /\bphc_[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Slack token', re: /\bxox[bp]-[A-Za-z0-9-]{20,}\b/ },
  {
    name: 'Supabase service role key reference',
    re: /\bSUPABASE_SERVICE_ROLE_KEY\b/,
    envKey: 'SUPABASE_SERVICE_ROLE_KEY',
  },
  {
    name: 'Supabase URL with embedded apikey',
    re: /https:\/\/[a-z0-9-]+\.supabase\.co\/[^\s"']*[?&]apikey=[A-Za-z0-9._-]+/,
  },
];

export const sec001Rule: RunnerRule = {
  ruleId: 'SEC-001',
  detect(file: SourceFile): PerFileHit[] {
    // Skip the .env.example and similar safe files.
    if (file.filePath.endsWith('.env.example')) return [];

    const hits: PerFileHit[] = [];
    const lines = file.contents.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      for (const { name, re, envKey } of PATTERNS) {
        const m = line.match(re);
        if (!m) continue;
        // If the pattern has an associated env var name, skip lines that are
        // simply reading that var via a known accessor (env.get, process.env,
        // import.meta.env). Those are correct usage, not hardcoded secrets.
        if (envKey && isEnvAccessor(line, envKey)) continue;
        hits.push({
          line: i + 1,
          column: (m.index ?? 0) + 1,
          message: `SEC-001: possible ${name} secret in source. Move to env var; rotate the leaked key.`,
        });
      }
    }
    return hits;
  },
};
