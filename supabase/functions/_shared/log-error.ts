import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "./supabase-env.ts";

export type ErrorSource = "edge_function" | "plugin_ui" | "figma_sandbox";

export interface LogErrorOptions {
  userId?: string | null;
  source: ErrorSource;
  context: string;             // which function / component
  errorCode?: string;          // machine-readable label
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget error logging. Never throws — safe to call in any catch block.
 */
export async function logErrorEvent(opts: LogErrorOptions): Promise<void> {
  try {
    const client = createClient(getSupabaseUrl(), getSecretKey());
    await client.from("error_events").insert({
      user_id:       opts.userId       ?? null,
      source:        opts.source,
      context:       opts.context,
      error_code:    opts.errorCode    ?? "unknown",
      error_message: opts.errorMessage ?? null,
      metadata:      opts.metadata     ?? null,
    });
  } catch {
    // Never throw from error logging
  }
}
