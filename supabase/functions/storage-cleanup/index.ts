// supabase/functions/storage-cleanup/index.ts
//
// Recurring storage maintenance for user-data buckets:
//   - `screenshots`     — original uploads keyed by `<userId>/...`.
//   - `audit-resized`   — T-080 server-side resize cache, keyed by
//                         `<auditId>/<frame_index>.jpg`. Purged whenever the
//                         parent audit is older than RETENTION_DAYS *or* the
//                         parent audit row has been deleted (orphan cleanup).
//   - `showcase-screens` — operator-managed showcase media. INTENTIONALLY
//                          SKIPPED — these are not user uploads and have no
//                          90-day retention obligation.
//
// Behavior:
// 1. Deletes screenshots older than RETENTION_DAYS.
// 2. Deletes audit-resized cache for audits older than RETENTION_DAYS or
//    whose parent row no longer exists.
// 3. Recomputes total `screenshots` bucket size + file count.
// 4. If usage exceeds ALERT_THRESHOLD_PCT of the free-tier 1 GB cap, sends a
//    Resend email to the operator so storage doesn't silently breach the cap.
//
// Auth: service-role bearer token only. Triggered by pg_cron (see migration
// 20260520_storage_cleanup_cron.sql) or manual admin invocation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";

const RETENTION_DAYS = 90;
const FREE_TIER_BYTES = 1024 * 1024 * 1024; // 1 GB
const ALERT_THRESHOLD_PCT = 90;
const ALERT_THRESHOLD_BYTES = Math.floor((FREE_TIER_BYTES * ALERT_THRESHOLD_PCT) / 100);
const DELETE_BATCH_SIZE = 500;
const LIST_PAGE_SIZE = 1000;
const ID_LOOKUP_CHUNK = 500;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "Qualia <hello@qualia-ux.com>";
// Operator inbox that receives storage-cap alerts. No literal fallback —
// must be set in env or the function refuses to start. See
// docs/reviews/2026-05-23/privacy.md M-3.
const ALERT_TO = Deno.env.get("OPERATOR_EMAIL") ?? "";
const STORAGE_CRON_SECRET = Deno.env.get("STORAGE_CRON_SECRET") ?? "";

type CleanupSummary = {
  ok: boolean;
  retention_days: number;
  deleted_count: number;
  resized_prefixes_purged: number;
  resized_objects_deleted: number;
  remaining_files: number;
  remaining_bytes: number;
  remaining_mb: number;
  usage_pct: number;
  oldest_remaining: string | null;
  alert_sent: boolean;
};

