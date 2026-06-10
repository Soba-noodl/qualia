import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  parseFigmaApiError, 
  createErrorResponse, 
  FigmaErrorCodes,
  type FigmaErrorResponse 
} from "../_shared/figma-errors.ts";
import { checkUserQuota } from "../_shared/quota-check.ts";
import { getFigmaToken } from "../_shared/figma-token.ts";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { parseFigmaUrl } from "../_shared/figma-url.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
interface FigmaFlowRequest {
  figmaUrl: string;
  /** @deprecated Legacy field; ignored by OAuth flow */
  tempToken?: string;
  /** @deprecated Legacy field; ignored by OAuth flow */
  saveToken?: boolean;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children?: FigmaNode[];
}

// Filter nodes to only FRAME, INSTANCE, or COMPONENT types
function filterValidNodes(nodes: FigmaNode[]): FigmaNode[] {
  const validTypes = ["FRAME", "INSTANCE", "COMPONENT"];
  return nodes.filter(node => validTypes.includes(node.type));
}

// Sort nodes by absoluteBoundingBox.x (left to right)
function sortNodesByPosition(nodes: FigmaNode[]): FigmaNode[] {
  return [...nodes].sort((a, b) => {
    const xA = a.absoluteBoundingBox?.x ?? 0;
    const xB = b.absoluteBoundingBox?.x ?? 0;
    return xA - xB;
  });
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
    const body: FigmaFlowRequest = await req.json();
    const { figmaUrl } = body;

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
          message: "Could not parse the Figma URL. Please use a valid link to a Figma Section, Group, or Frame." 
        }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { fileKey, nodeId } = parsed;

    if (!nodeId) {
      return new Response(
        JSON.stringify({ 
          error: "Node ID Required", 
          message: "Please select a Section, Group, or Frame in Figma and copy its link." 
        }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

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
    const nodesApiUrl = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;
    console.log("Fetching node metadata from:", nodesApiUrl);

    const nodesResponse = await fetch(nodesApiUrl, {
      headers: { [figmaAuth.headerName]: figmaAuth.headerValue },
    });

    if (!nodesResponse.ok) {
      // Step 2: Parse the specific Figma error
      const figmaError = await parseFigmaApiError(nodesResponse);
      console.error(`Figma API error: ${nodesResponse.status} - ${figmaError.error}`);
      return createErrorResponse(figmaError, getCorsHeaders(req));
    }

    const nodesData = await nodesResponse.json();

    // Extract the target node
    const nodeIdWithColon = nodeId.replace(/-/g, ":");
    const targetNode = nodesData.nodes?.[nodeIdWithColon]?.document || nodesData.nodes?.[nodeId]?.document;
    
    if (!targetNode) {
      console.error("Node not found. Available nodes:", Object.keys(nodesData.nodes || {}));
      const error: FigmaErrorResponse = {
        success: false,
        error: FigmaErrorCodes.NODE_NOT_FOUND,
        message: "Could not find the specified Section, Group, or Frame in the Figma file.",
      };
      return createErrorResponse(error, getCorsHeaders(req));
    }

    // Filter & Sort children
    const children: FigmaNode[] = targetNode.children || [];
    const validNodes = filterValidNodes(children);

    if (validNodes.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No Frames Found", 
          message: "No frames, instances, or components were found inside this container." 
        }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Sort by x position (left to right) and limit to 10
    const sortedNodes = sortNodesByPosition(validNodes).slice(0, 10);
    
    // Return ONLY metadata - no image processing
    const nodeMetadata = sortedNodes.map(node => ({
      nodeId: node.id,
      name: node.name,
      type: node.type,
    }));

    console.log(`Returning ${nodeMetadata.length} node metadata items`);

    return new Response(
      JSON.stringify({
        success: true,
        fileKey,
        parentNodeId: nodeId,
        nodes: nodeMetadata,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "An internal error occurred."
      }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
