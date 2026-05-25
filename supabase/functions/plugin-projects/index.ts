import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePluginToken, PLUGIN_TOKEN_HEADER } from "../_shared/plugin-token.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  const pluginToken = req.headers.get(PLUGIN_TOKEN_HEADER) || req.headers.get("X-Plugin-Token");
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getSecretKey();
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let userId: string;
  try {
    userId = await validatePluginToken(pluginToken, supabase);
  } catch {
    return new Response(
      JSON.stringify({ error: "TOKEN_INVALID", message: "Invalid or expired plugin token." }),
      { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  // Personal projects (owned by user, no org)
  const { data: personalProjects, error: personalError } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      mission,
      persona,
      constraints,
      language,
      scope,
      product_name,
      global_mission,
      org_id,
      project_personas ( name, description )
    `)
    .eq("user_id", userId)
    .is("org_id", null)
    .order("created_at", { ascending: false });

  if (personalError) {
    console.error("plugin-projects personal query error:", personalError);
    return new Response(
      JSON.stringify({ error: "Failed to load projects." }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  // Team projects: orgs the user is an active member of OR owns directly.
  // Owner is not automatically inserted into org_members on creation, so we
  // check both tables — same fallback pattern as getMyOrganization() in the web app.
  const [{ data: memberships }, { data: ownedOrgs }] = await Promise.all([
    supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", userId),
  ]);

  const memberOrgIds = (memberships ?? []).map((m: { org_id: string }) => m.org_id);
  const ownedOrgIds = (ownedOrgs ?? []).map((o: { id: string }) => o.id);
  const orgIds = [...new Set([...memberOrgIds, ...ownedOrgIds])];

  let teamProjects: typeof personalProjects = [];
  if (orgIds.length > 0) {
    const { data: tp } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        mission,
        persona,
        constraints,
        language,
        scope,
        product_name,
        global_mission,
        org_id,
        project_personas ( name, description )
      `)
      .in("org_id", orgIds)
      .order("created_at", { ascending: false });
    teamProjects = tp ?? [];
  }

  const allProjects = [...(personalProjects ?? []), ...(teamProjects ?? [])];

  const list = allProjects.map((p: Record<string, unknown>) => {
    const personas = (p.project_personas as Array<{ name: string; description: string }>) || [];
    const { project_personas: _, ...rest } = p;
    return {
      ...rest,
      personas: personas.map(({ name, description }) => ({ name, description })),
    };
  });

  // Daily-cap quota removed (BYOK shipped). Emit a stub so the plugin field is
  // still present for backward compat; isUnlimited=true signals no cap.
  const quota = { count: 0, limit: 9999, remaining: 9999, isAdmin: false, isUnlimited: true };

  return new Response(
    JSON.stringify({ projects: list, quota }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
});
