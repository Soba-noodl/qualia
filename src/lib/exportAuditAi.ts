import {
  type AiReport,
  type FlowAnalysis,
  type PrototypeCompleteness,
  type DesignSystemBlock,
} from "@/services/audit.service";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectContext {
  name: string;
  mission: string;
  constraints?: string | null;
}

export interface ExportAuditAiParams {
  aiReport: AiReport;
  projectContext: ProjectContext;
  date: string;
  isFlow: boolean;       // multi-upload flow
  isPrototype: boolean;  // aiReport.analysis_mode === "prototype"
  screenCount: number;   // total screens (for prototype source section)
  personas?: { name: string; description: string }[] | null;
  screenGoal?: string | null;
  prototypeUrl?: string | null;
  reauditScoreDelta?: number | null;
  reauditExplanation?: string | null;
}

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

export function engineLabel(engineId: string): string {
  const map: Record<string, string> = {
    system_logic: "System Logic",
    heuristic: "Heuristics",
    cognitive: "Cognitive",
    interaction: "Interaction",
  };
  return map[engineId] ?? engineId;
}

export function buildProjectContextSection(params: {
  name: string;
  mission: string;
  constraints?: string | null;
  personas: { name: string; description: string }[];
  screenGoal?: string | null;
}): string {
  const lines = [
    "## Project Context",
    "",
    `**Product:** ${params.name}`,
    `**Mission:** ${params.mission}`,
  ];
  if (params.constraints) lines.push(`**Constraints:** ${params.constraints}`);
  if (params.personas.length > 0) {
    lines.push(`**Personas:** ${params.personas.map(p => p.name).join(" · ")}`);
  }
  if (params.screenGoal) lines.push(`**Screen goal:** ${params.screenGoal}`);
  return lines.join("\n");
}

export function buildAuditSummarySection(params: {
  score: number;
  one_big_thing: string;
  sub_scores?: AiReport["sub_scores"];
  isPrototype: boolean;
}): string {
  const lines = [
    "## Audit Summary",
    "",
    `**Overall score:** ${params.score}/100`,
    `**One big thing:** ${params.one_big_thing}`,
  ];
  const ss = params.sub_scores;
  if (ss && (ss.system_logic_score != null || ss.heuristic_score != null)) {
    lines.push("**Sub-scores:**");
    if (ss.system_logic_score != null) lines.push(`- System logic: ${ss.system_logic_score}`);
    if (ss.heuristic_score != null) lines.push(`- Heuristics: ${ss.heuristic_score}`);
    if (ss.cognitive_score != null) lines.push(`- Cognitive: ${ss.cognitive_score}`);
    if (ss.interaction_score != null) lines.push(`- Interaction: ${ss.interaction_score}`);
    if (params.isPrototype && ss.prototype_completeness_score != null) {
      lines.push(`- Prototype completeness: ${ss.prototype_completeness_score}`);
    }
    if (params.isPrototype && ss.cross_frame_score != null) {
      lines.push(`- Cross-frame: ${ss.cross_frame_score}`);
    }
  }
  return lines.join("\n");
}

export function buildAuditSourceSection(params: {
  screenCount: number;
  prototypeUrl: string | null;
  deepFigmaUi: boolean;
}): string {
  const lines = [
    "## Audit Source",
    "",
    `**Type:** Prototype flow audit (${params.screenCount} screens crawled from Figma)`,
  ];
  if (params.prototypeUrl) {
    lines.push(`**Prototype URL:** ${params.prototypeUrl}`);
  }
  lines.push(
    `**Deep Figma UI analysis:** ${params.deepFigmaUi ? "Yes — component names and token data available." : "No"}`
  );
  return lines.join("\n");
}

