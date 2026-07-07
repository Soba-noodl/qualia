#!/usr/bin/env node
/**
 * One-shot translator for showcase audits.
 *
 * Reads an audit's user-facing content from the public_showcase_audit view
 * (ai_report findings + one_big_thing, plus the row-level context: project
 * mission, screen goal, personas), sends only the string fields to Claude Haiku
 * for translation from the source locale into a target locale, validates the
 * response shape matches the source, and merges the result into
 * showcase_audits.translations[locale] (preserving sibling keys like card_*).
 *
 * Source defaults to English. For audits authored in another language (e.g. the
 * Italian-source rows), pass --source it so we translate it→en correctly.
 *
 * Run:  npx tsx scripts/translate-showcase-audit.ts --audit-id <uuid> --locale it [--source en] [--dry-run]
 *
 * Env required:
 *   ANTHROPIC_API_KEY        Claude API key
 *   SUPABASE_URL             Supabase project URL (find in dashboard → Settings → API)
 *   SUPABASE_SERVICE_KEY     service_role key (NOT anon)
 */

import process from "node:process";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  throw new Error(
    "SUPABASE_URL env var required — set before running. Get the URL from your Supabase project dashboard."
  );
}
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!ANTHROPIC_API_KEY) die("missing ANTHROPIC_API_KEY in env");
if (!SUPABASE_SERVICE_KEY) die("missing SUPABASE_SERVICE_KEY in env");

const ENGINES = ["cognitive", "heuristic", "interaction", "system_logic"] as const;
type Engine = (typeof ENGINES)[number];

type Finding = {
  issue: string;
  principle: string;
  why_it_matters: string;
  suggestion: string;
  image_index?: number | null;
  box_2d?: number[] | null;
};

type AiReport = {
  score: number;
  sub_scores: Record<string, number>;
  engines: Record<Engine, Finding[]>;
  one_big_thing: string;
};

type Persona = { name: string; description: string };

type SourceContent = {
  ai_report: AiReport;
  screen_context: string | null;
  selected_personas: Persona[] | null;
  project_mission: string;
};

type TranslatedFinding = Pick<Finding, "issue" | "principle" | "why_it_matters" | "suggestion">;
type TranslationPayload = {
  engines: Record<Engine, TranslatedFinding[]>;
  one_big_thing: string;
  project_mission: string;
  screen_context?: string;
  personas?: Persona[];
};

// ---------------------------------------------------------------------------

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { auditId?: string; locale?: string; source: string; dryRun: boolean } = {
    source: "en",
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--audit-id") out.auditId = args[++i];
    else if (args[i] === "--locale") out.locale = args[++i];
    else if (args[i] === "--source") out.source = args[++i];
    else if (args[i] === "--dry-run") out.dryRun = true;
  }
  if (!out.auditId || !out.locale) {
    die("usage: --audit-id <uuid> --locale <code> [--source <code>] [--dry-run]");
  }
  if (out.source === out.locale) {
    die(`--source (${out.source}) and --locale (${out.locale}) must differ`);
  }
  return out as { auditId: string; locale: string; source: string; dryRun: boolean };
}

async function fetchSource(auditId: string): Promise<SourceContent> {
  const url =
    `${SUPABASE_URL}/rest/v1/public_showcase_audit?audit_id=eq.${auditId}` +
    `&select=ai_report,screen_context,selected_personas,project_mission`;
  const resp = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!resp.ok) die(`source fetch failed: ${resp.status} ${await resp.text()}`);
  const rows = (await resp.json()) as SourceContent[];
  if (!rows.length) die(`no showcase row for audit ${auditId} (run populate first)`);
  return rows[0];
}

async function findShowcaseRow(auditId: string): Promise<{ id: string } | null> {
  const url = `${SUPABASE_URL}/rest/v1/showcase_audits?audit_id=eq.${auditId}&select=id`;
  const resp = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!resp.ok) die(`showcase lookup failed: ${resp.status} ${await resp.text()}`);
  const rows = (await resp.json()) as { id: string }[];
  return rows[0] ?? null;
}

