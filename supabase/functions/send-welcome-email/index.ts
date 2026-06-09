// supabase/functions/send-welcome-email/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { welcomeEmail } from "../_shared/email-templates.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://qualia-ux.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "Qualia <hello@qualia-ux.com>";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

Deno.serve(async (req) => {
  // Validate shared secret to reject calls that aren't from Supabase webhooks.
  const incomingSecret = req.headers.get("x-webhook-secret");
  if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
  if (tooBig) return tooBig;

  let payload: { record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const audit = payload.record;
  if (!audit) return new Response("No record", { status: 400 });

  const userId = audit.user_id as string;
  const auditId = audit.id as string;
  const projectId = audit.project_id as string;
  const score = audit.overall_score as number | null;
  // ai_report may be null if analysis is still running — handle gracefully below.
  const aiReport = audit.ai_report as Record<string, unknown> | null;

  // Respond to webhook immediately — don't hold it open while we process.
  const responsePromise = handleWelcome({ userId, auditId, projectId, score, aiReport });
  // @ts-expect-error — EdgeRuntime is available in Supabase Deno runtime
  EdgeRuntime.waitUntil(responsePromise);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function handleWelcome(params: {
  userId: string;
  auditId: string;
  projectId: string;
  score: number | null;
  aiReport: Record<string, unknown> | null;
}) {
  const { userId, auditId, projectId, score, aiReport } = params;
  const admin = createClient(getSupabaseUrl(), getSecretKey());

  try {
    // 1. Check if this is the user's first audit.
    const { count } = await admin
      .from("audits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) > 1) return; // not first audit, nothing to do

    // 2. Upsert preferences row (creates with defaults if not exists).
    await admin.from("email_preferences").upsert(
      { user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

    // 3. Check product_updates preference.
    const { data: prefs } = await admin
      .from("email_preferences")
      .select("product_updates, unsubscribe_token")
      .eq("user_id", userId)
      .single();
    if (!prefs?.product_updates) return;

    // 4. Idempotency: check if welcome was already sent successfully.
    const { count: alreadySent } = await admin
      .from("email_sends")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("email_type", "welcome")
      .eq("status", "sent");
    if ((alreadySent ?? 0) > 0) return;

    // 5. Insert pending row before calling Resend.
    const { data: sendRow, error: insertErr } = await admin
      .from("email_sends")
      .insert({ user_id: userId, email_type: "welcome", status: "pending" })
      .select("id")
      .single();
    if (insertErr || !sendRow) {
      console.error("send-welcome-email: failed to insert email_sends row", insertErr);
      return;
    }
    const sendId = sendRow.id as string;

    // 6. Fetch user email from auth.users (requires service role).
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const userEmail = authUser?.user?.email;
    if (!userEmail) {
      await admin.from("email_sends").update({ status: "failed" }).eq("id", sendId);
      console.error("send-welcome-email: no email for user", userId);
      return;
    }

    // 7. Fetch user language preference.
    const { data: profileData } = await admin
      .from("profiles")
      .select("language")
      .eq("user_id", userId)
      .single();
    const lang: "en" | "it" = profileData?.language === "it" ? "it" : "en";

    // 8. Fetch project name for subject line.
    const { data: project } = await admin
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();
    const screenName = (project?.name as string | null) ?? "your screen";

    // 9. Extract top issue from ai_report (may be null or malformed).
    let topIssueName: string | null = null;
    let topIssueDesc: string | null = null;
    try {
      const issues = (aiReport?.issues as Array<{ title?: string; description?: string }> | null) ?? [];
      if (issues.length > 0) {
        topIssueName = issues[0].title ?? null;
        topIssueDesc = issues[0].description ?? null;
      }
    } catch { /* malformed ai_report — fall back to no issue block */ }

    // 10. Build email.
    const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${prefs.unsubscribe_token}`;
    const auditUrl = `${APP_URL}/project/${projectId}`;
    const html = welcomeEmail({
      screenName,
      score: score ?? 0,
      topIssueName,
      topIssueDesc,
      auditUrl,
      unsubscribeUrl,
      lang,
    });

    const subject = topIssueName
      ? `Your ${screenName} scored ${score ?? 0}`
      : `Your first audit is ready`;

    // 11. Send via Resend with idempotency key.
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Idempotency-Key": `welcome-${userId}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [userEmail],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("send-welcome-email: Resend error", resendRes.status, errBody);
      await admin.from("email_sends").update({ status: "failed" }).eq("id", sendId);
      return;
    }

    // 12. Mark as sent.
    await admin.from("email_sends")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", sendId);

  } catch (err) {
    console.error("send-welcome-email: unhandled error", err);
  }
}