export function buildFlowAnalysisSection(flowAnalysis: FlowAnalysis): string {
  const lines = ["## Flow Analysis", ""];
  if (flowAnalysis.step_transitions?.length) {
    lines.push("**Step transitions:**");
    flowAnalysis.step_transitions.forEach(t => {
      lines.push(`- Step ${t.from_step} → ${t.to_step}: ${t.severity.toUpperCase()} — ${t.issue}`);
    });
  }
  if (flowAnalysis.friction_points?.length) {
    lines.push("**Friction points:**");
    flowAnalysis.friction_points.forEach(fp => {
      lines.push(`- Step ${fp.step}: ${fp.issue}`);
      if (fp.suggestion) lines.push(`  → ${fp.suggestion}`);
    });
  }
  if (flowAnalysis.missing_steps?.length) {
    lines.push("**Missing steps:**");
    flowAnalysis.missing_steps.forEach(ms => {
      lines.push(`- After step ${ms.after_step}: ${ms.what_is_missing}`);
    });
  }
  return lines.join("\n");
}

export function buildPrototypeCompletenessSection(completeness: PrototypeCompleteness): string {
  const lines = ["## Prototype Completeness", ""];
  if (completeness.score != null) lines.push(`**Score:** ${completeness.score}/100`);
  if (completeness.findings?.length) {
    completeness.findings.forEach(f => {
      lines.push(`- ${f.issue}`);
      if (f.suggestion) lines.push(`  → ${f.suggestion}`);
    });
  }
  if (completeness.dead_ends) lines.push(`**Dead ends:** ${completeness.dead_ends}`);
  if (completeness.orphan_screens) lines.push(`**Orphan screens:** ${completeness.orphan_screens}`);
  if (completeness.missing_flows) lines.push(`**Missing flows:** ${completeness.missing_flows}`);
  return lines.join("\n");
}

// Design system dimensions can be a plain string (single-screen/flow prompts)
// or an object {rating, verdict, action} (prototype crawl prompt).
function formatDsDimension(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const v = value as Record<string, string>;
    const parts: string[] = [];
    if (v.rating) parts.push(`[${v.rating}]`);
    if (v.verdict) parts.push(v.verdict);
    if (v.action) parts.push(`→ ${v.action}`);
    return parts.length ? parts.join(" ") : null;
  }
  return null;
}

export function buildDesignSystemSection(ds: DesignSystemBlock): string {
  const lines = ["## Design System Review", ""];
  if (ds.verdict) lines.push(`**Verdict:** ${ds.verdict}`, "");
  const dimensions: [string, unknown][] = [
    ["Components", ds.components],
    ["Color", ds.color],
    ["Typography", ds.typography],
    ["Spacing / Layout", ds.spacing_layout],
    ["Interactive States", ds.interactive_states],
    ["Iconography", ds.iconography],
    ["Microcopy / Voice", ds.microcopy_voice],
    ["Token Consistency", ds.token_consistency],
    ["Component Library", ds.component_library],
  ];
  dimensions.forEach(([label, value]) => {
    const formatted = formatDsDimension(value);
    if (formatted) lines.push(`**${label}:** ${formatted}`);
  });
  return lines.join("\n");
}

// ─── Accessibility + Synth builders ──────────────────────────────────────────

function buildAccessibilitySection(accessibility: AiReport["accessibility"]): string {
  if (!accessibility) return "";
  const lines = ["## Accessibility", ""];
  const passed = accessibility.passed ? "PASS" : "FAIL";
  lines.push(`**WCAG level:** ${accessibility.wcag_level} · ${passed}`);
  if (accessibility.contrast_failures?.length) {
    lines.push("**Contrast failures:**");
    accessibility.contrast_failures.forEach(f => {
      // Handle both shapes:
      // regular:   {element, ratio, required}
      // prototype: {fg, bg, ratio, element_description, wcag_criterion, severity, suggestion}
      const raw = f as unknown as Record<string, unknown>;
      const label = (raw.element as string)
        ?? (raw.element_description as string)
        ?? (raw.fg && raw.bg ? `${raw.fg} on ${raw.bg}` : "element");
      const required = (raw.required as number) ?? 4.5;
      lines.push(`- ${label}: ratio ${f.ratio}:1 (required ${required}:1)`);
    });
  }
  if (accessibility.other_violations?.length) {
    lines.push("**Other violations:**");
    accessibility.other_violations.forEach(v => {
      lines.push(`- ${v.issue} · ${v.wcag_criterion} · ${v.severity}`);
    });
  }
  return lines.join("\n");
}

