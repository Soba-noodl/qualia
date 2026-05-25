import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePluginToken, PLUGIN_TOKEN_HEADER } from "../_shared/plugin-token.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  const pluginToken = req.headers.get(PLUGIN_TOKEN_HEADER) || req.headers.get("X-Plugin-Token");
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getSecretKey();
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string;
  try {
    userId = await validatePluginToken(pluginToken, supabase);
  } catch {
    return new Response(
      JSON.stringify({ error: "TOKEN_INVALID", message: "Invalid or expired plugin token." }),
      { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  let bytes: Uint8Array;
  try {
    const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
    if (contentLength > MAX_UPLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "FILE_TOO_LARGE", message: "Maximum file size is 10 MB." }),
        { status: 413, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const buf = await req.arrayBuffer();
    bytes = new Uint8Array(buf);
  } catch {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "Failed to read image bytes." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  if (bytes.length > MAX_UPLOAD_BYTES) {
    return new Response(
      JSON.stringify({ error: "FILE_TOO_LARGE", message: "Maximum file size is 10 MB." }),
      { status: 413, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  // Validate PNG magic bytes: 89 50 4E 47
  const isPng =
    bytes.length >= 4 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 &&
    bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!isPng) {
    return new Response(
      JSON.stringify({ error: "INVALID_FILE_TYPE", message: "Only PNG images are accepted." }),
      { status: 415, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const contentType = "image/png";

  const timestamp = Date.now();
  const randomId = crypto.randomUUID().slice(0, 8);
  const filename = `plugin-${userId}-${timestamp}-${randomId}.png`;
  const filePath = `${userId}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("screenshots")
    .upload(filePath, bytes, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error("plugin-upload-image upload error:", uploadError);
    return new Response(
      JSON.stringify({ error: "Image upload failed. Please try again." }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("screenshots")
    .createSignedUrl(filePath, 60 * 60);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error("plugin-upload-image signed URL error:", signedUrlError);
    return new Response(
      JSON.stringify({ error: "SIGNED_URL_FAILED", message: "Failed to create signed URL." }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ imageUrl: signedUrlData.signedUrl, storagePath: filePath }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
});

