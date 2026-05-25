import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

/**
 * Delete a user account and ALL associated data.
 *
 * Cascade strategy:
 * - Tables with `user_id ... REFERENCES auth.users(id) ON DELETE CASCADE`
 *   are removed automatically by `auth.admin.deleteUser()` at the end.
 *   These include: user_roles, profiles, oauth_state, mcp_auth_state,
 *   user_integrations, plugin_tokens, mcp_sessions, email_sends,
 *   email_preferences, organizations (owner_id), org_members.
 *
 * - Tables WITHOUT a CASCADE FK to auth.users — we delete explicitly here
 *   BEFORE deleting the auth user:
 *     * audits (user_id is plain UUID)
 *     * projects (user_id is plain UUID — cascades to project_personas,
 *       project_context_documents via FK)
 *     * interest_leads (user_id is plain UUID)
 *
 * - Tables with `ON DELETE SET NULL` to auth.users — rows are retained
 *   anonymized. Intentional, not deleted here:
 *     * error_events.user_id — kept for ops debugging.
 *     * ai_usage_events.user_id — kept for aggregate cost/usage analytics
 *       (provider, paid_by, tokens). Rows lose user attribution on delete.
 *
 * - Storage buckets — Supabase storage objects do NOT cascade on auth user
 *   delete. Purge explicitly:
 *     * screenshots: <userId>/...
 *     * avatars: <userId>/...
 *     * context-documents: <userId>/...
 *     * audit-resized: <audit_id>/... — enumerated from user's audits
 *       BEFORE we delete the audit rows.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  // Pre-flight body cap (this endpoint takes an empty/tiny body — anything
  // bigger than 1MB is abuse).
  const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
  if (tooBig) return tooBig;

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSecretKey();

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    console.info(`[delete-account] start userId=${userId}`);

    // -----------------------------------------------------------
    // 1. Enumerate user's audit IDs BEFORE deleting rows so we can
    //    purge the `audit-resized` cache keyed by <audit_id>.
    //    Paginated to avoid timeout for power users with tens of
    //    thousands of audits — Supabase JS REST default page is 1000
    //    rows and a single .select() blocks the connection until done.
    //    Track partial failures so the response surfaces them.
    // -----------------------------------------------------------
    const partialFailures: string[] = [];
    const auditIds: string[] = [];
    const AUDIT_PAGE_SIZE = 1000;
    {
      let offset = 0;
      while (true) {
        const { data: page, error: enumError } = await supabase
          .from("audits")
          .select("id")
          .eq("user_id", userId)
          .range(offset, offset + AUDIT_PAGE_SIZE - 1);
        if (enumError) {
          // Don't silently skip — record the failure so the response surfaces it
          // and the caller knows the audit-resized cache may have stragglers.
          partialFailures.push(`audit-id enumeration (offset=${offset}): ${enumError.message}`);
          console.error(`[delete-account] audit enumeration error at offset=${offset}:`, enumError.message);
          break;
        }
        const rows = (page ?? []) as Array<{ id: string }>;
        if (rows.length === 0) break;
        for (const row of rows) auditIds.push(row.id);
        if (rows.length < AUDIT_PAGE_SIZE) break;
        offset += rows.length;
      }
    }
    console.info(`[delete-account] enumerated ${auditIds.length} audits for resized-cache purge`);

    // Paginated user-folder listing — Supabase storage `.list()` caps at 1000
    // per call. Power users with >1000 screenshots/avatars would silently
    // leave stragglers behind without this loop. Match the same pattern used
    // by `runCleanup` in storage-cleanup/index.ts.
    async function listAllInUserFolder(bucket: string): Promise<string[]> {
      const all: string[] = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .list(userId, { limit: pageSize, offset });
        if (error) throw error;
        const page = data ?? [];
        for (const obj of page) all.push(`${userId}/${obj.name}`);
        if (page.length < pageSize) break;
        offset += pageSize;
      }
      return all;
    }

    // -----------------------------------------------------------
    // 2. Purge storage objects (per bucket).
    // -----------------------------------------------------------

    // 2a. screenshots/<userId>/... (paginated; user-scoped)
    try {
      const paths = await listAllInUserFolder("screenshots");
      if (paths.length > 0) {
        const { error } = await supabase.storage.from("screenshots").remove(paths);
        if (error) {
          partialFailures.push(`screenshots purge: ${error.message}`);
          console.error(`[delete-account] screenshots purge error:`, error.message);
        } else {
          console.info(`[delete-account] purged ${paths.length} screenshots objects`);
        }
      } else {
        console.info(`[delete-account] no screenshots to purge`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      partialFailures.push(`screenshots list/remove: ${msg}`);
      console.error(`[delete-account] screenshots list/remove failed:`, msg);
    }

    // 2b. avatars/<userId>/... (paginated; user-scoped)
    try {
      const paths = await listAllInUserFolder("avatars");
      if (paths.length > 0) {
        const { error } = await supabase.storage.from("avatars").remove(paths);
        if (error) {
          partialFailures.push(`avatars purge: ${error.message}`);
          console.error(`[delete-account] avatars purge error:`, error.message);
        } else {
          console.info(`[delete-account] purged ${paths.length} avatars objects`);
        }
      } else {
        console.info(`[delete-account] no avatars to purge`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      partialFailures.push(`avatars list/remove: ${msg}`);
      console.error(`[delete-account] avatars list/remove failed:`, msg);
    }

    // 2c. context-documents/<userId>/... (paginated; user-scoped)
    //     User-uploaded project context files (PDFs, etc.) — same folder
    //     pattern as screenshots/avatars per migration 20260208120000.
    //     Previously missed in the cascade; surfaced by 2026-05-23 security
    //     review as a "deleted immediately" privacy-policy gap.
    try {
      const paths = await listAllInUserFolder("context-documents");
      if (paths.length > 0) {
        const { error } = await supabase.storage.from("context-documents").remove(paths);
        if (error) {
          partialFailures.push(`context-documents purge: ${error.message}`);
          console.error(`[delete-account] context-documents purge error:`, error.message);
        } else {
          console.info(`[delete-account] purged ${paths.length} context-documents objects`);
        }
      } else {
        console.info(`[delete-account] no context-documents to purge`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      partialFailures.push(`context-documents list/remove: ${msg}`);
      console.error(`[delete-account] context-documents list/remove failed:`, msg);
    }

    // 2d. audit-resized/<audit_id>/... — one prefix per user audit.
    //     Sequential (not parallel) to stay friendly to storage rate limits.
    //     Anything we miss here (e.g., enumeration failed in step 1) gets
    //     swept by the storage-cleanup cron's orphan branch within 24h.
    let resizedPurged = 0;
    for (const auditId of auditIds) {
      try {
        const { data: cached } = await supabase.storage
          .from("audit-resized")
          .list(auditId, { limit: 1000 });
        if (cached && cached.length > 0) {
          const paths = cached.map((o) => `${auditId}/${o.name}`);
          const { error } = await supabase.storage.from("audit-resized").remove(paths);
          if (error) {
            partialFailures.push(`audit-resized[${auditId}]: ${error.message}`);
            console.error(`[delete-account] audit-resized purge error for ${auditId}:`, error.message);
          } else {
            resizedPurged += paths.length;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        partialFailures.push(`audit-resized[${auditId}]: ${msg}`);
        console.error(`[delete-account] audit-resized list/remove failed for ${auditId}:`, msg);
      }
    }
    console.info(`[delete-account] purged ${resizedPurged} audit-resized objects across ${auditIds.length} audits`);

    // -----------------------------------------------------------
    // 3. Delete table rows that do NOT cascade from auth.users.
    // -----------------------------------------------------------

    // 3a. Audits (no FK to auth.users — must delete manually)
    {
      const { error } = await supabase.from("audits").delete().eq("user_id", userId);
      if (error) {
        partialFailures.push(`audits delete: ${error.message}`);
        console.error(`[delete-account] audits delete error:`, error.message);
      } else {
        console.info(`[delete-account] deleted audits for userId=${userId}`);
      }
    }

    // 3b. Projects (no FK to auth.users — must delete manually).
    //     project_personas and project_context_documents CASCADE on project_id
    //     so they go automatically.
    {
      const { error } = await supabase.from("projects").delete().eq("user_id", userId);
      if (error) {
        partialFailures.push(`projects delete: ${error.message}`);
        console.error(`[delete-account] projects delete error:`, error.message);
      } else {
        console.info(`[delete-account] deleted projects (cascades to personas + context docs)`);
      }
    }

    // 3c. interest_leads (no FK to auth.users)
    {
      const { error } = await supabase.from("interest_leads").delete().eq("user_id", userId);
      if (error) {
        partialFailures.push(`interest_leads delete: ${error.message}`);
        console.error(`[delete-account] interest_leads delete error:`, error.message);
      } else {
        console.info(`[delete-account] deleted interest_leads`);
      }
    }

    // -----------------------------------------------------------
    // 4. Delete the auth user — this cascades the rest:
    //    profiles, user_roles, oauth_state, mcp_auth_state, user_integrations,
    //    plugin_tokens, mcp_sessions, email_sends, email_preferences,
    //    organizations, org_members.
    //    error_events and ai_usage_events stay (ON DELETE SET NULL, by design).
    // -----------------------------------------------------------
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete account" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    console.info(`[delete-account] auth user deleted (cascades fired)`);
    if (partialFailures.length > 0) {
      console.warn(`[delete-account] completed with ${partialFailures.length} partial failures:`, partialFailures);
    }
    console.info(`[delete-account] done userId=${userId}`);

    // Surface partial-failure detail so the client can warn the user that
    // some data may take up to 24h to be cleaned by background cron sweeps.
    // The auth user is gone either way — the response is "success" but the
    // optional `partial_failures` field tells the caller what didn't fully purge.
    return new Response(
      JSON.stringify({
        success: true,
        partial_failures: partialFailures.length > 0 ? partialFailures : undefined,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("delete-account error:", err);
    await logErrorEvent({
      source: "edge_function",
      context: "delete-account",
      errorCode: "internal_error",
      errorMessage: err instanceof Error ? err.message : "unknown",
    });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
