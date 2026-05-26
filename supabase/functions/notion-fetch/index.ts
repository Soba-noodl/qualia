import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getIntegrationToken } from "../_shared/integration-tokens.ts";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { logErrorEvent } from "../_shared/log-error.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
const NOTION_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionBlock {
  object: string;
  type: string;
  has_children?: boolean;
  id?: string;
  [key: string]: unknown;
}

function richTextToPlain(richText: Array<{ plain_text?: string }> | undefined): string {
  if (!richText || richText.length === 0) return "";
  return richText.map((rt) => rt.plain_text ?? "").join("");
}

function blockToText(block: NotionBlock): string {
  const type = block.type;
  const data = block[type] ?? {};

  switch (type) {
    case "paragraph":
      return richTextToPlain(data.rich_text);
    case "heading_1":
    case "heading_2":
    case "heading_3":
      return richTextToPlain(data.rich_text);
    case "bulleted_list_item":
    case "numbered_list_item":
    case "to_do":
      return richTextToPlain(data.rich_text);
    case "toggle":
      return richTextToPlain(data.rich_text);
    case "quote":
      return richTextToPlain(data.rich_text);
    case "callout":
      return richTextToPlain(data.rich_text);
    default:
      return "";
  }
}

const MAX_BLOCKS = 2000;
const MAX_DEPTH = 6;

async function fetchBlockChildren(
  blockId: string,
  accessToken: string,
  cursor?: string
): Promise<{ results: NotionBlock[]; next_cursor?: string }> {
  const url = new URL(`${NOTION_BASE_URL}/blocks/${blockId}/children`);
  if (cursor) url.searchParams.set("start_cursor", cursor);
  url.searchParams.set("page_size", "100");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Notion blocks fetch failed:", res.status, errText);
    return { results: [] };
  }

  const json = await res.json();
  return {
    results: json.results ?? [],
    next_cursor: json.next_cursor,
  };
}

/** Recursively fetch all blocks (including nested children) so page content is complete for extraction. */
async function fetchAllBlocks(
  pageId: string,
  accessToken: string
): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];

  async function collect(blockId: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || blocks.length >= MAX_BLOCKS) return;
    let cursor: string | undefined;

    while (true) {
      const { results, next_cursor } = await fetchBlockChildren(
        blockId,
        accessToken,
        cursor
      );

      for (const block of results) {
        blocks.push(block);
        if (blocks.length >= MAX_BLOCKS) return;
        if (block.has_children && block.id) {
          await collect(block.id, depth + 1);
        }
      }

      if (!next_cursor) break;
      cursor = next_cursor;
    }
  }

  await collect(pageId, 0);
  return blocks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
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

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const tokens = await getIntegrationToken(serviceClient, user.id, "notion", {
    INTEGRATION_ENCRYPTION_KEY: Deno.env.get("INTEGRATION_ENCRYPTION_KEY"),
  });

  if (!tokens) {
    return new Response(
      JSON.stringify({ error: "Notion not connected. Please connect your account first." }),
      { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const accessToken = tokens.access_token;

  // GET ?list_pages=1 — list pages for picker (Notion search)
  const url = new URL(req.url);
  const listPages = url.searchParams.get("list_pages") === "1";
  if (req.method === "GET" && listPages) {
    const searchRes = await fetch(`${NOTION_BASE_URL}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: "object", value: "page" },
        page_size: 100,
      }),
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error("Notion search failed:", searchRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to list Notion pages" }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const searchJson = await searchRes.json();
    const results = searchJson.results ?? [];
    const pages: { id: string; title: string }[] = [];

    for (const item of results) {
      if (item.object !== "page" || !item.id) continue;
      let title = "Untitled";
      const properties = item.properties ?? {};
      for (const key of Object.keys(properties)) {
        const prop = properties[key];
        if (prop?.type === "title" && Array.isArray(prop.title)) {
          const text = richTextToPlain(prop.title);
          if (text) {
            title = text;
            break;
          }
        }
      }
      pages.push({ id: item.id, title });
    }

    return new Response(JSON.stringify({ pages }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
  if (tooBig) return tooBig;

  let body: { page_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    await logErrorEvent({
      source: "edge_function",
      context: "notion-fetch",
      errorCode: "internal_error",
    });
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const pageIds = body.page_ids;
  if (!Array.isArray(pageIds) || pageIds.length === 0 || pageIds.length > 5) {
    return new Response(
      JSON.stringify({ error: "page_ids must be an array of 1 to 5 page IDs" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const documents: { id: string; name: string; content: string; error?: string }[] = [];

  for (const pageId of pageIds) {
    try {
      const pageRes = await fetch(`${NOTION_BASE_URL}/pages/${pageId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
      });

      if (!pageRes.ok) {
        if (pageRes.status === 404) {
          documents.push({ id: pageId, name: "(page not found)", content: "", error: "not_found" });
          continue;
        }
        if (pageRes.status === 403) {
          documents.push({ id: pageId, name: "(access denied)", content: "", error: "access_denied" });
          continue;
        }
        const errText = await pageRes.text();
        console.error("Notion page fetch failed:", pageRes.status, errText);
        documents.push({ id: pageId, name: "(fetch failed)", content: "", error: "fetch_failed" });
        continue;
      }

      const page = await pageRes.json();

      let title = "Untitled";
      const properties = page.properties ?? {};
      for (const key of Object.keys(properties)) {
        const prop = properties[key];
        if (prop?.type === "title" && Array.isArray(prop.title)) {
          const text = richTextToPlain(prop.title);
          if (text) {
            title = text;
            break;
          }
        }
      }

      const blocks = await fetchAllBlocks(pageId, accessToken);
      const lines: string[] = [];
      for (const block of blocks) {
        const text = blockToText(block);
        if (text.trim()) {
          lines.push(text.trim());
        }
      }

      const content = lines.join("\n\n").slice(0, 50000);
      documents.push({ id: pageId, name: title, content });
    } catch (e) {
      console.error("Notion fetch error for", pageId, e);
      documents.push({ id: pageId, name: "(error)", content: "", error: "fetch_failed" });
    }
  }

  return new Response(JSON.stringify({ documents }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});

