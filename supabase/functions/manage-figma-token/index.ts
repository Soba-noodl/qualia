import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encrypt } from "../_shared/encryption.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { logErrorEvent } from "../_shared/log-error.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSecretKey();
    const encryptionKey = Deno.env.get("FIGMA_TOKEN_ENCRYPTION_KEY");

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

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const { action, figma_token } = await req.json();

    if (action === "save") {
      if (!figma_token || typeof figma_token !== "string") {
        return new Response(
          JSON.stringify({ error: "Missing figma_token" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      let tokenToStore = figma_token;
      if (encryptionKey) {
        tokenToStore = await encrypt(figma_token, encryptionKey);
      }

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            figma_access_token: tokenToStore,
            has_figma_token: true,
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        console.error("Error saving Figma token:", upsertError);
        return new Response(
          JSON.stringify({ error: "Failed to save token" }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (action === "clear") {
      const { error: clearError } = await supabase
        .from("profiles")
        .update({
          figma_access_token: null,
          has_figma_token: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (clearError) {
        console.error("Error clearing Figma token:", clearError);
        return new Response(
          JSON.stringify({ error: "Failed to clear token" }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'save' or 'clear'." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("manage-figma-token error:", err);
    await logErrorEvent({
      source: "edge_function",
      context: "manage-figma-token",
      errorCode: "internal_error",
      errorMessage: err instanceof Error ? err.message : "unknown",
    });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
