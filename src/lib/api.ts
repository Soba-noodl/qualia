/**
 * Centralized API / edge function URLs.
 * All client calls to Supabase edge functions should use these constants.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
if (!SUPABASE_URL) throw new Error("VITE_SUPABASE_URL is not set");

/** Base URL for Supabase Edge Functions (e.g. https://xxx.supabase.co/functions/v1) */
export const EDGE_FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

/** Full URL for the analyze-ui edge function */
export const ANALYZE_UI_URL = `${EDGE_FUNCTIONS_BASE}/analyze-ui`;

/** Full URL for the explain-reaudit-delta edge function */
export const EXPLAIN_REAUDIT_DELTA_URL = `${EDGE_FUNCTIONS_BASE}/explain-reaudit-delta`;

/** Full URL for the generate-feedback-response edge function (re-audit with feedback only) */
export const GENERATE_FEEDBACK_RESPONSE_URL = `${EDGE_FUNCTIONS_BASE}/generate-feedback-response`;

/** Full URL for the synth-user-analyze edge function */
export const SYNTH_USER_ANALYZE_URL = `${EDGE_FUNCTIONS_BASE}/synth-user-analyze`;

/** Full URL for the reframe-export edge function */
export const REFRAME_EXPORT_URL = `${EDGE_FUNCTIONS_BASE}/reframe-export`;

/** Full URL for the crawl-request edge function (Auto-Audit) */
export const CRAWL_REQUEST_URL = `${EDGE_FUNCTIONS_BASE}/crawl-request`;

/** Full URL for the figma-prototype-crawl edge function */
export const FIGMA_PROTOTYPE_CRAWL_URL = `${EDGE_FUNCTIONS_BASE}/figma-prototype-crawl`;

/** Full URL for the mcp-auth edge function (OAuth 2.1 authorization server) */
export const MCP_AUTH_URL = `${EDGE_FUNCTIONS_BASE}/mcp-auth`;

/** Full URL for the manage-llm-key edge function (BYOK save/test/delete/set-default) */
export const MANAGE_LLM_KEY_URL = `${EDGE_FUNCTIONS_BASE}/manage-llm-key`;

/** Full URL for the user-spend-summary edge function */
export const USER_SPEND_SUMMARY_URL = `${EDGE_FUNCTIONS_BASE}/user-spend-summary`;

/**
 * Public MCP endpoint shown to users (e.g. for claude.ai Connectors).
 * Routed through qualia-ux.com so OAuth discovery (RFC 9728 path-suffixed
 * Protected Resource Metadata) and the issuer match.
 */
export const MCP_URL = "https://qualia-ux.com/mcp";
