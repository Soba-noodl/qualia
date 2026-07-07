import { supabase } from "@/integrations/supabase/client";

export type IssueFeedbackStance = "agree" | "disagree" | "already_fixed" | "not_relevant";

export interface AuditIssueFeedbackRow {
  id: string;
  audit_id: string;
  engine_id: string;
  issue_index: number;
  stance: IssueFeedbackStance;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export async function listAuditIssueFeedback(
  auditId: string
): Promise<AuditIssueFeedbackRow[]> {
  const { data, error } = await supabase
    .from("audit_issue_feedback")
    .select("id, audit_id, engine_id, issue_index, stance, reason, created_at, updated_at")
    .eq("audit_id", auditId)
    .order("engine_id")
    .order("issue_index");

  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    issue_index: row.issue_index as number,
  })) as AuditIssueFeedbackRow[];
}

export type UpsertAuditIssueFeedbackParams = {
  auditId: string;
  engineId: string;
  issueIndex: number;
  stance: IssueFeedbackStance;
  reason?: string | null;
};

export async function upsertAuditIssueFeedback(
  params: UpsertAuditIssueFeedbackParams
): Promise<AuditIssueFeedbackRow> {
  const { auditId, engineId, issueIndex, stance, reason } = params;
  const { data, error } = await supabase
    .from("audit_issue_feedback")
    .upsert(
      {
        audit_id: auditId,
        engine_id: engineId,
        issue_index: issueIndex,
        stance,
        reason: reason?.trim() || null,
      },
      {
        onConflict: "audit_id,engine_id,issue_index",
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data as AuditIssueFeedbackRow;
}

export async function deleteAuditIssueFeedback(
  auditId: string,
  engineId: string,
  issueIndex: number
): Promise<void> {
  const { error } = await supabase
    .from("audit_issue_feedback")
    .delete()
    .eq("audit_id", auditId)
    .eq("engine_id", engineId)
    .eq("issue_index", issueIndex);

  if (error) throw error;
}
