import { supabase } from "@/integrations/supabase/client";
import { removeScreenshotPaths } from "./storage.service";

/** WCAG 2.1 accessibility block in the audit output. */
export interface AccessibilityBlock {
  wcag_level: "A" | "AA" | "AAA" | "FAIL";
  contrast_failures: Array<{
    element: string;
    ratio: number;
    required: number;
    box_2d: [number, number, number, number] | null;
    image_index?: number | null;
  }>;
  other_violations: Array<{
    issue: string;
    wcag_criterion: string;
    severity: "critical" | "warning";
    suggestion: string;
    box_2d: [number, number, number, number] | null;
    image_index?: number | null;
  }>;
  passed: boolean;
}

export interface SynthUserResult {
  persona_id: string;
  persona_name: string;
  verdict: "PASS" | "FRICTION" | "BLOCKER";
  emotion: "Satisfied" | "Confused" | "Frustrated" | "Anxious";
  diary_entry: string;
  missing_affordance: string;
  next_action: "CLICK" | "TYPE" | "ABANDON";
  reasoning: string;
  zone_detected?: string;
  persona_reaction?: string;
  current_goal?: string;
  primary_focus?: string;
  target_element?: string;
}

export interface SynthUsersBlock {
  critical_finding: string;
  shared_friction: string[];
  results: SynthUserResult[];
}

/** Bounding box: [ymin, xmin, ymax, xmax] on 0–1000 scale. */
export type BoundingBox = [number, number, number, number] | null;

/** Issue data shape used by all engine arrays (supports multi-image flows). */
export interface FlowIssueData {
  issue: string;
  why_it_matters: string;
  suggestion: string;
  principle?: string;
  image_index?: number | null;
  box_2d?: BoundingBox;
  /**
   * T-079: Figma layer ids the model attributes this issue to.
   * Present only on plugin audits with node maps; the webapp resolves these
   * to pixel rectangles via `src/lib/resolveLayerIds.ts` and renders them
   * with `BoundingBoxOverlay`. Falls back to box_2d when null / unresolvable.
   */
  layer_ids?: string[] | null;
}

export interface FlowTransition {
  from_step: number;
  to_step: number;
  issue: string;
  severity: "critical" | "warning" | "ok";
}

export interface FlowAnalysis {
  step_transitions?: FlowTransition[];
  friction_points?: Array<{ step: number; issue: string; why_it_matters?: string; suggestion: string }>;
  missing_steps?: Array<{ after_step: number; what_is_missing: string }>;
}

export interface CrossSession {
  transitions: string;
  consistency: string;
  missing_states: string;
  peak_end: string;
}

export interface DesignSystemBlock {
  components: string;
  color: string;
  typography: string;
  spacing_layout: string;
  interactive_states: string;
  iconography: string;
  microcopy_voice: string;
  verdict: string;
  token_consistency?: string;
  component_library?: string;
}

export interface PrototypeCompleteness {
  score?: number;
  findings?: Array<{ issue: string; why_it_matters: string; suggestion?: string; image_index?: number | null; box_2d?: BoundingBox | null; layer_ids?: string[] | null }>;
  dead_ends?: string;
  orphan_screens?: string;
  missing_flows?: string;
  coverage_assessment?: string;
}

export interface AiReport {
  score: number;
  one_big_thing: string;
  /** Set when the audit used Figma node metadata (Deep Figma UI Analysis). */
  deep_figma_ui?: boolean;
  /** Analysis mode: single screen, flow upload, auto-crawl, or prototype crawl. */
  analysis_mode?: "single" | "flow" | "auto" | "prototype";
  step_count?: number;
  /** Figma frame names indexed by screen position — present for plugin audits only. */
  screen_labels?: string[] | null;
  /** Dedicated WCAG 2.1 AA compliance results. Omitted in older reports. */
  accessibility?: AccessibilityBlock;
  sub_scores?: {
    system_logic_score?: number;
    heuristic_score?: number;
    cognitive_score?: number;
    interaction_score?: number;
    prototype_completeness_score?: number;
    cross_frame_score?: number;
  };
  engines: {
    system_logic: FlowIssueData[];
    heuristic: FlowIssueData[];
    cognitive: FlowIssueData[];
    interaction: FlowIssueData[];
  };
  /** Synthetic user simulation results. Present only when user requested synth analysis. */
  synth_users?: SynthUsersBlock | null;
  /** True when synth_users was inherited from the original audit (feedback-only re-audit). */
  synth_inherited?: boolean;
  flow_analysis?: FlowAnalysis | null;
  cross_session?: CrossSession | null;
  cross_frame?: {
    score?: number;
    findings?: Array<{ issue: string; why_it_matters: string; suggestion?: string; image_index?: number | null; box_2d?: BoundingBox | null; layer_ids?: string[] | null }>;
    transitions?: string;
    consistency?: string;
    missing_states?: string;
    peak_end?: string;
  } | null;
  prototype_completeness?: PrototypeCompleteness | null;
  design_system?: DesignSystemBlock | null;
}