function buildTranslationInput(src: SourceContent): TranslationPayload {
  const report = src.ai_report;
  const engines = {} as Record<Engine, TranslatedFinding[]>;
  for (const e of ENGINES) {
    engines[e] = (report.engines[e] ?? []).map((f) => ({
      issue: f.issue,
      principle: f.principle,
      why_it_matters: f.why_it_matters,
      suggestion: f.suggestion,
    }));
  }
  const payload: TranslationPayload = {
    engines,
    one_big_thing: report.one_big_thing,
    project_mission: src.project_mission,
  };
  if (src.screen_context && src.screen_context.trim()) {
    payload.screen_context = src.screen_context;
  }
  if (src.selected_personas && src.selected_personas.length) {
    payload.personas = src.selected_personas.map((p) => ({
      name: p.name,
      description: p.description,
    }));
  }
  return payload;
}

function localeName(locale: string): string {
  const map: Record<string, string> = {
    it: "Italian",
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
  };
  return map[locale] ?? locale;
}

async function callClaude(
  payload: TranslationPayload,
  source: string,
  locale: string,
): Promise<TranslationPayload> {
  const sourceName = localeName(source);
  const targetName = localeName(locale);
  const systemPrompt = `You translate UX audit content from ${sourceName} to ${targetName}.

Rules:
- Return ONLY a JSON object with the same shape as the input.
- Translate ONLY these string fields: issue, principle, why_it_matters, suggestion, one_big_thing, project_mission, screen_context, and each persona's name and description.
- For personas: translate the description, but keep the person's first name verbatim (e.g. "Sara", "Davide").
- PRESERVE technical UX terms verbatim: "Nielsen #1: System Status", "Nielsen #4: Consistency", "Fitts's Law", "Hick's Law", "Miller's Law", "Gestalt: Proximity", "Recognition over Recall", "WCAG 2.5.5", "Cognitive Tunneling", "Default Bias", "False Affordance", "Information Scent", "Visual Hierarchy", "Signal-to-Noise", "Wayfinding".
- Preserve product names verbatim: Linear, Vercel, Supabase, Figma, Notion, Stripe.
- Preserve quoted UI strings verbatim (anything in "double quotes" referring to actual UI labels).
- Do NOT translate JSON keys.
- Do NOT add, remove, or reorder findings or personas. Same count and order.
- Use natural, professional ${targetName} — not literal/mechanical translation.
- Use the formal "you" form (e.g. Italian "lei" form is wrong here; use neutral phrasing without addressing the reader directly when possible).`;

  const userPrompt = `Translate the following UX audit content from ${sourceName} to ${targetName}. Return JSON only.

${JSON.stringify(payload, null, 2)}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!resp.ok) die(`Claude API failed: ${resp.status} ${await resp.text()}`);
  const body = await resp.json();
  const text = body.content?.[0]?.text;
  if (!text) die("Claude returned no text content");

  // Extract JSON (sometimes wrapped in ```json … ```)
  const jsonMatch = text.match(/```json\n?([\s\S]+?)\n?```/) ?? text.match(/(\{[\s\S]+\})/);
  if (!jsonMatch) die(`could not extract JSON from response:\n${text}`);
  try {
    return JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
  } catch (e) {
    die(`JSON parse failed: ${(e as Error).message}\n${text}`);
  }
}

function validateShape(source: TranslationPayload, translated: unknown): asserts translated is TranslationPayload {
  if (typeof translated !== "object" || translated === null) die("translated payload is not an object");
  const t = translated as TranslationPayload;
  if (typeof t.one_big_thing !== "string" || !t.one_big_thing.trim()) {
    die("translated.one_big_thing is missing or empty");
  }
  if (typeof t.project_mission !== "string" || !t.project_mission.trim()) {
    die("translated.project_mission is missing or empty");
  }
  if (!t.engines || typeof t.engines !== "object") die("translated.engines is missing");
  for (const e of ENGINES) {
    const src = source.engines[e] ?? [];
    const dst = t.engines[e] ?? [];
    if (dst.length !== src.length) {
      die(`engine ${e}: expected ${src.length} findings, got ${dst.length}`);
    }
    for (let i = 0; i < src.length; i++) {
      const f = dst[i];
      for (const k of ["issue", "principle", "why_it_matters", "suggestion"] as const) {
        if (typeof f[k] !== "string" || !f[k].trim()) {
          die(`engine ${e}[${i}].${k} is missing or empty`);
        }
      }
    }
  }
  if (source.screen_context !== undefined) {
    if (typeof t.screen_context !== "string" || !t.screen_context.trim()) {
      die("translated.screen_context is missing or empty");
    }
  }
  if (source.personas !== undefined) {
    const dst = t.personas ?? [];
    if (dst.length !== source.personas.length) {
      die(`personas: expected ${source.personas.length}, got ${dst.length}`);
    }
    for (let i = 0; i < dst.length; i++) {
      for (const k of ["name", "description"] as const) {
        if (typeof dst[i]?.[k] !== "string" || !dst[i][k].trim()) {
          die(`persona[${i}].${k} is missing or empty`);
        }
      }
    }
  }
}

async function upsertTranslation(showcaseId: string, locale: string, payload: TranslationPayload) {
  // Read current translations, merge, write back.
  const getUrl = `${SUPABASE_URL}/rest/v1/showcase_audits?id=eq.${showcaseId}&select=translations`;
  const getResp = await fetch(getUrl, {
    headers: { apikey: SUPABASE_SERVICE_KEY!, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  if (!getResp.ok) die(`read translations failed: ${getResp.status}`);
  const rows = (await getResp.json()) as {
    translations: Record<string, Record<string, unknown>>;
  }[];
  const current = rows[0]?.translations ?? {};
  // Merge at the locale level so sibling keys (card_summary, card_subtitle,
  // card_summary_principle) added elsewhere are preserved.
  const next = { ...current, [locale]: { ...(current[locale] ?? {}), ...payload } };

  const patchUrl = `${SUPABASE_URL}/rest/v1/showcase_audits?id=eq.${showcaseId}`;
  const patchResp = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ translations: next }),
  });
  if (!patchResp.ok) die(`patch failed: ${patchResp.status} ${await patchResp.text()}`);
}

// ---------------------------------------------------------------------------

async function main() {
  const { auditId, locale, source, dryRun } = parseArgs();
  console.log(
    `→ audit ${auditId} · ${localeName(source)} (${source}) → ${localeName(locale)} (${locale})${dryRun ? " [DRY RUN]" : ""}`,
  );

  const src = await fetchSource(auditId);
  const report = src.ai_report;
  const findingsCount = ENGINES.reduce((n, e) => n + (report.engines[e]?.length ?? 0), 0);
  const ctxBits = [
    "mission",
    src.screen_context?.trim() ? "screen_context" : null,
    src.selected_personas?.length ? `${src.selected_personas.length} persona(s)` : null,
  ].filter(Boolean);
  console.log(`  source: ${findingsCount} findings · score ${report.score} · ${ctxBits.join(", ")}`);

  const input = buildTranslationInput(src);
  const inputChars = JSON.stringify(input).length;
  console.log(`  input: ~${Math.round(inputChars / 4)} tokens`);

  console.log("  calling Claude Haiku...");
  const t0 = Date.now();
  const translated = await callClaude(input, source, locale);
  console.log(`  got response in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  validateShape(input, translated);
  console.log("  ✓ shape validated");

  // Sample preview
  const sample = translated.engines.cognitive?.[0];
  if (sample) {
    console.log(`  sample [cognitive 0] issue: "${sample.issue.slice(0, 100)}${sample.issue.length > 100 ? "..." : ""}"`);
  }
  console.log(`  one_big_thing: "${translated.one_big_thing.slice(0, 120)}${translated.one_big_thing.length > 120 ? "..." : ""}"`);

  if (dryRun) {
    console.log("\n[DRY RUN] not writing to DB. Re-run without --dry-run to persist.");
    return;
  }

  const showcaseRow = await findShowcaseRow(auditId);
  if (!showcaseRow) {
    die(`no showcase_audits row exists for audit ${auditId}. Run populate-showcase-audits.ts first.`);
  }
  await upsertTranslation(showcaseRow.id, locale, translated);
  console.log(`✓ wrote translations.${locale} to showcase_audits ${showcaseRow.id}`);
}

main().catch((err) => die((err as Error).stack ?? String(err)));
