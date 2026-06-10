// supabase/functions/user-spend-summary/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  const supabase = createClient(getSupabaseUrl(), getSecretKey());
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Authentication failed" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  // BYOK usage events this month
  const { data: monthRows } = await supabase
    .from("ai_usage_events")
    .select("provider, cost_estimate_usd, total_tokens, cost_known")
    .eq("user_id", user.id)
    .eq("paid_by", "user")
    .gte("created_at", monthStart.toISOString());

  // BYOK usage events lifetime
  const { data: lifetimeRows } = await supabase
    .from("ai_usage_events")
    .select("provider, cost_estimate_usd, total_tokens, cost_known")
    .eq("user_id", user.id)
    .eq("paid_by", "user");

  // Audit counts
  const { count: auditsCount } = await supabase
    .from("audits").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  const { count: erroredCount } = await supabase
    .from("audits").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("status", "failed");
  const { count: trialCount } = await supabase
    .from("audits").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("paid_by", "platform");

  type Row = { provider: string; cost_estimate_usd: number; total_tokens: number; cost_known: boolean };
  function aggregate(rows: Row[] | null) {
    const byProvider: Record<string, { usd: number; tokens: number; costKnown: boolean }> = {};
    let totalUsd = 0;
    for (const r of rows ?? []) {
      const key = r.provider;
      byProvider[key] = byProvider[key] ?? { usd: 0, tokens: 0, costKnown: true };
      byProvider[key].usd += r.cost_known ? Number(r.cost_estimate_usd) : 0;
      byProvider[key].tokens += Number(r.total_tokens);
      if (!r.cost_known) byProvider[key].costKnown = false;
      totalUsd += r.cost_known ? Number(r.cost_estimate_usd) : 0;
    }
    return { byProvider, totalUsd };
  }

  return new Response(JSON.stringify({
    month: aggregate(monthRows as Row[] | null),
    lifetime: aggregate(lifetimeRows as Row[] | null),
    audits: {
      total: auditsCount ?? 0,
      errored: erroredCount ?? 0,
      trial: trialCount ?? 0,
      byok: Math.max(0, (auditsCount ?? 0) - (erroredCount ?? 0) - (trialCount ?? 0)),
    },
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