Deno.serve(async (req) => {
  // Cron-secret bearer only. pg_cron passes it via the Authorization header.
  // Matches the existing pattern used by send-retention-emails.
  const auth = req.headers.get("Authorization") ?? "";
  if (!STORAGE_CRON_SECRET || auth !== `Bearer ${STORAGE_CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!ALERT_TO) {
    throw new Error(
      "OPERATOR_EMAIL env var required — set the operator inbox that receives storage-cap alerts."
    );
  }

  try {
    const admin = createClient(getSupabaseUrl(), getSecretKey());
    const summary = await runCleanup(admin);
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("storage-cleanup error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function runCleanup(admin: ReturnType<typeof createClient>): Promise<CleanupSummary> {
  // 1. Delete expired screenshots in batches until none remain.
  let totalDeleted = 0;
  while (true) {
    const { data: paths, error } = await admin.rpc("admin_old_screenshot_paths", {
      days_old: RETENTION_DAYS,
      max_rows: DELETE_BATCH_SIZE,
    });
    if (error) throw new Error(`rpc admin_old_screenshot_paths: ${error.message}`);
    const names = ((paths ?? []) as Array<{ name: string }>).map((r) => r.name);
    if (names.length === 0) break;

    const { error: rmErr } = await admin.storage.from("screenshots").remove(names);
    if (rmErr) throw new Error(`storage remove: ${rmErr.message}`);
    totalDeleted += names.length;

    // Safety: stop if a batch returned fewer rows than requested (no more to fetch).
    if (names.length < DELETE_BATCH_SIZE) break;
  }

  // 1b. Purge audit-resized cache for expired or orphaned audits.
  const resizedPurge = await purgeAuditResized(admin);

  // 2. Recompute bucket stats.
  const { data: statsRows, error: statsErr } = await admin.rpc("admin_screenshots_bucket_stats");
  if (statsErr) throw new Error(`rpc admin_screenshots_bucket_stats: ${statsErr.message}`);
  const stats = ((statsRows ?? []) as Array<{
    total_bytes: number | null;
    file_count: number | null;
    oldest: string | null;
  }>)[0] ?? { total_bytes: 0, file_count: 0, oldest: null };

  const remainingBytes = Number(stats.total_bytes ?? 0);
  const remainingFiles = Number(stats.file_count ?? 0);
  const remainingMb = Math.round(remainingBytes / (1024 * 1024));
  const usagePct = Math.round((remainingBytes / FREE_TIER_BYTES) * 100);

  // 3. Alert if over threshold.
  let alertSent = false;
  if (remainingBytes >= ALERT_THRESHOLD_BYTES && RESEND_API_KEY) {
    alertSent = await sendAlertEmail({
      totalDeleted,
      remainingMb,
      remainingFiles,
      usagePct,
      oldestRemaining: stats.oldest,
    });
  }

  return {
    ok: true,
    retention_days: RETENTION_DAYS,
    deleted_count: totalDeleted,
    resized_prefixes_purged: resizedPurge.prefixesPurged,
    resized_objects_deleted: resizedPurge.objectsDeleted,
    remaining_files: remainingFiles,
    remaining_bytes: remainingBytes,
    remaining_mb: remainingMb,
    usage_pct: usagePct,
    oldest_remaining: stats.oldest,
    alert_sent: alertSent,
  };
}

/**
 * Walk the `audit-resized` bucket. Each top-level entry is an `<audit_id>`
 * prefix. For each prefix:
 *   - Look up the audit row by id.
 *   - If the row is missing OR created_at is older than RETENTION_DAYS,
 *     delete every object under that prefix.
 *
 * The bucket lives outside the `audits` table's lifecycle (it's a cache
 * populated by the Anthropic adapter), so without this sweep it grows
 * unboundedly when audits are deleted by user action or expire by retention.
 */
async function purgeAuditResized(
  admin: ReturnType<typeof createClient>,
): Promise<{ prefixesPurged: number; objectsDeleted: number }> {
  let prefixesPurged = 0;
  let objectsDeleted = 0;
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // 1. Paginate top-level prefixes. Storage list() with empty path returns
  //    top-level entries (folder prefixes, one per audit_id).
  const auditIds: string[] = [];
  let offset = 0;
  while (true) {
    const { data: page, error: listErr } = await admin.storage
      .from("audit-resized")
      .list("", { limit: LIST_PAGE_SIZE, offset });
    if (listErr) {
      console.error(`storage-cleanup audit-resized list: ${listErr.message}`);
      return { prefixesPurged, objectsDeleted };
    }
    if (!page || page.length === 0) break;
    for (const entry of page) {
      // We only care about audit_id prefixes (UUIDs, no file extension).
      if (UUID_RE.test(entry.name)) auditIds.push(entry.name);
    }
    if (page.length < LIST_PAGE_SIZE) break;
    offset += page.length;
  }

  if (auditIds.length === 0) {
    console.info(`[storage-cleanup] audit-resized: no prefixes to consider`);
    return { prefixesPurged, objectsDeleted };
  }

  // 2. Batched lookup of parent rows. Replaces a per-prefix N+1 SELECT with one
  //    .in() query per ID_LOOKUP_CHUNK (Postgres limits very-large IN lists).
  //    Map.has() distinguishes "row missing" (orphan, purge) from "row present".
  //    CRITICAL: track IDs whose chunk fetch FAILED separately from IDs we
  //    know are missing. A transient DB error must NOT cause those audits to
  //    be misclassified as orphans and have their resize-cache mass-purged.
  //    Skip them this run; the next run picks them up.
  const createdAtById = new Map<string, string | null>();
  const erroredIds = new Set<string>();
  for (let i = 0; i < auditIds.length; i += ID_LOOKUP_CHUNK) {
    const chunk = auditIds.slice(i, i + ID_LOOKUP_CHUNK);
    const { data: rows, error: rowErr } = await admin
      .from("audits")
      .select("id, created_at")
      .in("id", chunk);
    if (rowErr) {
      console.error(`storage-cleanup audit-resized lookup chunk: ${rowErr.message}`);
      for (const id of chunk) erroredIds.add(id);
      continue;
    }
    for (const row of (rows ?? []) as Array<{ id: string; created_at: string | null }>) {
      createdAtById.set(row.id, row.created_at);
    }
  }

  // 3. Decide per-prefix purge + delete.
  for (const auditId of auditIds) {
    // SAFETY: if the parent-row lookup failed for this id, defer to a later
    // cron run. Treating it as orphan would purge live audits' resize caches.
    if (erroredIds.has(auditId)) continue;
    let shouldPurge = false;
    if (!createdAtById.has(auditId)) {
      shouldPurge = true; // orphan — audit row gone (lookup succeeded, returned no row)
    } else {
      const createdAt = createdAtById.get(auditId);
      const createdMs = createdAt ? new Date(createdAt).getTime() : NaN;
      if (Number.isFinite(createdMs) && createdMs < cutoffMs) shouldPurge = true;
    }
    if (!shouldPurge) continue;

    // Enumerate and remove every object under this prefix.
    const { data: objs, error: objErr } = await admin.storage
      .from("audit-resized")
      .list(auditId, { limit: LIST_PAGE_SIZE });
    if (objErr) {
      console.error(`storage-cleanup audit-resized list ${auditId}: ${objErr.message}`);
      continue;
    }
    if (!objs || objs.length === 0) continue;
    const paths = objs.map((o) => `${auditId}/${o.name}`);
    const { error: rmErr } = await admin.storage.from("audit-resized").remove(paths);
    if (rmErr) {
      console.error(`storage-cleanup audit-resized remove ${auditId}: ${rmErr.message}`);
      continue;
    }
    prefixesPurged += 1;
    objectsDeleted += paths.length;
  }

  console.info(
    `[storage-cleanup] audit-resized: purged ${objectsDeleted} objects across ${prefixesPurged} prefixes (considered ${auditIds.length})`,
  );
  return { prefixesPurged, objectsDeleted };
}

async function sendAlertEmail(params: {
  totalDeleted: number;
  remainingMb: number;
  remainingFiles: number;
  usagePct: number;
  oldestRemaining: string | null;
}): Promise<boolean> {
  const { totalDeleted, remainingMb, remainingFiles, usagePct, oldestRemaining } = params;
  const subject = `[Qualia] Storage at ${usagePct}% — ${remainingMb} MB / 1 GB`;
  const html = `
    <h2>Qualia storage alert</h2>
    <p>The <code>screenshots</code> bucket is at <strong>${usagePct}%</strong> of the 1 GB free-tier cap.</p>
    <ul>
      <li><strong>Used:</strong> ${remainingMb} MB</li>
      <li><strong>Files:</strong> ${remainingFiles.toLocaleString()}</li>
      <li><strong>Oldest remaining:</strong> ${oldestRemaining ?? "n/a"}</li>
      <li><strong>Deleted this run:</strong> ${totalDeleted} (older than ${RETENTION_DAYS} days)</li>
    </ul>
    <p>Next options if usage keeps climbing:</p>
    <ol>
      <li>Lower retention from ${RETENTION_DAYS} days to e.g. 60.</li>
      <li>Upgrade Supabase to Pro ($25/mo, 100 GB).</li>
      <li>Manually purge inactive users.</li>
    </ol>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [ALERT_TO],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("storage-cleanup: resend error", res.status, body);
    return false;
  }
  return true;
}