export interface Audit {
  id: string;
  screenshot_url: string;
  flow_images?: string[] | null;
  context_images?: string[] | null;
  analysis: string | null;
  ai_report: AiReport | null;
  overall_score: number | null;
  selected_personas: Array<{ name: string; description: string }> | null;
  screen_context: string | null;
  user_data: string | null;
  created_at: string;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string | null;
  feedback_rating: number | null;
  feedback_comment: string | null;
  follow_up_audit_id: string | null;
  reaudit_explanation: string | null;
  reaudit_type: 'feedback_only' | 'with_changes' | null;
  reaudit_user_note: string | null;
  source?: string | null;
  ai_provider?: string | null;
  ai_model?: string | null;
  paid_by?: string | null;
  /**
   * T-079: per-frame Figma node maps aligned with the exported PNGs.
   * Present only for plugin audits run after T-079 shipped; null otherwise.
   */
  node_maps?: Array<Array<{ id: string; name: string; type: string; bounds: [number, number, number, number] }>> | null;
  /** T-079: scale factor used by the plugin exportAsync (e.g. 2 / 1.25 / 1). */
  export_scale?: number | null;
}

function isValidAiReport(data: unknown): data is AiReport {
  if (!data || typeof data !== "object") return false;
  const report = data as Record<string, unknown>;
  return (
    typeof report.score === "number" &&
    typeof report.one_big_thing === "string" &&
    typeof report.engines === "object" &&
    report.engines !== null
  );
}

export function transformAudit(dbAudit: Record<string, unknown>): Audit {
  return {
    id: dbAudit.id as string,
    screenshot_url: dbAudit.screenshot_url as string,
    flow_images: dbAudit.flow_images as string[] | null,
    context_images: dbAudit.context_images as string[] | null,
    analysis: dbAudit.analysis as string | null,
    ai_report: isValidAiReport(dbAudit.ai_report) ? dbAudit.ai_report : null,
    overall_score: dbAudit.overall_score as number | null,
    selected_personas: dbAudit.selected_personas as Array<{ name: string; description: string }> | null,
    screen_context: dbAudit.screen_context as string | null,
    user_data: (dbAudit.user_data as string | null) ?? null,
    created_at: dbAudit.created_at as string,
    status: (dbAudit.status as Audit["status"]) || "completed",
    error_message: dbAudit.error_message as string | null,
    feedback_rating: dbAudit.feedback_rating as number | null ?? null,
    feedback_comment: (dbAudit.feedback_comment as string | null) ?? null,
    follow_up_audit_id: (dbAudit.follow_up_audit_id as string | null) ?? null,
    reaudit_explanation: (dbAudit.reaudit_explanation as string | null) ?? null,
    reaudit_type: (dbAudit.reaudit_type as 'feedback_only' | 'with_changes' | null) ?? null,
    reaudit_user_note: (dbAudit.reaudit_user_note as string | null) ?? null,
    source: (dbAudit.source as string | null) ?? null,
    ai_provider: (dbAudit.ai_provider as string | null) ?? null,
    ai_model: (dbAudit.ai_model as string | null) ?? null,
    paid_by: (dbAudit.paid_by as string | null) ?? null,
    // T-079: forward node maps + export scale when they exist on the row.
    // Cast through unknown since the generated `types.ts` will be regenerated
    // by the coordinator once the migration is applied.
    node_maps: (dbAudit.node_maps as Audit["node_maps"]) ?? null,
    export_scale: (dbAudit.export_scale as number | null) ?? null,
  };
}

