// supabase/functions/_shared/llm/audit-attribution.ts
/**
 * Writes BYOK provenance (provider, model, paid_by) to an audits row after a successful
 * LLM call. Called by edge functions that produce audit reports.
 *
 * Non-throwing: if the update fails (e.g. audit_id is null or the row was deleted),
 * logs an error and returns. The audit itself succeeded — provenance is best-effort.
 */

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = any;
import type { LLMProvider } from "./pricing.ts";

export async function logAiProviderToAudit(
  supabase: AnySupabaseClient,
  auditId: string,
  provider: LLMProvider,
  model: string,
  paidBy: "platform" | "user",
): Promise<void> {
  if (!auditId) return;
  try {
    const { error } = await supabase
      .from("audits")
      .update({ ai_provider: provider, ai_model: model, paid_by: paidBy })
      .eq("id", auditId);
    if (error) {
      console.error("[audit-attribution] update failed:", error.message);
    }
  } catch (e) {
    console.error("[audit-attribution] unexpected error:", String(e));
  }
}
