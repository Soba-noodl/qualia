import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { logErrorEvent } from "../_shared/log-error.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

// Service-role client at module scope (does not use user auth — safe to reuse across requests)
const serviceClient = createClient(getSupabaseUrl(), getSecretKey());

function isPrivateHostname(hostname: string): boolean {
  const privatePatterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,          // link-local / AWS metadata
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
    /^0\./,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // CGNAT
    /\.local$/i,                                    // mDNS hostnames
  ];
  return privatePatterns.some((re) => re.test(hostname));
}

async function triggerGithubActions(auditId: string): Promise<void> {
  const githubPat = Deno.env.get("GITHUB_PAT");
  const githubRepo = Deno.env.get("GITHUB_REPO");
  if (!githubPat || !githubRepo) {
    console.error("GITHUB_PAT or GITHUB_REPO not configured — crawl will not start");
    return;
  }
  const ghResponse = await fetch(
    `https://api.github.com/repos/${githubRepo}/actions/workflows/auto-crawl.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubPat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { audit_id: auditId } }),
    }
  );
  if (!ghResponse.ok) {
    const body = await ghResponse.text();
    console.error("GitHub dispatch failed:", ghResponse.status, body);
    await logErrorEvent({
      source: "edge_function",
      context: "crawl-request",
      errorCode: "github_dispatch_failed",
      errorMessage: `HTTP ${ghResponse.status}`,
    });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getPublishableKey();

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const body = await req.json();

    // Single action:
    // validate -> check quota -> create audit + crawl_job -> trigger GH Actions.
    const { project_id, crawl_url } = body;

    if (!project_id || !crawl_url) {
      return new Response(JSON.stringify({ error: "project_id and crawl_url are required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(crawl_url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL format" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (parsedUrl.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "Only HTTPS URLs are allowed" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const blockedHostnames = ["metadata.google.internal", "169.254.169.254", "169.254.170.2", "localhost"];
    if (
      isPrivateHostname(parsedUrl.hostname) ||
      blockedHostnames.includes(parsedUrl.hostname.toLowerCase())
    ) {
      return new Response(JSON.stringify({ error: "URL is not allowed" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Verify project belongs to user
    const { data: projectRow, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !projectRow) {
      return new Response(JSON.stringify({ error: "Project not found or access denied" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Create audit row in pending state
    const { data: auditRow, error: auditError } = await serviceClient
      .from("audits")
      .insert({
        project_id,
        user_id: user.id,
        screenshot_url: `auto-crawl/${project_id}`,
        screen_context: crawl_url,
        status: "pending",
        ai_report: { analysis_mode: "auto" },
        source: "auto-crawl",
      })
      .select("id")
      .single();

    if (auditError || !auditRow) {
      console.error("Failed to create audit:", auditError);
      return new Response(JSON.stringify({ error: "Failed to create audit" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Create crawl_jobs row
    const { error: jobError } = await serviceClient
      .from("crawl_jobs")
      .insert({
        audit_id: auditRow.id,
        project_id,
        crawl_url,
        steel_session_id: null,
      });

    if (jobError) {
      console.error("Failed to create crawl job:", jobError);
      await serviceClient.from("audits").delete().eq("id", auditRow.id);
      return new Response(JSON.stringify({ error: "Failed to create crawl job" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    await triggerGithubActions(auditRow.id);

    return new Response(
      JSON.stringify({
        audit_id: auditRow.id,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("crawl-request error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
