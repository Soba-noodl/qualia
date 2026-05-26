// supabase/functions/storage-cleanup/index.ts
//
// Recurring storage maintenance for user-data buckets:
//   - `screenshots`     — original uploads keyed by `<userId>/...`.
//   - `showcase-screens` — operator-managed showcase media. INTENTIONALLY
//                          SKIPPED — these are not user uploads and have no
//                          90-day retention obligation.
//
// Behavior:
// 1. Deletes screenshots older than RETENTION_DAYS.
// 2. Recomputes total `screenshots` bucket size + file count.
// 3. If usage exceeds ALERT_THRESHOLD_PCT of the free-tier 1 GB cap, sends a
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
    remaining_files: remainingFiles,
    remaining_bytes: remainingBytes,
    remaining_mb: remainingMb,
    usage_pct: usagePct,
    oldest_remaining: stats.oldest,
    alert_sent: alertSent,
  };
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