export async function listAudits(projectId: string): Promise<Audit[]> {
  const { data, error } = await supabase
    .from("audits")
    .select("id, project_id, screenshot_url, flow_images, context_images, analysis, ai_report, overall_score, selected_personas, screen_context, user_data, status, error_message, feedback_rating, feedback_comment, follow_up_audit_id, reaudit_explanation, reaudit_type, reaudit_user_note, source, ai_provider, ai_model, paid_by, node_maps, export_scale, created_at")
    .eq("project_id", projectId)
    .eq("visible_in_app", true)
    .order("overall_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((a) => transformAudit(a as Record<string, unknown>));
}

export type CreateAuditParams = {
  project_id: string;
  user_id: string;
  screenshot_url: string;
  selected_personas?: Array<{ name: string; description: string }>;
  screen_context?: string | null;
  user_data?: string | null;
  flow_images?: string[] | null;
  context_images?: string[] | null;
  follow_up_audit_id?: string | null;
  reaudit_type?: 'feedback_only' | 'with_changes' | null;
  reaudit_user_note?: string | null;
  status?: Audit["status"];
};

export async function createAudit(params: CreateAuditParams): Promise<Audit> {
  const { data, error } = await supabase
    .from("audits")
    .insert({
      project_id: params.project_id,
      user_id: params.user_id,
      screenshot_url: params.screenshot_url,
      selected_personas: params.selected_personas ?? null,
      screen_context: params.screen_context ?? null,
      user_data: params.user_data ?? null,
      flow_images: params.flow_images ?? null,
      context_images: params.context_images ?? null,
      follow_up_audit_id: params.follow_up_audit_id ?? null,
      reaudit_type: params.reaudit_type ?? null,
      reaudit_user_note: params.reaudit_user_note ?? null,
      status: params.status ?? "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return transformAudit(data as Record<string, unknown>);
}

/**
 * Collect storage paths that are still referenced by any audit other than the given one.
 * Used so we don't delete a screenshot that is shared (e.g. feedback-only re-audit shares with original).
 */
async function getReferencedScreenshotPaths(excludeAuditId: string): Promise<Set<string>> {
  const { data: rows } = await supabase
    .from("audits")
    .select("screenshot_url, flow_images, context_images")
    .neq("id", excludeAuditId);
  const referenced = new Set<string>();
  for (const row of rows ?? []) {
    const r = row as { screenshot_url?: string; flow_images?: string[]; context_images?: string[] };
    if (r.screenshot_url && !r.screenshot_url.startsWith("http")) referenced.add(r.screenshot_url);
    if (Array.isArray(r.flow_images)) r.flow_images.forEach((p) => p && !p.startsWith("http") && referenced.add(p));
    if (Array.isArray(r.context_images)) r.context_images.forEach((p) => p && !p.startsWith("http") && referenced.add(p));
  }
  return referenced;
}

export async function deleteAudit(audit: Audit): Promise<void> {
  const screenshotPath = audit.screenshot_url?.trim();
  if (screenshotPath && !screenshotPath.startsWith("http")) {
    const referenced = await getReferencedScreenshotPaths(audit.id);
    if (!referenced.has(screenshotPath)) {
      await removeScreenshotPaths([screenshotPath]);
    }
  }

  const { error } = await supabase.from("audits").delete().eq("id", audit.id);
  if (error) throw error;
}

export async function updateAuditReport(
  auditId: string,
  ai_report: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("audits")
    .update({ ai_report })
    .eq("id", auditId);

  if (error) throw error;
}

export async function updateAuditReauditExplanation(
  auditId: string,
  reaudit_explanation: string
): Promise<void> {
  const { error } = await supabase
    .from("audits")
    .update({ reaudit_explanation })
    .eq("id", auditId);

  if (error) throw error;
}

export type UpdateAuditFeedbackParams = {
  feedback_rating: number | null;
  feedback_comment?: string | null;
};

export async function updateAuditFeedback(
  auditId: string,
  params: UpdateAuditFeedbackParams
): Promise<void> {
  const { error } = await supabase
    .from("audits")
    .update({
      feedback_rating: params.feedback_rating,
      feedback_comment: params.feedback_comment ?? null,
    })
    .eq("id", auditId);

  if (error) throw error;
}

export type AuditStat = { count: number; lastAuditAt: string | null };

/** Groups raw audit rows into per-project stats (count + latest created_at). */
export function groupAuditStats(
  rows: Array<{ project_id: string; created_at: string | null }>
): Map<string, AuditStat> {
  const map = new Map<string, AuditStat>();
  for (const row of rows) {
    const existing = map.get(row.project_id);
    const rowDate = row.created_at ?? null;
    if (!existing) {
      map.set(row.project_id, { count: 1, lastAuditAt: rowDate });
    } else {
      const latest =
        existing.lastAuditAt && rowDate && rowDate > existing.lastAuditAt
          ? rowDate
          : existing.lastAuditAt;
      map.set(row.project_id, { count: existing.count + 1, lastAuditAt: latest });
    }
  }
  return map;
}

/** Fetches audit count and last audit date for all projects belonging to the current user. */
export async function listProjectAuditStats(
  projectIds: string[]
): Promise<Map<string, AuditStat>> {
  if (projectIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("audits")
    .select("project_id, created_at")
    .in("project_id", projectIds)
    .eq("visible_in_app", true);
  if (error) throw error;
  return groupAuditStats(data ?? []);
}
