#!/usr/bin/env node
/**
 * Populate showcase_audits with the 4 curated audits + copy their screens
 * into the public `showcase-screens` bucket.
 *
 * Idempotent: re-runs upsert into the same slug rows; re-uploads with x-upsert.
 *
 * Run:  npx tsx scripts/populate-showcase-audits.ts [--dry-run]
 *
 * Env required:
 *   SUPABASE_URL             Supabase project URL (find in dashboard → Settings → API)
 *   SUPABASE_SERVICE_KEY     service_role key
 */

import process from "node:process";

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  throw new Error(
    "SUPABASE_URL env var required — set before running. Get the URL from your Supabase project dashboard."
  );
}
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_SERVICE_KEY) die("missing SUPABASE_SERVICE_KEY in env");

// Two sections on /showcase:
//   own_work        — audits Andrea ran on products he worked on as PM
//   public_examples — curated audits of well-known products (top-left = Linear, see spec §4 / D2)
type Section = "own_work" | "public_examples";
type ShowcaseEntry = {
  slug: string;
  audit_id: string;
  display_order: number;
  section?: Section; // omitted ⇒ DB default ('public_examples')
  translations?: Record<string, unknown>; // omitted ⇒ DB default ({}) / preserve existing on update
};

const SHOWCASE: ShowcaseEntry[] = [
  // own_work — Andrea's PM work, hand-authored copy in both locales
  {
    slug: "pando",
    audit_id: "252ba27e-0158-4f7f-8680-ad55ebe3e1ab",
    display_order: 0,
    section: "own_work",
    translations: {
      en: {
        card_subtitle: "Resident monitoring system for Italian assisted-living facilities.",
        card_summary:
          "The prototype handles real-time alerts beautifully, but the 'Support' module, where staff actually create, move, and remove residents, is fragmented into a multi-step wizard that hides the core CRUD operations. For overworked socio-health operators, that's friction on every daily task.",
        card_summary_principle: "Hick's Law",
      },
      it: {
        card_subtitle: "Sistema di monitoraggio dei residenti per RSA italiane.",
        card_summary:
          "Il prototipo gestisce gli allarmi in tempo reale in modo eccellente, ma il modulo 'Supporto', dove gli operatori creano, spostano e rimuovono residenti, è frammentato in un wizard a più passi che nasconde le operazioni CRUD core. Per operatori socio-sanitari sovraccarichi, è attrito su ogni task quotidiano.",
        card_summary_principle: "Legge di Hick",
      },
    },
  },
  {
    slug: "windtre",
    audit_id: "c4007d74-0ce1-4a2a-b76c-8113ae8951da",
    display_order: 1,
    section: "own_work",
    translations: {
      en: {
        card_subtitle: "Energy engagement app paired with a smart meter reader.",
        card_summary:
          "When the smart-meter activation fails, the single point where users are most likely to drop off, the app sends them to a generic support page instead of holding the diagnostic loop in-context. The alert screens framing this moment use the same saturated orange a system warning would, amplifying anxiety without offering an action.",
        card_summary_principle: "Emotional Friction",
      },
      it: {
        card_subtitle: "App di engagement energetico abbinata a un lettore di contatore.",
        card_summary:
          "Quando l'attivazione del lettore di contatore fallisce, il punto in cui gli utenti hanno più probabilità di abbandonare, l'app li manda a una pagina di supporto generica invece di gestire il loop diagnostico in-context. Le schermate di alert che incorniciano questo momento usano lo stesso arancione saturato di un avviso di sistema, amplificando l'ansia senza offrire un'azione.",
        card_summary_principle: "Frizione Emotiva",
      },
    },
  },

  // public_examples — curated brand audits
  { slug: "linear",   audit_id: "e396d03c-8378-4a8b-b56f-5c3f0ee7a842", display_order: 0, section: "public_examples" },
  { slug: "vercel",   audit_id: "5bc6eceb-1f4a-4a20-af97-a888c599ed09", display_order: 1, section: "public_examples" },
  { slug: "supabase", audit_id: "aa2e25b7-df5d-450d-a48d-4a166aee02de", display_order: 2, section: "public_examples" },
  { slug: "figma",    audit_id: "ce71cc3c-201b-48a3-82f3-c7461e64ead2", display_order: 3, section: "public_examples" },
];

const PRIVATE_BUCKET = "screenshots";
const PUBLIC_BUCKET = "showcase-screens";

const headers = {
  apikey: SUPABASE_SERVICE_KEY!,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
};

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function parseArgs() {
  return { dryRun: process.argv.includes("--dry-run") };
}

async function fetchAudit(auditId: string): Promise<{ flow_images: string[] | null }> {
  const url = `${SUPABASE_URL}/rest/v1/audits?id=eq.${auditId}&select=flow_images`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) die(`audit fetch failed: ${resp.status}`);
  const rows = (await resp.json()) as { flow_images: string[] | null }[];
  if (!rows.length) die(`audit ${auditId} not found`);
  return rows[0];
}

