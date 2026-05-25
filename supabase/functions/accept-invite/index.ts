import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

function errorResponse(req: Request, _status: number, code: string): Response {
  // Always return 200 so supabase-js exposes the body in `data` (non-2xx causes data: null).
  return new Response(JSON.stringify({ ok: false, error: code }), {
    status: 200,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSecretKey();

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const body = await req.json().catch(() => ({})) as { token?: string };
    const { token } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const svc = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: invite } = await svc
      .from("org_members")
      .select("id, org_id, invited_email, status, invite_expires_at, organizations(name)")
      .eq("invite_token", token)
      .maybeSingle();

    if (!invite) return errorResponse(req, 404, "INVITE_NOT_FOUND");
    if (invite.status !== "pending") return errorResponse(req, 409, "INVITE_ALREADY_USED");
    if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
      return errorResponse(req, 410, "INVITE_EXPIRED");
    }

    let userId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await svc.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) {
        if (user.email !== invite.invited_email) {
          return errorResponse(req, 403, "WRONG_EMAIL");
        }
        userId = user.id;
      }
    }

    if (!userId) {
      const { data: { users } } = await svc.auth.admin.listUsers();
      const match = users.find((u) => u.email === invite.invited_email);
      if (match) userId = match.id;
    }

    if (!userId) return errorResponse(req, 404, "USER_NOT_FOUND");

    const { error } = await svc
      .from("org_members")
      .update({ status: "active", user_id: userId, invite_token: null })
      .eq("id", invite.id);

    if (error) {
      console.error("accept-invite activation error:", error);
      return errorResponse(req, 500, "ACTIVATION_FAILED");
    }

    const orgName = (invite.organizations as { name?: string } | null)?.name ?? null;
    return new Response(JSON.stringify({ ok: true, org_id: invite.org_id, org_name: orgName }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("accept-invite error:", err);
    await logErrorEvent({
      source: "edge_function",
      context: "accept-invite",
      errorCode: "internal_error",
      errorMessage: err instanceof Error ? err.message : "unknown",
    });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
