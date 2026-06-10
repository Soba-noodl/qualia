import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  parseFigmaApiError, 
  createErrorResponse, 
  FigmaErrorCodes,
  type FigmaErrorResponse 
} from "../_shared/figma-errors.ts";
import { checkUserQuota } from "../_shared/quota-check.ts";
import { pruneFigmaNodesResponse } from "../_shared/figma-prune.ts";
import { getFigmaToken } from "../_shared/figma-token.ts";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { logErrorEvent } from "../_shared/log-error.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { parseFigmaUrl } from "../_shared/figma-url.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
interface FigmaRequest {
  figmaUrl: string;
  includeMetadata?: boolean;
  /** @deprecated Legacy field; ignored by OAuth flow */
  tempToken?: string;
  /** @deprecated Legacy field; ignored by OAuth flow */
  saveToken?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Missing authorization header" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getPublishableKey();
    const supabaseServiceKey = getSecretKey();

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Invalid token" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    const quotaCheck = await checkUserQuota(serviceClient, userId);
    if (!quotaCheck.allowed) {
      console.log(`User ${userId} quota exceeded: ${quotaCheck.currentCount}/${quotaCheck.limit}`);
      const error: FigmaErrorResponse = {
        success: false,
        error: FigmaErrorCodes.QUOTA_EXCEEDED,
        message: "Daily audit limit reached. Your limit resets at midnight (Europe/Rome). Upgrade for unlimited access.",
      };
      return createErrorResponse(error, getCorsHeaders(req));
    }

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const body: FigmaRequest = await req.json();
    const { figmaUrl, includeMetadata } = body;

    if (!figmaUrl) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "figmaUrl is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const parsed = parseFigmaUrl(figmaUrl);
    if (!parsed) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid Figma URL", 
          message: "Could not parse the Figma URL. Please use a valid Figma file or frame link." 
        }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { fileKey, nodeId } = parsed;

    // =========== Token Retrieval: OAuth first, legacy PAT fallback ===========
    const figmaAuth = await getFigmaToken(serviceClient, userId, {
      INTEGRATION_ENCRYPTION_KEY: Deno.env.get("INTEGRATION_ENCRYPTION_KEY"),
      FIGMA_CLIENT_ID: Deno.env.get("FIGMA_CLIENT_ID"),
      FIGMA_CLIENT_SECRET: Deno.env.get("FIGMA_CLIENT_SECRET"),
      FIGMA_TOKEN_ENCRYPTION_KEY: Deno.env.get("FIGMA_TOKEN_ENCRYPTION_KEY"),
    });

    if (!figmaAuth) {
      const error: FigmaErrorResponse = {
        success: false,
        error: FigmaErrorCodes.TOKEN_EXPIRED,
        message: "No Figma token found. Please connect your Figma account.",
      };
      return new Response(JSON.stringify(error), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // =========== Call Figma API ===========
    let figmaApiUrl = `https://api.figma.com/v1/images/${fileKey}?format=png&scale=2`;
    if (nodeId) {
      figmaApiUrl += `&ids=${encodeURIComponent(nodeId)}`;
    }

    console.log("Calling Figma API:", figmaApiUrl);

    const figmaResponse = await fetch(figmaApiUrl, {
      headers: {
        [figmaAuth.headerName]: figmaAuth.headerValue,
      },
    });

    if (!figmaResponse.ok) {
      // Step 2: Parse the specific Figma error
      const figmaError = await parseFigmaApiError(figmaResponse);
      console.error(`Figma API error: ${figmaResponse.status} - ${figmaError.error}`);
      return createErrorResponse(figmaError, getCorsHeaders(req));
    }

    const figmaData = await figmaResponse.json();

    // Extract image URL from response
    // Response format: { images: { "nodeId": "url" } } or { images: { "0:0": "url" } }
    const images = figmaData.images || {};
    const imageUrls = Object.values(images) as string[];
    // Privacy: log structural signal only (count, not URLs or node IDs).
    console.info(`[fetch-figma-snapshot] received images count=${imageUrls.length}`);

    if (imageUrls.length === 0 || !imageUrls[0]) {
      return new Response(
        JSON.stringify({ 
          error: "No Image", 
          message: "Figma did not return an image for this selection. Try selecting a different frame or element." 
        }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const figmaImageUrl = imageUrls[0];
    // Privacy: do not log the signed CDN URL (it grants temporary read access).

    // Download the image from Figma's CDN
    const imageResponse = await fetch(figmaImageUrl);
    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: "Download Failed", 
          message: "Failed to download the image from Figma. Please try again." 
        }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const filename = `figma-${fileKey}-${nodeId || "full"}-${timestamp}-${randomId}.png`;
    const filePath = `${userId}/${filename}`;

    console.log("Uploading to Supabase Storage:", filePath);

    // Upload to Supabase Storage (screenshots bucket)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("screenshots")
      .upload(filePath, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ 
          error: "Upload Failed", 
          message: "Failed to save the image. Please try again." 
        }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Get signed URL for the uploaded image
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("screenshots")
      .createSignedUrl(filePath, 60 * 60); // 1 hour

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Signed URL error:", signedUrlError);
      return new Response(
        JSON.stringify({ 
          error: "URL Generation Failed", 
          message: "Failed to generate access URL for the image." 
        }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully uploaded Figma snapshot");

    let figmaNodeSummary: unknown = undefined;
    if (includeMetadata && nodeId) {
      try {
        // Figma REST API: GET /v1/files/:key with ids (not /files/:key/nodes)
        const fileNodesUrl = `https://api.figma.com/v1/files/${fileKey}?ids=${encodeURIComponent(nodeId)}&depth=5`;
        const nodesResponse = await fetch(fileNodesUrl, {
          headers: { [figmaAuth.headerName]: figmaAuth.headerValue },
        });
        if (nodesResponse.ok) {
          const nodesData = await nodesResponse.json();
          figmaNodeSummary = pruneFigmaNodesResponse(nodesData);
        } else {
          console.warn("Figma file/nodes request failed:", nodesResponse.status, "continuing without metadata");
        }
      } catch (nodesErr) {
        console.warn("Figma file/nodes fetch error:", nodesErr, "continuing without metadata");
      }
    }

    const responsePayload: Record<string, unknown> = {
      success: true,
      imageUrl: signedUrlData.signedUrl,
      storagePath: filePath,
      fileKey,
      nodeId,
    };
    if (figmaNodeSummary != null) {
      responsePayload.figmaNodeSummary = figmaNodeSummary;
    }

    return new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    await logErrorEvent({
      source: "edge_function",
      context: "fetch-figma-snapshot",
      errorCode: "internal_error",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
    return new Response(
      JSON.stringify({
        error: "An internal error occurred."
      }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