async function downloadPrivate(path: string): Promise<{ data: ArrayBuffer; contentType: string }> {
  // Service role uses the `object` endpoint directly (no signed URL needed).
  const url = `${SUPABASE_URL}/storage/v1/object/${PRIVATE_BUCKET}/${path}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) die(`download failed (${path}): ${resp.status} ${await resp.text()}`);
  return {
    data: await resp.arrayBuffer(),
    contentType: resp.headers.get("content-type") ?? "image/png",
  };
}

async function uploadPublic(path: string, data: ArrayBuffer, contentType: string) {
  const url = `${SUPABASE_URL}/storage/v1/object/${PUBLIC_BUCKET}/${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: data,
  });
  if (!resp.ok) die(`upload failed (${path}): ${resp.status} ${await resp.text()}`);
}

async function upsertShowcaseRow(
  slug: string,
  auditId: string,
  displayOrder: number,
  publicFlowImages: string[],
  section: Section | undefined,
  translations: Record<string, unknown> | undefined,
) {
  // Look up existing row by slug
  const lookupUrl = `${SUPABASE_URL}/rest/v1/showcase_audits?slug=eq.${slug}&select=id`;
  const lookupResp = await fetch(lookupUrl, { headers });
  if (!lookupResp.ok) die(`lookup failed: ${lookupResp.status}`);
  const existing = (await lookupResp.json()) as { id: string }[];

  const payload: Record<string, unknown> = {
    audit_id: auditId,
    slug,
    display_order: displayOrder,
    public_flow_images: publicFlowImages,
  };
  if (section !== undefined) payload.section = section;
  if (translations !== undefined) payload.translations = translations;

  if (existing.length) {
    const patchUrl = `${SUPABASE_URL}/rest/v1/showcase_audits?id=eq.${existing[0].id}`;
    const r = await fetch(patchUrl, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) die(`PATCH failed: ${r.status} ${await r.text()}`);
    return existing[0].id;
  } else {
    const postUrl = `${SUPABASE_URL}/rest/v1/showcase_audits`;
    const r = await fetch(postUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) die(`POST failed: ${r.status} ${await r.text()}`);
    const created = (await r.json()) as { id: string }[];
    return created[0].id;
  }
}

async function main() {
  const { dryRun } = parseArgs();
  console.log(`${dryRun ? "[DRY RUN] " : ""}populating ${SHOWCASE.length} showcase entries`);

  const inserted: { slug: string; rowId?: string; screens: number }[] = [];

  for (const entry of SHOWCASE) {
    console.log(`\n=== ${entry.slug.toUpperCase()} (audit ${entry.audit_id}) ===`);
    const { flow_images } = await fetchAudit(entry.audit_id);
    if (!flow_images || flow_images.length === 0) {
      die(`audit ${entry.audit_id} has no flow_images`);
    }
    console.log(`  source: ${flow_images.length} screens`);

    const publicPaths: string[] = [];
    for (let i = 0; i < flow_images.length; i++) {
      const srcPath = flow_images[i];
      const dstPath = `${entry.slug}/step-${i + 1}.png`;
      console.log(`  [${i + 1}/${flow_images.length}] ${srcPath} → ${dstPath}`, dryRun ? "(DRY)" : "");
      if (!dryRun) {
        const { data, contentType } = await downloadPrivate(srcPath);
        await uploadPublic(dstPath, data, contentType);
      }
      publicPaths.push(dstPath);
    }

    if (!dryRun) {
      const rowId = await upsertShowcaseRow(
        entry.slug,
        entry.audit_id,
        entry.display_order,
        publicPaths,
        entry.section,
        entry.translations,
      );
      console.log(`  ✓ showcase_audits row ${rowId}`);
      inserted.push({ slug: entry.slug, rowId, screens: publicPaths.length });
    } else {
      console.log(`  DRY: would upsert showcase_audits with ${publicPaths.length} public paths`);
      inserted.push({ slug: entry.slug, screens: publicPaths.length });
    }
  }

  console.log("\n=== summary ===");
  for (const r of inserted) {
    console.log(`  ${r.slug.padEnd(10)} screens=${r.screens}${r.rowId ? `  row=${r.rowId}` : ""}`);
  }

  if (!dryRun && inserted.length) {
    const ids = inserted.map((r) => `'${r.rowId}'`).filter(Boolean).join(",");
    console.log(`\nRollback SQL:`);
    console.log(`  DELETE FROM public.showcase_audits WHERE id IN (${ids});`);
    console.log(`  (storage objects in showcase-screens/ must be removed via Storage UI or another script)`);
  }
}

main().catch((err) => die((err as Error).stack ?? String(err)));
