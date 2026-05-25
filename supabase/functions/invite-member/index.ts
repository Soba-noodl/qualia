import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { inviteEmail } from "../_shared/email-templates.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSecretKey();

    // Verify caller JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const body = await req.json() as { org_id?: string; email?: string };
    const orgId = typeof body.org_id === "string" ? body.org_id.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!orgId || !email) {
      return new Response(
        JSON.stringify({ error: "Missing org_id or email" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Basic email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Verify caller is the org owner
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, owner_id")
      .eq("id", orgId)
      .eq("owner_id", user.id)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organization not found or you are not the owner" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Generate 32-byte hex token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const inviteToken = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Invite expires in 7 days
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Upsert pending invite (conflict on org_id + invited_email)
    const { error: upsertError } = await supabase
      .from("org_members")
      .upsert(
        {
          org_id: orgId,
          invited_email: email,
          status: "pending",
          role: "member",
          invite_token: inviteToken,
          invite_expires_at: inviteExpiresAt,
          user_id: null,
        },
        { onConflict: "org_id,invited_email" }
      );

    if (upsertError) {
      console.error("upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invite" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Send invite email via Resend
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 503, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const publicAppUrl = Deno.env.get("APP_URL") || "https://qualia-ux.com";
    const acceptUrl = `${publicAppUrl}/accept-invite?token=${inviteToken}`;
    const from = Deno.env.get("RESEND_FROM_EMAIL") || "Qualia Contact <onboarding@resend.dev>";

    const html = inviteEmail({ orgName: org.name, acceptUrl });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `You've been invited to join ${org.name} on Qualia`,
        html,
      }),
    });

    const resendData = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error("Resend error:", resendRes.status, resendData);
      return new Response(
        JSON.stringify({ error: "Failed to send invite email" }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("invite-member error:", err);
    await logErrorEvent({
      source: "edge_function",
      context: "invite-member",
      errorCode: "internal_error",
      errorMessage: err instanceof Error ? err.message : "unknown",
    });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

