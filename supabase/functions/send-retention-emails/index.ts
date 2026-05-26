// supabase/functions/send-retention-emails/index.ts

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { welcomeEmail, reengagementEmail, digestEmail } from "../_shared/email-templates.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://qualia-ux.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "Qualia <hello@qualia-ux.com>";
const RETENTION_CRON_SECRET = Deno.env.get("RETENTION_CRON_SECRET") ?? "";

Deno.serve((req) => {
  const auth = req.headers.get("Authorization");
  if (!RETENTION_CRON_SECRET || auth !== `Bearer ${RETENTION_CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createClient(getSupabaseUrl(), getSecretKey());

  // @ts-expect-error — EdgeRuntime is available in Supabase Deno runtime
  EdgeRuntime.waitUntil(runRetentionEmails(admin));

  return new Response(JSON.stringify({ ok: true, message: "processing in background" }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});

async function runRetentionEmails(admin: SupabaseClient) {
  try {
    // Retry any welcome emails that failed or got stuck as pending (>1h old).
    // This recovers from DB webhook delivery failures.
    await retryFailedWelcomes(admin);

    // Get distinct user_ids that have at least one audit.
    const { data: rows } = await admin
      .from("audits")
      .select("user_id")
      .throwOnError();

    if (!rows || rows.length === 0) return;

    const userIds = [...new Set(rows.map((r: { user_id: string }) => r.user_id))];

    for (const userId of userIds) {
      try {
        await processUser(admin, userId);
      } catch (err) {
        // Never let one user's error abort the whole run.
        console.error(`send-retention-emails: error processing user ${userId}:`, err);
      }
    }
  } catch (err) {
    console.error("send-retention-emails: fatal error in runRetentionEmails:", err);
  }
}

/** Retries welcome emails that failed or got stuck as pending (>1h old). */
async function retryFailedWelcomes(admin: SupabaseClient) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: stale } = await admin
    .from("email_sends")
    .select("user_id")
    .eq("email_type", "welcome")
    .in("status", ["failed", "pending"])
    .lt("created_at", oneHourAgo);

  if (!stale || stale.length === 0) return;

  for (const row of stale as { user_id: string }[]) {
    const userId = row.user_id;

    // Delete stale row so the welcome function can insert a fresh one.
    await admin
      .from("email_sends")
      .delete()
      .eq("user_id", userId)
      .eq("email_type", "welcome")
      .in("status", ["failed", "pending"]);

    // Check preferences.
    const { data: prefs } = await admin
      .from("email_preferences")
      .select("product_updates, unsubscribe_token")
      .eq("user_id", userId)
      .single();
    if (!prefs?.product_updates) continue;

    // Fetch the user's first audit (chronologically).
    const { data: firstAudit } = await admin
      .from("audits")
      .select("id, project_id, overall_score, ai_report, screen_context")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    if (!firstAudit) continue;

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const userEmail = authUser?.user?.email;
    if (!userEmail) continue;

    const { data: profileData } = await admin
      .from("profiles")
      .select("language")
      .eq("user_id", userId)
      .single();
    const lang: "en" | "it" = profileData?.language === "it" ? "it" : "en";

    const { data: project } = await admin
      .from("projects")
      .select("name")
      .eq("id", firstAudit.project_id)
      .single();

    const screenName = (project?.name as string | null) ?? "your screen";
    let topIssueName: string | null = null;
    let topIssueDesc: string | null = null;
    try {
      const issues = ((firstAudit.ai_report as { issues?: Array<{ title?: string; description?: string }> } | null)?.issues) ?? [];
      if (issues.length > 0) { topIssueName = issues[0].title ?? null; topIssueDesc = issues[0].description ?? null; }
    } catch { /* fall through */ }

    const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${prefs.unsubscribe_token}`;
    const html = welcomeEmail({
      screenName,
      score: firstAudit.overall_score as number ?? 0,
      topIssueName,
      topIssueDesc,
      auditUrl: `${APP_URL}/project/${firstAudit.project_id}`,
      unsubscribeUrl,
      lang,
    });
    const subject = topIssueName ? `Your ${screenName} scored ${firstAudit.overall_score ?? 0}` : "Your first audit is ready";

    await sendEmail(admin, userId, "welcome", userEmail, subject, html, `welcome-${userId}`);
  }
}

async function processUser(admin: SupabaseClient, userId: string) {
  // 1. Upsert preferences.
  await admin.from("email_preferences").upsert(
    { user_id: userId },
    { onConflict: "user_id", ignoreDuplicates: true }
  );

  const { data: prefs } = await admin
    .from("email_preferences")
    .select("product_updates, activity_digest, unsubscribe_token")
    .eq("user_id", userId)
    .single();
  if (!prefs) return;

  // 2. Global frequency cap: skip if any email sent in last 3 days.
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentSends } = await admin
    .from("email_sends")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "sent")
    .gte("sent_at", threeDaysAgo);
  if ((recentSends ?? 0) > 0) return;

  // 3. Fetch user language preference.
  const { data: profileData } = await admin
    .from("profiles")
    .select("language")
    .eq("user_id", userId)
    .single();
  const lang: "en" | "it" = profileData?.language === "it" ? "it" : "en";

  // 4. Fetch user email.
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email;
  if (!userEmail) return;

  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${prefs.unsubscribe_token}`;
  const dashboardUrl = `${APP_URL}/dashboard`;

  // 5. Try digest first (priority over re-engagement).
  if (prefs.activity_digest) {
    const sent = await tryDigest(admin, userId, userEmail, unsubscribeUrl, lang);
    if (sent) return;
  }

  // 6. Try re-engagement.
  if (prefs.product_updates) {
    await tryReengagement(admin, userId, userEmail, unsubscribeUrl, dashboardUrl, lang);
  }
}

/** Returns true if a digest was sent. */
async function tryDigest(
  admin: SupabaseClient,
  userId: string,
  userEmail: string,
  unsubscribeUrl: string,
  lang: "en" | "it",
): Promise<boolean> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Require 2+ audits in the last 14 days.
  const { count: recentAuditCount } = await admin
    .from("audits")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", fourteenDaysAgo);
  if ((recentAuditCount ?? 0) < 2) return false;

  // No digest sent in the last 7 days.
  const { count: recentDigest } = await admin
    .from("email_sends")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("email_type", "digest")
    .eq("status", "sent")
    .gte("sent_at", sevenDaysAgo);
  if ((recentDigest ?? 0) > 0) return false;

  // Fetch current week audits (last 7 days).
  const { data: currentWeekAudits } = await admin
    .from("audits")
    .select("id, overall_score, project_id, ai_report, screen_context, projects(name)")
    .eq("user_id", userId)
    .gte("created_at", sevenDaysAgo)
    .not("overall_score", "is", null)
    .order("created_at", { ascending: false });

  if (!currentWeekAudits || currentWeekAudits.length === 0) return false;

  // Fetch previous week audits (7-14 days ago) for delta.
  const { data: prevWeekAudits } = await admin
    .from("audits")
    .select("overall_score")
    .eq("user_id", userId)
    .gte("created_at", fourteenDaysAgo)
    .lt("created_at", sevenDaysAgo)
    .not("overall_score", "is", null);

  const currentAvg = Math.round(
    currentWeekAudits.reduce((sum: number, a: { score: number }) => sum + a.overall_score, 0) / currentWeekAudits.length
  );
  const scoreDelta = (prevWeekAudits && prevWeekAudits.length > 0)
    ? currentAvg - Math.round(
        prevWeekAudits.reduce((sum: number, a: { score: number }) => sum + a.overall_score, 0) / prevWeekAudits.length
      )
    : null;

  // Lowest scoring audit this week.
  const lowest = [...currentWeekAudits].sort((a: { score: number }, b: { score: number }) => a.overall_score - b.overall_score)[0];
  const lowestProjectName = (lowest.projects as { name?: string } | null)?.name ?? null;
  const lowestScreenName = friendlyScreenName(lowestProjectName, lowest.screen_context as string | null) ?? "Latest screen";
  const lowestIssueCount = (() => {
    try {
      const issues = (lowest.ai_report as { issues?: unknown[] } | null)?.issues ?? [];
      return Array.isArray(issues)
        ? issues.filter((i: unknown) => (i as { severity?: string }).severity === "critical").length
        : 0;
    } catch { return 0; }
  })();

  const reauditUrl = `${APP_URL}/project/${lowest.project_id}`;

  const html = digestEmail({
    auditCount: currentWeekAudits.length,
    avgScore: currentAvg,
    scoreDelta,
    lowestScreenName,
    lowestScore: lowest.overall_score,
    lowestIssueCount,
    reauditUrl,
    unsubscribeUrl,
    lang,
  });

  const subject = `Your week in Qualia: ${currentWeekAudits.length} audit${currentWeekAudits.length !== 1 ? "s" : ""}, avg score ${currentAvg}`;

  return sendEmail(admin, userId, "digest", userEmail, subject, html, `digest-${userId}-${sevenDaysAgo.slice(0, 10)}`);
}

async function tryReengagement(
  admin: SupabaseClient,
  userId: string,
  userEmail: string,
  unsubscribeUrl: string,
  dashboardUrl: string,
  lang: "en" | "it",
) {
  const lastActiveAt = await getLastActiveAt(admin, userId);
  if (!lastActiveAt) return; // no activity at all (shouldn't happen since we filter by audits)

  const now = Date.now();
  const lastActiveMs = new Date(lastActiveAt).getTime();
  const hoursSinceActive = (now - lastActiveMs) / (1000 * 60 * 60);

  if (hoursSinceActive < 48) return; // still active recently, no re-engagement needed

  // Fetch the most recent sent re-engagement emails in chronological order.
  const { data: sentEmails } = await admin
    .from("email_sends")
    .select("email_type, sent_at")
    .eq("user_id", userId)
    .in("email_type", ["reengagement_1", "reengagement_2", "reengagement_3"])
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(3);

  const latestStep = (sentEmails ?? []).find(
    (e: { email_type: string; sent_at: string }) =>
      new Date(e.sent_at) > new Date(lastActiveAt)
  );

  if (!latestStep) {
    // No re-engagement sent in this inactivity cycle. Send #1.
    const { data: recentAudit } = await admin
      .from("audits")
      .select("overall_score, project_id, screen_context, projects(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const recentProjectName = (recentAudit?.projects as { name?: string } | null)?.name ?? null;
    const screenName = friendlyScreenName(recentProjectName, recentAudit?.screen_context as string | null) ?? "your latest screen";
    const projectUrl = recentAudit?.project_id ? `${APP_URL}/project/${recentAudit.project_id}` : dashboardUrl;
    const html = reengagementEmail({ step: 1, screenName, score: recentAudit?.overall_score ?? undefined, projectUrl, dashboardUrl, unsubscribeUrl, appUrl: APP_URL, lang });
    const subject = "What did you change after your audit?";
    await sendEmail(admin, userId, "reengagement_1", userEmail, subject, html, `reeng1-${userId}-${lastActiveAt.slice(0, 10)}`);
    return;
  }

  const daysSinceLatest = (now - new Date(latestStep.sent_at).getTime()) / (1000 * 60 * 60 * 24);

  if (latestStep.email_type === "reengagement_1" && daysSinceLatest >= 7) {
    const html = reengagementEmail({ step: 2, dashboardUrl, unsubscribeUrl, appUrl: APP_URL, lang });
    const subject = "Your designs have probably changed since your last audit";
    await sendEmail(admin, userId, "reengagement_2", userEmail, subject, html, `reeng2-${userId}-${latestStep.sent_at.slice(0, 10)}`);
    return;
  }

  if (latestStep.email_type === "reengagement_2" && daysSinceLatest >= 14) {
    const html = reengagementEmail({ step: 3, dashboardUrl, unsubscribeUrl, appUrl: APP_URL, lang });
    const subject = "Still useful to you?";
    await sendEmail(admin, userId, "reengagement_3", userEmail, subject, html, `reeng3-${userId}-${latestStep.sent_at.slice(0, 10)}`);
    return;
  }

  // reengagement_3 already sent and enough time has passed — cycle resets naturally
  // on the next 48h inactivity window (latestStep will be before lastActiveAt).
}

async function getLastActiveAt(admin: SupabaseClient, userId: string): Promise<string | null> {
  const [audits, feedback, projects] = await Promise.all([
    admin.from("audits").select("created_at").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(1).single(),
    admin.from("audit_issue_feedback")
      .select("created_at, audit_id, audits!inner(user_id)")
      .eq("audits.user_id", userId)
      .order("created_at", { ascending: false }).limit(1).single(),
    admin.from("projects").select("created_at").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(1).single(),
  ]);

  const candidates = [
    audits.data?.created_at,
    feedback.data?.created_at,
    projects.data?.created_at,
  ].filter(Boolean) as string[];

  if (candidates.length === 0) return null;
  return candidates.sort().reverse()[0];
}

/** Prefers project name; falls back to screen_context only if it isn't a URL or a long blob. */
function friendlyScreenName(projectName: string | null, screenContext: string | null): string | null {
  if (projectName && projectName.trim().length > 0) return projectName.trim();
  if (!screenContext) return null;
  const trimmed = screenContext.trim();
  if (/^https?:\/\//i.test(trimmed)) return null;
  if (trimmed.length > 60) return null;
  return trimmed;
}

/** Sends one email via Resend and logs the result to email_sends. Returns true on success. */
async function sendEmail(
  admin: SupabaseClient,
  userId: string,
  emailType: string,
  to: string,
  subject: string,
  html: string,
  idempotencyKey: string,
): Promise<boolean> {
  const { data: sendRow, error: insertErr } = await admin
    .from("email_sends")
    .insert({ user_id: userId, email_type: emailType, status: "pending" })
    .select("id")
    .single();

  if (insertErr || !sendRow) {
    console.error(`sendEmail: failed to insert email_sends row for ${emailType}:`, insertErr);
    return false;
  }

  const sendId = sendRow.id as string;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`sendEmail: Resend error for ${emailType}:`, res.status, err);
    await admin.from("email_sends").update({ status: "failed" }).eq("id", sendId);
    return false;
  }

  await admin.from("email_sends")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", sendId);

  return true;
}
