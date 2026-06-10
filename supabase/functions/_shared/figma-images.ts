/**
 * Shared logic: fetch a single Figma node as PNG and upload to Supabase Storage.
 * Used by fetch-figma-snapshot and plugin-analyze.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type FigmaAuth = { headerName: string; headerValue: string };

/** Normalize node ID for Figma API: hyphens to colons, strip leading slash. */
export function normalizeNodeIdForApi(nodeId: string): string {
  let id = nodeId.trim().replace(/^\//, "");
  id = id.replace(/-/g, ":");
  return id;
}

/**
 * Fetch one node's image from Figma and upload to Supabase Storage.
 * Returns the signed URL and storage path for use in audit.
 */
export async function fetchFigmaImageAndUpload(
  fileKey: string,
  nodeId: string,
  userId: string,
  figmaAuth: FigmaAuth,
  supabase: SupabaseClient
): Promise<{ imageUrl: string; storagePath: string }> {
  const apiNodeId = normalizeNodeIdForApi(nodeId);
  const figmaApiUrl = `https://api.figma.com/v1/images/${fileKey}?format=png&scale=2&ids=${encodeURIComponent(apiNodeId)}`;

  const figmaResponse = await fetch(figmaApiUrl, {
    headers: { [figmaAuth.headerName]: figmaAuth.headerValue },
  });

  // Log Figma rate-limit headers for debugging
  const rateLimitHeaders: Record<string, string> = {};
  for (const [key, value] of figmaResponse.headers.entries()) {
    if (key.startsWith("x-ratelimit") || key.startsWith("x-figma") || key === "retry-after") {
      rateLimitHeaders[key] = value;
    }
  }
  console.log("Figma API response headers:", JSON.stringify({ status: figmaResponse.status, nodeId: apiNodeId, rateLimitHeaders }));

  if (!figmaResponse.ok) {
    const errText = await figmaResponse.text();
    throw new Error(`Figma API error ${figmaResponse.status}: ${errText}`);
  }

  const figmaData = await figmaResponse.json();
  const images = figmaData.images || {};
  const imageUrls = Object.values(images) as string[];
  if (imageUrls.length === 0 || !imageUrls[0]) {
    throw new Error("Figma did not return an image for this node.");
  }

  const imageResponse = await fetch(imageUrls[0]);
  if (!imageResponse.ok) {
    throw new Error("Failed to download image from Figma CDN.");
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const timestamp = Date.now();
  const randomId = crypto.randomUUID().slice(0, 8);
  const filename = `figma-${fileKey}-${apiNodeId.replace(/:/g, "-")}-${timestamp}-${randomId}.png`;
  const filePath = `${userId}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("screenshots")
    .upload(filePath, imageBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("screenshots")
    .createSignedUrl(filePath, 60 * 60);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error("Failed to create signed URL for uploaded image.");
  }

  return { imageUrl: signedUrlData.signedUrl, storagePath: filePath };
}

/**
 * Fetch multiple nodes in one Figma API call, then download and upload each to storage.
 * Returns results in the same order as nodeIds. Uses one Tier 1 request instead of N.
 */
export async function fetchFigmaImagesAndUploadBatch(
  fileKey: string,
  nodeIds: string[],
  userId: string,
  figmaAuth: FigmaAuth,
  supabase: SupabaseClient,
  scale: number = 2
): Promise<{ imageUrl: string; storagePath: string }[]> {
  if (nodeIds.length === 0) return [];
  const apiNodeIds = nodeIds.map((id) => normalizeNodeIdForApi(id));
  const idsParam = apiNodeIds.join(",");
  const figmaApiUrl = `https://api.figma.com/v1/images/${fileKey}?format=png&scale=${scale}&ids=${encodeURIComponent(idsParam)}`;

  const figmaExportController = new AbortController();
  const figmaExportTimeout = setTimeout(() => figmaExportController.abort(), 45_000);
  const figmaResponse = await fetch(figmaApiUrl, {
    headers: { [figmaAuth.headerName]: figmaAuth.headerValue },
    signal: figmaExportController.signal,
  }).finally(() => clearTimeout(figmaExportTimeout));

  const rateLimitHeaders: Record<string, string> = {};
  for (const [key, value] of figmaResponse.headers.entries()) {
    if (key.startsWith("x-ratelimit") || key.startsWith("x-figma") || key === "retry-after") {
      rateLimitHeaders[key] = value;
    }
  }
  console.log("Figma API response headers:", JSON.stringify({ status: figmaResponse.status, nodeCount: nodeIds.length, rateLimitHeaders }));

  if (!figmaResponse.ok) {
    const errText = await figmaResponse.text();
    const err = new Error(`Figma API error ${figmaResponse.status}: ${errText}`) as Error & { figma429?: Record<string, unknown> };
    err.figma429 = {
      status: figmaResponse.status,
      statusText: figmaResponse.statusText,
      headers: rateLimitHeaders,
      body: errText,
    };
    throw err;
  }

  const figmaData = await figmaResponse.json();
  const images: Record<string, string> = figmaData.images || {};
  const timestamp = Date.now();

  // Download + upload all images in this chunk in parallel — major speedup vs sequential
  const settled = await Promise.all(
    nodeIds.map(async (_, i) => {
      const apiNodeId = apiNodeIds[i];
      const imageUrlFromFigma = images[apiNodeId];
      if (!imageUrlFromFigma) {
        // Figma returns null for hidden/locked frames — skip silently
        console.log(`[figma-images] skipping node ${apiNodeId}: Figma returned no image (hidden, locked, or unexportable)`);
        return null;
      }
      // Retry the S3 fetch on transient network failures. Figma's
      // figma-alpha-api.s3.us-west-2.amazonaws.com CDN sometimes drops
      // connections mid-transfer ("client error (SendRequest): connection
      // closed before message completed") — without retry, the whole
      // Promise.all rejects and the audit fails. 3 attempts, exponential
      // backoff (1s, 2s).
      let imageResponse: Response | null = null;
      let imageBuffer: ArrayBuffer | null = null;
      let lastErr: unknown = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const cdnController = new AbortController();
        const cdnTimeout = setTimeout(() => cdnController.abort(), 30_000);
        try {
          imageResponse = await fetch(imageUrlFromFigma, { signal: cdnController.signal });
          if (!imageResponse.ok) {
            throw new Error(`Figma CDN returned ${imageResponse.status}`);
          }
          imageBuffer = await imageResponse.arrayBuffer();
          break; // success
        } catch (err) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[figma-images] node ${apiNodeId} fetch attempt ${attempt}/3 failed: ${msg}`);
        } finally {
          clearTimeout(cdnTimeout);
        }
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1000));
      }
      if (!imageBuffer) {
        throw new Error(`Failed to download image from Figma CDN after 3 attempts: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
      }
      // Skip blank/placeholder frames — real screens are never this small.
      // A 194-byte PNG is a 100×100 empty frame; real frames are 50KB+.
      if (imageBuffer.byteLength < 2048) {
        console.log(`[figma-images] skipping node ${apiNodeId}: image too small (${imageBuffer.byteLength} bytes) — likely blank or placeholder frame`);
        return null;
      }
      const randomId = crypto.randomUUID().slice(0, 8);
      const filename = `figma-${fileKey}-${apiNodeId.replace(/:/g, "-")}-${timestamp}-${randomId}.png`;
      const filePath = `${userId}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from("screenshots")
        .upload(filePath, imageBuffer, { contentType: "image/png", upsert: false });
      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("screenshots")
        .createSignedUrl(filePath, 60 * 60);
      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(`Failed to create signed URL for uploaded image: ${signedUrlError?.message ?? "no signedUrl returned"}`);
      }
      return { imageUrl: signedUrlData.signedUrl, storagePath: filePath };
    })
  );

  return settled.filter((r): r is { imageUrl: string; storagePath: string } => r !== null);
}