function buildSynthUsersSection(synthUsers: AiReport["synth_users"]): string {
  if (!synthUsers) return "";
  const lines = ["## Synthetic Users", ""];
  lines.push(`**Critical finding:** ${synthUsers.critical_finding}`);
  if (synthUsers.shared_friction?.length) {
    lines.push(`**Shared friction:** ${synthUsers.shared_friction.join(" · ")}`);
  }
  synthUsers.results?.forEach(r => {
    lines.push("");
    lines.push(`**${r.persona_name}:** ${r.verdict} · ${r.emotion}`);
    if ("diary_entry" in r && r.diary_entry) lines.push(`> "${r.diary_entry}"`);
    else if (r.reasoning) lines.push(`> "${r.reasoning}"`);
  });
  return lines.join("\n");
}

// ─── Issue block builder ──────────────────────────────────────────────────────

function buildIssueBlock(
  globalIndex: number,
  engine: string,
  issue: { issue: string; why_it_matters: string; suggestion: string; box_2d?: [number,number,number,number] | null }
): string {
  const lines = [
    `### Issue #${globalIndex + 1} · ${engineLabel(engine)}`,
    "",
    `**Problem:** ${issue.issue}`,
    `**Why it matters:** ${issue.why_it_matters}`,
    `**Suggestion:** ${issue.suggestion}`,
  ];
  if (issue.box_2d) {
    const [ymin, xmin, ymax, xmax] = issue.box_2d;
    lines.push(`**Location (0–1000 scale):** ymin=${ymin} xmin=${xmin} ymax=${ymax} xmax=${xmax}`);
  }
  return lines.join("\n");
}

// ─── Screen section builder ───────────────────────────────────────────────────

function buildScreenSection(params: {
  screenIndex: number;
  totalScreens: number;
  frameName?: string | null;
  issuesOnScreen: Array<{
    globalIndex: number;
    engine: string;
    issue: { issue: string; why_it_matters: string; suggestion: string; box_2d?: [number,number,number,number] | null };
  }>;
  isMultiScreen: boolean;
}): string {
  const { screenIndex, totalScreens, frameName, issuesOnScreen, isMultiScreen } = params;
  const baseLabel = isMultiScreen
    ? `## Screen ${screenIndex + 1} of ${totalScreens}`
    : `## Screen`;
  const screenLabel = frameName ? `${baseLabel} — "${frameName}"` : baseLabel;

  const lines = [screenLabel, ""];
  issuesOnScreen.forEach(({ globalIndex, engine, issue }) => {
    lines.push(buildIssueBlock(globalIndex, engine, issue));
    lines.push("");
  });
  return lines.join("\n");
}

// ─── Flat issue list from all engines ────────────────────────────────────────

interface FlatIssue {
  engine: string;
  issue: { issue: string; why_it_matters: string; suggestion: string; box_2d?: [number,number,number,number] | null; image_index?: number | null };
  globalIndex: number;
}

function flattenIssues(engines: AiReport["engines"]): FlatIssue[] {
  const flat: FlatIssue[] = [];
  const engineOrder = ["system_logic", "heuristic", "cognitive", "interaction"] as const;
  engineOrder.forEach(eng => {
    (engines[eng] ?? []).forEach(issue => {
      flat.push({ engine: eng, issue, globalIndex: flat.length });
    });
  });
  return flat;
}

// ─── Download trigger ─────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  // eslint-disable-next-line no-restricted-syntax -- REACT-004: standard file-download idiom (createElement + click + remove)
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Main export function ─────────────────────────────────────────────────────

