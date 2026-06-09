import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getIntegrationToken } from "../_shared/integration-tokens.ts";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { logErrorEvent } from "../_shared/log-error.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getPublishableKey();
  const serviceKey = getSecretKey();

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authorization required" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
  if (tooBig) return tooBig;

  let body: { file_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    await logErrorEvent({
      source: "edge_function",
      context: "google-drive-fetch",
      errorCode: "internal_error",
    });
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const fileIds = body.file_ids;
  if (!Array.isArray(fileIds) || fileIds.length === 0 || fileIds.length > 5) {
    return new Response(
      JSON.stringify({ error: "file_ids must be an array of 1 to 5 file IDs" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const tokens = await getIntegrationToken(
    serviceClient,
    user.id,
    "google_drive",
    {
      INTEGRATION_ENCRYPTION_KEY: Deno.env.get("INTEGRATION_ENCRYPTION_KEY"),
      GOOGLE_CLIENT_ID: Deno.env.get("GOOGLE_CLIENT_ID"),
      GOOGLE_CLIENT_SECRET: Deno.env.get("GOOGLE_CLIENT_SECRET"),
    }
  );

  if (!tokens) {
    return new Response(
      JSON.stringify({ error: "Google Drive not connected. Please connect your account first." }),
      { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const documents: { id: string; name: string; content: string; error?: string }[] = [];

  for (const fileId of fileIds) {
    try {
      const metaRes = await fetch(
        `${DRIVE_FILES_URL}/${fileId}?fields=name,mimeType`,
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );

      if (!metaRes.ok) {
        if (metaRes.status === 404) {
          documents.push({ id: fileId, name: "(file not found)", content: "", error: "not_found" });
          continue;
        }
        if (metaRes.status === 403) {
          documents.push({ id: fileId, name: "(access denied)", content: "", error: "access_denied" });
          continue;
        }
        // Log status only — Google error body may contain sensitive API details
        console.error("Drive metadata error: status", metaRes.status);
        documents.push({ id: fileId, name: "(fetch failed)", content: "", error: "fetch_failed" });
        continue;
      }

      const meta = await metaRes.json();
      const name = meta.name || "Untitled";
      const mimeType = meta.mimeType || "";

      let content = "";
      if (mimeType === "application/vnd.google-apps.document") {
        const exportRes = await fetch(
          `${DRIVE_FILES_URL}/${fileId}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        if (exportRes.ok) {
          content = await exportRes.text();
        }
      } else if (
        mimeType.startsWith("text/") ||
        mimeType === "application/pdf"
      ) {
        const downloadUrl =
          mimeType === "application/pdf"
            ? `${DRIVE_FILES_URL}/${fileId}?alt=media`
            : `${DRIVE_FILES_URL}/${fileId}?alt=media`;
        const downloadRes = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (downloadRes.ok) {
          content = await downloadRes.text();
        }
      } else {
        const exportRes = await fetch(
          `${DRIVE_FILES_URL}/${fileId}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        if (exportRes.ok) {
          content = await exportRes.text();
        } else {
          const altRes = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (altRes.ok) content = await altRes.text();
        }
      }

      documents.push({ id: fileId, name, content: content.slice(0, 50000) });
    } catch (e) {
      console.error("Drive fetch error for", fileId, e);
      documents.push({ id: fileId, name: "(error)", content: "", error: "fetch_failed" });
    }
  }

  return new Response(JSON.stringify({ documents }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});
