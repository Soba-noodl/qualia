import { supabase } from "@/integrations/supabase/client";
import { addContextDocumentFromIntegration } from "./context-documents.service";
import type { ContextDocumentRow } from "./context-documents.service";

export type IntegrationProvider = "drive" | "notion" | "figma";

export type FetchedIntegrationDocument = {
  id: string;
  name: string;
  content: string;
  error?: string;
};

export type ExtractedProjectContext = {
  name: string | null;
  mission: string | null;
  archetypes: Array<{ name: string; description: string }>;
  constraints?: string | null;
  scope?: "whole" | "section";
  section_name?: string | null;
  product_name?: string | null;
  global_mission?: string | null;
};

function getSupabaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error("VITE_SUPABASE_URL not set");
  return url;
}

export async function getAccessToken(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  // Check if the token is expired or about to expire (within 60s).
  // getSession() only reads the local cache and never refreshes.
  try {
    const payload = token.split(".")[1];
    if (payload) {
      const norm = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = norm + "=".repeat((4 - (norm.length % 4)) % 4);
      const claims = JSON.parse(atob(padded));
      if (claims.exp && Date.now() / 1000 > claims.exp - 60) {
        const { data: refreshed, error: refreshError } =
          await supabase.auth.refreshSession();
        if (!refreshError && refreshed?.session?.access_token) {
          return refreshed.session.access_token;
        }
      }
    }
  } catch {
    // Decode failed — return the cached token as-is
  }

  return token;
}

export async function checkIntegrationStatus(): Promise<{
  drive: boolean;
  notion: boolean;
  figma: boolean;
  mcp: boolean;
  accounts?: { drive: string | null; notion: string | null; figma: string | null };
}> {
  const token = await getAccessToken();
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let resp: Response;
  try {
    resp = await fetch(`${supabaseUrl}/functions/v1/integration-status`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to check integration status (request error: ${msg})`);
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const body = await resp.text();
    console.error("integration-status failed", resp.status, body);
    throw new Error(`Failed to check integration status (${resp.status}: ${body || "no_body"})`);
  }
  const statusJson = await resp.json();
  return statusJson;
}

export type InitiateOAuthOptions = { returnTo?: string };

export async function initiateOAuth(
  provider: IntegrationProvider,
  options?: InitiateOAuthOptions
): Promise<void> {
  const token = await getAccessToken();
  const supabaseUrl = getSupabaseUrl();

  const fn =
    provider === "drive" ? "google-drive-auth"
    : provider === "figma" ? "figma-auth"
    : "notion-auth";

  const resp = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await resp.text();

  if (!resp.ok) {
    let message = "Connection unavailable. Please try again later.";
    try {
      const json = JSON.parse(text);
      if (json.error) message = json.error;
    } catch {
      if (resp.status === 404) message = "Google Drive connection is not set up yet. Please contact support or try again later.";
      else if (resp.status === 401) message = "Please sign in again.";
    }
    console.error("initiateOAuth failed", resp.status, text);
    throw new Error(message);
  }

  let data: { url?: string; error?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid response from server. Please try again.");
  }

  const url = data?.url;
  if (!url || typeof url !== "string") {
    const errMsg = data?.error || "Could not start connection. Please try again.";
    throw new Error(errMsg);
  }

  if (options?.returnTo) {
    try {
      sessionStorage.setItem("oauth_return", options.returnTo);
    } catch {
      // ignore
    }
  }

  // eslint-disable-next-line no-restricted-syntax -- NAV-002: OAuth initiation URL (external provider)
  window.location.href = url;
}

/** Returns a Google access token for the Drive Picker (client-side). */
export async function getDrivePickerToken(): Promise<string> {
  const token = await getAccessToken();
  const supabaseUrl = getSupabaseUrl();

  const resp = await fetch(
    `${supabaseUrl}/functions/v1/google-drive-auth?picker_token=1`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 403) {
      try {
        const json = JSON.parse(text);
        if (json.error) throw new Error(json.error);
      } catch (e) {
        if (e instanceof Error) throw e;
      }
      throw new Error("Google Drive not connected. Please connect your account first.");
    }
    console.error("google-drive-auth/token failed", resp.status, text);
    throw new Error("Failed to get Google Drive token");
  }

  const json = await resp.json();
  const accessToken = json?.access_token;
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Invalid token response");
  }
  return accessToken;
}

export async function fetchDriveDocuments(fileIds: string[]): Promise<FetchedIntegrationDocument[]> {
  if (fileIds.length === 0) return [];
  const token = await getAccessToken();
  const supabaseUrl = getSupabaseUrl();

  const resp = await fetch(`${supabaseUrl}/functions/v1/google-drive-fetch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file_ids: fileIds }),
  });

  if (!resp.ok) {
    console.error("google-drive-fetch failed", await resp.text());
    throw new Error("Failed to fetch Google Drive documents");
  }

  const json = await resp.json();
  return (json.documents ?? []) as FetchedIntegrationDocument[];
}

