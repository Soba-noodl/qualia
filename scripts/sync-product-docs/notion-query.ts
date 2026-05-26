import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

let cachedToken: string | null = null;

function getToken(): string {
  if (cachedToken) return cachedToken;
  if (process.env.NOTION_TOKEN) {
    cachedToken = process.env.NOTION_TOKEN;
    return cachedToken;
  }
  const claudeJson = join(homedir(), ".claude.json");
  if (existsSync(claudeJson)) {
    const raw = JSON.parse(readFileSync(claudeJson, "utf-8"));
    const headerStr = raw?.mcpServers?.notion?.env?.OPENAPI_MCP_HEADERS;
    if (headerStr) {
      const headers = JSON.parse(headerStr);
      const auth = headers?.Authorization as string | undefined;
      if (auth?.startsWith("Bearer ")) {
        cachedToken = auth.slice(7);
        return cachedToken;
      }
    }
  }
  throw new Error("No Notion token (set NOTION_TOKEN env or configure MCP in ~/.claude.json)");
}

async function api<T = unknown>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${method} ${path}: ${res.status} — ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

const NBSP = /\u00A0/g;

export function extractTitle(page: { properties?: Record<string, unknown> }): string {
  const props = (page.properties ?? {}) as Record<string, { type?: string; title?: Array<{ plain_text?: string }> }>;
  const candidate = props.Name ?? props.title ?? Object.values(props).find((v) => v?.type === "title");
  const arr = candidate?.title ?? [];
  const raw = arr.map((t) => t.plain_text ?? "").join("");
  return raw.replace(NBSP, " ").trim();
}

export function extractTag(page: { properties?: Record<string, unknown> }): string | null {
  const props = page.properties as Record<string, { select?: { name?: string } | null }> | undefined;
  const sel = props?.["Qualia segment"]?.select;
  return sel?.name ?? null;
}

export function extractCompany(page: { properties?: Record<string, unknown> }): string {
  const props = page.properties as Record<string, { rich_text?: Array<{ plain_text?: string }>; title?: Array<{ plain_text?: string }> }> | undefined;
  const prop = props?.Company;
  if (!prop) return "";
  const arr = prop.rich_text ?? prop.title ?? [];
  return arr.map((t) => t.plain_text ?? "").join("").trim();
}

export async function queryDatabase(dbId: string): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;
  do {
    const res = await api<{ results: Array<Record<string, unknown>>; has_more: boolean; next_cursor?: string }>(
      "POST", `/databases/${dbId}/query`, { page_size: 100, start_cursor: cursor }
    );
    rows.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return rows;
}

export async function fetchPageBlocks(pageId: string): Promise<Array<Record<string, unknown>>> {
  const blocks: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;
  do {
    const cursorQs = cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : "";
    const res = await api<{ results: Array<Record<string, unknown>>; has_more: boolean; next_cursor?: string }>(
      "GET", `/blocks/${pageId}/children?page_size=100${cursorQs}`
    );
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

export async function searchDatabases(query: string): Promise<Array<Record<string, unknown>>> {
  const res = await api<{ results: Array<Record<string, unknown>> }>(
    "POST", "/search", { query, page_size: 100, filter: { property: "object", value: "database" } }
  );
  return res.results;
}

export async function searchPages(query: string): Promise<Array<Record<string, unknown>>> {
  const res = await api<{ results: Array<Record<string, unknown>> }>(
    "POST", "/search", { query, page_size: 100, filter: { property: "object", value: "page" } }
  );
  return res.results;
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")))
) {
  const [, , cmd, arg] = process.argv;
  (async () => {
    try {
      let out: unknown;
      if (cmd === "query-db") out = await queryDatabase(arg);
      else if (cmd === "fetch-page") out = await fetchPageBlocks(arg);
      else if (cmd === "search-db") out = await searchDatabases(arg);
      else if (cmd === "search-page") out = await searchPages(arg);
      else throw new Error(`Unknown cmd: ${cmd}. Use: query-db | fetch-page | search-db | search-page`);
      console.log(JSON.stringify(out, null, 2));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  })();
}
