import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePluginToken, PLUGIN_TOKEN_HEADER } from "../_shared/plugin-token.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const pluginToken = req.headers.get(PLUGIN_TOKEN_HEADER) || req.headers.get("X-Plugin-Token");
  const supabase = createClient(getSupabaseUrl(), getSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string;
  try {
    userId = await validatePluginToken(pluginToken, supabase);
  } catch {
    return new Response(
      JSON.stringify({ error: "TOKEN_INVALID" }),
      { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const { data } = await supabase
    .from("profiles")
    .select("language")
    .eq("user_id", userId)
    .single();

  const language: "en" | "it" = data?.language === "it" ? "it" : "en";

  return new Response(
    JSON.stringify({ language }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
  );
});