export function exportAuditAi(params: ExportAuditAiParams): void {
  const {
    aiReport, projectContext, date, isFlow, isPrototype, screenCount,
    personas, screenGoal,
  } = params;

  const allIssues = flattenIssues(aiReport.engines);
  const isMultiScreen = isFlow || isPrototype;
  const screenLabels: string[] = aiReport.screen_labels ?? [];
  const sections: string[] = [];

  // ── Header ──
  sections.push(`# Qualia AI Export`);
  sections.push(`Generated: ${date} · Format: Qualia AI Context v1`);
  sections.push("---");

  // ── Project Context ──
  sections.push(buildProjectContextSection({
    name: projectContext.name,
    mission: projectContext.mission,
    constraints: projectContext.constraints,
    personas: personas ?? [],
    screenGoal,
  }));
  sections.push("---");

  // ── Audit Source (prototype only) ──
  if (isPrototype) {
    sections.push(buildAuditSourceSection({
      screenCount,
      prototypeUrl: params.prototypeUrl ?? null,
      deepFigmaUi: !!aiReport.deep_figma_ui,
    }));
    sections.push("---");
  }

  // ── Audit Summary ──
  sections.push(buildAuditSummarySection({
    score: aiReport.score,
    one_big_thing: aiReport.one_big_thing,
    sub_scores: aiReport.sub_scores,
    isPrototype,
  }));
  sections.push("---");

  // ── Flow Analysis (prototype only) ──
  if (isPrototype && aiReport.flow_analysis) {
    sections.push(buildFlowAnalysisSection(aiReport.flow_analysis));
    sections.push("---");
  }

  // ── Prototype Completeness (prototype only) ──
  if (isPrototype && aiReport.prototype_completeness) {
    sections.push(buildPrototypeCompletenessSection(aiReport.prototype_completeness));
    sections.push("---");
  }

  // ── Flow-Level Issues (multi-screen only: image_index = null means whole flow) ──
  if (isMultiScreen) {
    const flowLevelIssues = allIssues.filter(fi => fi.issue.image_index == null);
    if (flowLevelIssues.length > 0) {
      const lines = ["## Flow-Level Issues", ""];
      flowLevelIssues.forEach(fi => {
        lines.push(`### Flow Issue · ${engineLabel(fi.engine)}`);
        lines.push(`**Problem:** ${fi.issue.issue}`);
        lines.push(`**Why it matters:** ${fi.issue.why_it_matters}`);
        lines.push(`**Suggestion:** ${fi.issue.suggestion}`);
        lines.push("");
      });
      sections.push(lines.join("\n"));
      sections.push("---");
    }
  }

  // ── Screen sections ──
  if (isMultiScreen) {
    const screenIndices = [...new Set(
      allIssues
        .filter(fi => fi.issue.image_index != null)
        .map(fi => fi.issue.image_index as number)
    )].sort((a, b) => a - b);

    screenIndices.forEach(i => {
      const issuesOnScreen = allIssues.filter(fi => fi.issue.image_index === i);
      sections.push(buildScreenSection({
        screenIndex: i,
        totalScreens: screenCount,
        frameName: screenLabels[i] ?? null,
        issuesOnScreen,
        isMultiScreen: true,
      }));
      sections.push("---");
    });
  } else {
    sections.push(buildScreenSection({
      screenIndex: 0,
      totalScreens: 1,
      frameName: screenLabels[0] ?? null,
      issuesOnScreen: allIssues,
      isMultiScreen: false,
    }));
    sections.push("---");
  }

  // ── Accessibility ──
  if (aiReport.accessibility) {
    const accSection = buildAccessibilitySection(aiReport.accessibility);
    if (accSection) { sections.push(accSection); sections.push("---"); }
  }

  // ── Synthetic Users ──
  if (aiReport.synth_users) {
    const synthSection = buildSynthUsersSection(aiReport.synth_users);
    if (synthSection) { sections.push(synthSection); sections.push("---"); }
  }

  // ── Design System Review (prototype only) ──
  if (isPrototype && aiReport.design_system) {
    sections.push(buildDesignSystemSection(aiReport.design_system));
    sections.push("---");
  }

  sections.push("*Generated by Qualia · qualia-ux.com*");

  triggerDownload(sections.join("\n\n"), "audit-ai-export.md");
}
