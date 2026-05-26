import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
const BUCKETS = ["screenshots", "context-documents"];

// Service-role client at module scope (does not use user auth — safe to reuse across requests)
const supabase = createClient(getSupabaseUrl(), getSecretKey());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  // Require auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing auth" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Verify caller is admin
  const anonClient = createClient(getSupabaseUrl(), getPublishableKey(), {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await anonClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // List all files and generate signed URLs (1 hour expiry)
  const result: Record<string, { path: string; signedUrl: string }[]> = {};

  for (const bucket of BUCKETS) {
    const files = await listAllFiles(supabase, bucket, "");
    const signed: { path: string; signedUrl: string }[] = [];

    // Sign in batches of 50
    for (let i = 0; i < files.length; i += 50) {
      const batch = files.slice(i, i + 50);
      const { data: urls, error: signErr } = await supabase.storage
        .from(bucket)
        .createSignedUrls(batch, 3600);

      if (!signErr && urls) {
        for (const u of urls) {
          if (u.signedUrl) {
            signed.push({ path: u.path!, signedUrl: u.signedUrl });
          }
        }
      }
    }
    result[bucket] = signed;
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});

async function listAllFiles(
  client: SupabaseClient,
  bucket: string,
  folder: string
): Promise<string[]> {
  const { data, error } = await client.storage
    .from(bucket)
    .list(folder, { limit: 1000 });

  if (error || !data) return [];

  let files: string[] = [];
  for (const item of data) {
    const path = folder ? `${folder}/${item.name}` : item.name;
    if (item.id) {
      files.push(path);
    } else {
      const nested = await listAllFiles(client, bucket, path);
      files = files.concat(nested);
    }
  }
  return files;
}