/** Returns Notion pages for the picker (id + title). */
export async function fetchNotionPages(): Promise<{ id: string; title: string }[]> {
  const token = await getAccessToken();
  const supabaseUrl = getSupabaseUrl();

  const resp = await fetch(`${supabaseUrl}/functions/v1/notion-fetch?list_pages=1`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 403) {
      try {
        const json = JSON.parse(text);
        if (json.error) throw new Error(json.error);
      } catch (e) {
        if (e instanceof Error) throw e;
      }
      throw new Error("Notion not connected. Please connect your account first.");
    }
    console.error("notion-fetch list_pages failed", resp.status, text);
    throw new Error("Failed to list Notion pages");
  }

  const json = await resp.json();
  const pages = json.pages ?? [];
  return Array.isArray(pages) ? pages : [];
}

export async function fetchNotionDocuments(pageIds: string[]): Promise<FetchedIntegrationDocument[]> {
  if (pageIds.length === 0) return [];
  const token = await getAccessToken();
  const supabaseUrl = getSupabaseUrl();

  const resp = await fetch(`${supabaseUrl}/functions/v1/notion-fetch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_ids: pageIds }),
  });

  if (!resp.ok) {
    console.error("notion-fetch failed", await resp.text());
    throw new Error("Failed to fetch Notion documents");
  }

  const json = await resp.json();
  return (json.documents ?? []) as FetchedIntegrationDocument[];
}

export async function extractProjectContext(
  documents: FetchedIntegrationDocument[]
): Promise<ExtractedProjectContext> {
  if (documents.length === 0) {
    return {
      name: null,
      mission: null,
      archetypes: [],
      constraints: null,
      scope: "whole",
      section_name: null,
      product_name: null,
      global_mission: null,
    };
  }

  const supabaseUrl = getSupabaseUrl();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated — cannot extract project context");
  }

  const resp = await fetch(
    `${supabaseUrl}/functions/v1/extract-project-context`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        documents: documents.map((d) => ({
          name: d.name,
          content: d.content,
        })),
      }),
    }
  );

  if (!resp.ok) {
    console.error("extract-project-context failed", await resp.text());
    throw new Error("Failed to extract project context");
  }

  return resp.json();
}

export function parseDriveUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const isDrive = u.hostname.includes("drive.google.com");
    const isDocs = u.hostname.includes("docs.google.com");
    if (!isDrive && !isDocs) return null;

    // Paths like /document/d/ID or /file/d/ID or /d/ID
    if (u.pathname.includes("/d/")) {
      const parts = u.pathname.split("/d/")[1]?.split("/");
      if (parts && parts[0]) return parts[0];
    }

    const idParam = u.searchParams.get("id");
    if (idParam) return idParam;

    return null;
  } catch {
    return null;
  }
}

export function parseNotionUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("notion.so") && !u.hostname.endsWith(".notion.site")) {
      return null;
    }

    const lastSegment = u.pathname.split("/").filter(Boolean).pop();
    if (!lastSegment) return null;

    const match = lastSegment.match(/([0-9a-fA-F]{32})$/);
    if (!match) return null;
    const rawId = match[1];

    return [
      rawId.slice(0, 8),
      rawId.slice(8, 12),
      rawId.slice(12, 16),
      rawId.slice(16, 20),
      rawId.slice(20),
    ].join("-");
  } catch {
    return null;
  }
}

export async function saveIntegrationDocumentsToProject(
  projectId: string,
  source: IntegrationProvider,
  docs: FetchedIntegrationDocument[]
): Promise<ContextDocumentRow[]> {
  const results: ContextDocumentRow[] = [];
  for (const doc of docs) {
    if (!doc.content?.trim()) continue;
    const row = await addContextDocumentFromIntegration(
      projectId,
      source as "drive" | "notion",
      doc.content,
      doc.name || "Untitled",
      doc.id
    );
    results.push(row);
  }
  return results;
}

// ─── Edge Function wrappers ───────────────────────────────────────────────────

export type FigmaSnapshotResult = {
  data: Record<string, unknown> | null;
  error: { message: string; context?: unknown } | null;
};

export type FigmaFlowResult = {
  data: Record<string, unknown> | null;
  error: { message: string; context?: unknown } | null;
};

export type ReframeExportResult = {
  data: Record<string, unknown> | null;
  error: { message: string; context?: Response } | null;
};

/**
 * Calls the fetch-figma-snapshot Edge Function.
 * Returns raw { data, error } — callers handle error display.
 */
export async function invokeFigmaSnapshot(
  figmaUrl: string,
  includeMetadata = false
): Promise<FigmaSnapshotResult> {
  const { data, error } = await supabase.functions.invoke("fetch-figma-snapshot", {
    body: { figmaUrl, includeMetadata },
  });
  return { data: data as Record<string, unknown> | null, error };
}

/**
 * Calls the fetch-figma-flow Edge Function.
 * Returns raw { data, error } — callers handle error display.
 */
export async function invokeFigmaFlow(
  figmaUrl: string
): Promise<FigmaFlowResult> {
  const { data, error } = await supabase.functions.invoke("fetch-figma-flow", {
    body: { figmaUrl },
  });
  return { data: data as Record<string, unknown> | null, error };
}

/**
 * Calls the reframe-export Edge Function.
 * Returns raw { data, error } — callers handle the response.
 */
export async function invokeReframeExport(params: {
  audit_id: string;
  score: number;
  one_big_thing: string;
  findings: Array<{ issue: string; why_it_matters: string; engine: string }>;
  accessibility_summary: string | null;
  synth_summary: string | null;
  language: string;
}): Promise<ReframeExportResult> {
  const { data, error } = await supabase.functions.invoke("reframe-export", {
    body: params,
  });
  return { data: data as Record<string, unknown> | null, error: error as ReframeExportResult["error"] };
}

/** Maps the IntegrationProvider alias to the value stored in user_integrations.provider. */
function toDbProvider(provider: IntegrationProvider): string {
  return provider === "drive" ? "google_drive" : provider;
}

export async function disconnectIntegration(provider: IntegrationProvider): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", toDbProvider(provider));
  if (error) throw error;

  // For Figma, also clear the legacy profile flags so integration-status returns figma: false
  if (provider === "figma") {
    await supabase
      .from("profiles")
      .update({ figma_access_token: null, has_figma_token: false })
      .eq("user_id", user.id);
  }
}

export async function revokeMcpSession(): Promise<void> {
  const token = await getAccessToken();
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const resp = await fetch(`${supabaseUrl}/functions/v1/mcp-auth?action=revoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: publishableKey,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to revoke MCP session: ${text}`);
  }
}

