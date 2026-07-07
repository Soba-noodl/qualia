// supabase/functions/plugin-byok-status/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePluginToken, PLUGIN_TOKEN_HEADER } from "../_shared/plugin-token.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { DEFAULT_MODEL_BY_PROVIDER, type LLMProvider } from "../_shared/llm/pricing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

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
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: keys } = await supabase.from("user_llm_keys_safe")
    .select("provider, model_override, last_used_at, last_test_status")
    .eq("user_id", userId);
  const { data: profile } = await supabase.from("profiles")
    .select("default_llm_provider, free_analysis_used_at").eq("user_id", userId).maybeSingle();

  // Plugin is webapp-trial-only: free trial is consumed on web only.
  // Plugin users without keys see no_key, not trial_available.
  if (!keys || keys.length === 0) {
    return new Response(JSON.stringify({
      hasKey: false,
      trialAvailable: false,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const defaultProvider = profile?.default_llm_provider as LLMProvider | undefined;
  const pickedKey = defaultProvider
    ? (keys.find((k) => k.provider === defaultProvider) ?? keys[0])
    : keys[0];

  return new Response(JSON.stringify({
    hasKey: true,
    provider: pickedKey.provider,
    model: pickedKey.model_override ?? DEFAULT_MODEL_BY_PROVIDER[pickedKey.provider as LLMProvider],
    lastUsedAt: pickedKey.last_used_at,
    keyStatus: pickedKey.last_test_status,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
