/**
 * Shared analyze execution: sanitization, prompt building, AI call, response parsing.
 */

import { SINGLE_SCREEN_PROMPT, FLOW_ANALYSIS_PROMPT, AUTO_CRAWL_PROMPT, FIGMA_PROTOTYPE_CRAWL_PROMPT, NODE_MAP_INSTRUCTIONS } from "./analyze-prompts.ts";
import { runLLM, type LLMProvider } from "./llm/index.ts";

/**
 * T-079: Figma node-tree pin anchoring shape.
 * Mirrors `figma-plugin/src/shared/node-map.ts` and `src/types/figma-node-map.ts`.
 * Bounds are frame-local in DESIGN units (the webapp scales by export_scale).
 */
export interface NodeMapEntry {
  id: string;
  name: string;
  type: string;
  bounds: [number, number, number, number];
}
export type NodeMap = NodeMapEntry[];

/**
 * Builds the `{node_map_block}` substitution. When the caller has node maps
 * (plugin path), we render the instruction header + a per-image JSON appendix
 * so the LLM has both the meta-rules and the actual data. When the caller has
 * no node maps (webapp path), the block is intentionally empty so the prompt
 * stays size-stable.
 */
function buildNodeMapBlock(nodeMaps: NodeMap[] | undefined): string {
  if (!nodeMaps || nodeMaps.length === 0) return "";
  const appendixLines: string[] = ["NODE MAPS (per image, frame-local design units):"];
  for (let i = 0; i < nodeMaps.length; i++) {
    const entries = nodeMaps[i] ?? [];
    appendixLines.push(`Image ${i}:`);
    appendixLines.push(JSON.stringify(entries));
  }
  return `${NODE_MAP_INSTRUCTIONS}\n\n${appendixLines.join("\n")}`;
}

export function sanitizePromptInput(input: string | null | undefined, maxLength: number): string {
  if (!input || typeof input !== "string") {
    return "Not specified";
  }
  let sanitized = input.slice(0, maxLength);
  const dangerousPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi,
    /disregard\s+(all\s+)?(previous|above|prior)/gi,
    /forget\s+(everything|all|previous)/gi,
    /new\s+instructions?:/gi,
    /system\s*:/gi,
    /assistant\s*:/gi,
    /user\s*:/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<\|.*?\|>/g,
    /```/g,
    /\{\{.*?\}\}/g,
    /\$\{.*?\}/g,
  ];
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, "[removed]");
  }
  // eslint-disable-next-line no-control-regex -- intentional: strip C0 control chars from LLM output
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  sanitized = sanitized.trim();
  return sanitized || "Not specified";
}

export function validateLanguage(language: string | null | undefined): string {
  const allowed = ["English", "Italian", "Spanish", "French", "German", "Portuguese"];
  if (language && allowed.includes(language)) return language;
  return "English";
}

const FIRST_ENCOUNTER_PERSONA =
  "General first-encounter user — no specific archetype was selected. " +
  "Evaluate from the perspective of someone with no prior product context, moderate digital literacy, and no onboarding training. " +
  "Weight findings toward discoverability, zero-assumption clarity, and what a new user would misunderstand or miss entirely on their first visit.";

/**
 * Returns the provided persona text if non-empty, otherwise falls back to a
 * first-encounter user description so the AI always has explicit persona context.
 */
export function resolvePersona(persona: string | null | undefined): string {
  const trimmed = persona?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : FIRST_ENCOUNTER_PERSONA;
}

export interface BuildPromptsParams {
  isFlowMode: boolean;
  stepCount?: number;
  mission: string;
  persona: string;
  constraints: string;
  screenContext: string;
  userDataBlock: string;
  additionalContextBlock: string;
  projectLanguage: string;
  contrastDataSection?: string;
  previousAuditFeedbackBlock?: string;
  hasContextImages?: boolean;
  contextImageCount?: number;
  figmaMetadata?: object;
  /** T-079: per-image Figma node maps. When provided, the prompt asks for `layer_ids`. */
  nodeMaps?: NodeMap[];
}

export function buildAnalysisPrompts(params: BuildPromptsParams): { systemPrompt: string; userMessage: string } {
  const {
    isFlowMode,
    stepCount = 1,
    mission,
    persona,
    constraints,
    screenContext,
    userDataBlock,
    additionalContextBlock,
    projectLanguage,
    contrastDataSection = "",
    previousAuditFeedbackBlock = "",
    hasContextImages = false,
    contextImageCount = 0,
    figmaMetadata,
    nodeMaps,
  } = params;

  const nodeMapBlock = buildNodeMapBlock(nodeMaps);

  if (isFlowMode) {
    const systemPrompt = FLOW_ANALYSIS_PROMPT.replace("{step_count}", String(stepCount))
      .replace("{project_mission}", mission)
      .replace("{project_persona}", resolvePersona(persona))
      .replace("{project_constraints}", constraints)
      .replace("{screen_context}", screenContext)
      .replace("{user_data_block}", userDataBlock)
      .replace("{additional_context_block}", additionalContextBlock)
      .replace("{project_language}", projectLanguage)
      .replace("{previous_audit_feedback}", previousAuditFeedbackBlock)
      .replace("{contrast_data}", contrastDataSection)
      .replace("{node_map_block}", nodeMapBlock);

    const userMessage = `Here is the User Flow Sequence containing ${stepCount} steps.
The images are provided in ORDER: Image 1 = Step 1, Image 2 = Step 2, etc.

Please execute the DEEP DIVE analysis as defined in your System Prompt. Remember to evaluate BOTH the Logic (Interaction) AND the Visual Execution (UI/Accessibility). Provide detailed, actionable insights using the trigger/psychology/risk framework.${userDataBlock ? "\n\nIMPORTANT: User data was provided in the system prompt. You MUST reference it in your analysis (e.g. in one_big_thing or in specific issues) and explain how the flow supports or contradicts that evidence." : ""}

Write your analysis in ${projectLanguage}. Return ONLY valid JSON.`;

    return { systemPrompt, userMessage };
  }

  const systemPrompt = SINGLE_SCREEN_PROMPT.replace("{project_mission}", mission)
    .replace("{project_persona}", persona)
    .replace("{project_constraints}", constraints)
    .replace("{screen_context}", screenContext)
    .replace("{user_data_block}", userDataBlock)
    .replace("{additional_context_block}", additionalContextBlock)
    .replace("{project_language}", projectLanguage)
    .replace("{previous_audit_feedback}", previousAuditFeedbackBlock)
    .replace("{contrast_data}", contrastDataSection)
    .replace("{node_map_block}", nodeMapBlock);

  let userMessage: string;
  if (hasContextImages && contextImageCount) {
    userMessage = `Analyze this UI screenshot. The FIRST image is the TARGET to audit. The subsequent ${contextImageCount} image(s) are CONTEXT screens (previous/next steps) - use them to understand the user journey but do NOT audit them.

Apply the ALISSA filter strictly - only flag true blockers. For CONTRAST/ACCESSIBILITY: Use ONLY the 'HARD DATA - ACCESSIBILITY' section from the system prompt. Do NOT guess contrast ratios.${userDataBlock ? " User data was provided in the system prompt — you MUST reference it in your analysis (e.g. in one_big_thing or in issues) and explain how the design supports or contradicts that evidence." : ""} Write your analysis in ${projectLanguage}. Return ONLY valid JSON.`;
  } else {
    userMessage = `Analyze this UI screenshot. Apply the ALISSA filter strictly - only flag true blockers. For CONTRAST/ACCESSIBILITY: Use ONLY the 'HARD DATA - ACCESSIBILITY' section from the system prompt. Do NOT guess contrast ratios.${userDataBlock ? " User data was provided in the system prompt — you MUST reference it in your analysis (e.g. in one_big_thing or in issues) and explain how the design supports or contradicts that evidence." : ""} Write your analysis in ${projectLanguage}. Return ONLY valid JSON.`;
  }
  if (figmaMetadata != null && typeof figmaMetadata === "object") {
    userMessage += `\n\nThe Figma node summary below refers to the TARGET image (the first image) only—not to any context images. Use it to ground your issues to specific elements (by node id/name) and to infer semantic roles (e.g. button, card). Where relevant, mention design-token or spacing consistency. Do not apply this metadata to context images.\n\nFIGMA NODE SUMMARY (TARGET ONLY):\n${JSON.stringify(figmaMetadata)}`;
  }

  return { systemPrompt, userMessage };
}

export interface BuildAutoCrawlPromptsParams {
  stepCount: number;
  crawlUrl: string;
  mission: string;
  persona: string;
  constraints: string;
  screenContext: string;
  userDataBlock: string;
  additionalContextBlock: string;
  projectLanguage: string;
}

export function buildAutoCrawlPrompts(params: BuildAutoCrawlPromptsParams): { systemPrompt: string; userMessage: string } {
  const {
    stepCount,
    crawlUrl,
    mission,
    persona,
    constraints,
    screenContext,
    userDataBlock,
    additionalContextBlock,
    projectLanguage,
  } = params;

  const systemPrompt = AUTO_CRAWL_PROMPT
    .replace("{step_count}", String(stepCount))
    .replace("{crawl_url}", crawlUrl)
    .replace("{project_mission}", mission)
    .replace("{project_persona}", persona)
    .replace("{project_constraints}", constraints)
    .replace("{screen_context}", screenContext)
    .replace("{user_data_block}", userDataBlock)
    .replace("{additional_context_block}", additionalContextBlock)
    .replace("{project_language}", projectLanguage);

  const userMessage = `Here are ${stepCount} screenshots from the auto-crawl session of ${crawlUrl}, in navigation order: landing → primary sections → CTA interactions → detail views.

Analyze the full product experience across all screenshots using the Qualia 4-engine framework, then complete the Cross-Session Layer and Design System Coherence sections.

Write your analysis in ${projectLanguage}. Return ONLY valid JSON.`;

  return { systemPrompt, userMessage };
}

export interface BuildPrototypeCrawlPromptsParams {
  stepCount: number;
  figmaFileName: string;
  frameMap: string;
  hasPrototypeConnections: boolean;
  designTokenSummary: string;
  mission: string;
  persona: string;
  constraints: string;
  screenContext: string;
  userDataBlock: string;
  additionalContextBlock: string;
  projectLanguage: string;
  /** T-079: per-image Figma node maps. When provided, the prompt asks for `layer_ids`. */
  nodeMaps?: NodeMap[];
}

export function buildPrototypeCrawlPrompts(
  params: BuildPrototypeCrawlPromptsParams
): { systemPrompt: string; userMessage: string } {
  const {
    stepCount, figmaFileName, frameMap, hasPrototypeConnections, designTokenSummary,
    mission, persona, constraints, screenContext,
    userDataBlock, additionalContextBlock, projectLanguage, nodeMaps,
  } = params;

  const connectionNote = hasPrototypeConnections
    ? "This prototype has explicit click-through connections between frames. Frames are ordered by BFS traversal starting from entry screens."
    : "This prototype has no click connections — frames are shown in canvas layout order (top→bottom, left→right).";

  const nodeMapBlock = buildNodeMapBlock(nodeMaps);

  const systemPrompt = FIGMA_PROTOTYPE_CRAWL_PROMPT
    .replace("{step_count}", String(stepCount))
    .replace("{figma_file_name}", figmaFileName)
    .replace("{frame_map}", frameMap)
    .replace("{connection_note}", connectionNote)
    .replace("{design_token_summary}", designTokenSummary)
    .replace("{project_mission}", mission)
    .replace("{project_persona}", persona)
    .replace("{project_constraints}", constraints)
    .replace("{screen_context}", screenContext)
    .replace("{user_data_block}", userDataBlock)
    .replace("{additional_context_block}", additionalContextBlock)
    .replace("{project_language}", projectLanguage)
    .replace("{node_map_block}", nodeMapBlock);

  const tokenNote = "The DESIGN TOKEN SNAPSHOT in the system prompt contains real color, typography, spacing, and contrast data extracted from the Figma file — reference specific values in your design system and accessibility findings.";

  const userMessage = hasPrototypeConnections
    ? `Here are ${stepCount} frames from the Figma prototype "${figmaFileName}", ordered by BFS traversal of the prototype connection graph — starting from entry screens and following click connections.

The Frame Map above shows which frame connects to which. Use it to evaluate navigation completeness and dead ends.

${tokenNote}

Analyze the full prototype design using the Qualia 4-engine framework, then complete the Prototype Completeness, Frame Coherence, and Design System sections.

Write your analysis in ${projectLanguage}. Return ONLY valid JSON.`
    : `Here are ${stepCount} frames from the Figma prototype "${figmaFileName}", ordered by canvas position. No prototype connections were found — these are treated as a set of design screens.

${tokenNote}

Analyze the full design across all screens using the Qualia 4-engine framework, then complete the Prototype Completeness, Frame Coherence, and Design System sections.

Write your analysis in ${projectLanguage}. Return ONLY valid JSON.`;

  return { systemPrompt, userMessage };
}

export interface AnalysisResult {
  score: number;
  analysis_mode: "single" | "flow";
  step_count: number;
  sub_scores: {
    system_logic_score: number;
    heuristic_score: number;
    cognitive_score: number;
    interaction_score: number;
    prototype_completeness_score?: number;
    cross_frame_score?: number;
  };
  one_big_thing: string;
  flow_analysis: unknown;
  engines: Record<string, unknown[]>;
  accessibility: unknown;
  /** Auto-crawl only: cross-session layer */
  cross_session?: unknown;
  /** Prototype mode only: cross-frame coherence */
  cross_frame?: {
    score: number;
    findings: Array<{ issue: string; why_it_matters: string; suggestion: string; image_index?: number | null; box_2d?: [number, number, number, number] | null; layer_ids?: string[] | null }>;
  } | null;
  /** Prototype mode only: flow coverage and dead ends */
  prototype_completeness?: {
    score: number;
    findings: Array<{ issue: string; why_it_matters: string; suggestion: string; image_index?: number | null; box_2d?: [number, number, number, number] | null; layer_ids?: string[] | null }>;
  } | null;
  /** Auto-crawl + prototype: design system coherence */
  design_system?: unknown;
}

/** Strip markdown code fences (```json ... ```) that some providers wrap JSON in.
 *  Also handles leading prose like "Here's the JSON:\n\n```json{...}```" by
 *  trimming everything before the first { and after the last }.
 */
function stripJsonWrappers(raw: string): string {
  let s = raw.trim();
  // Common shape: ```json\n{...}\n``` or ```\n{...}\n```
  s = s.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  // Sometimes models emit prose before/after the JSON object. Trim to outermost braces.
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }
  return s.trim();
}

/** Attempt JSON.parse with lightweight repair steps:
 *  1. Direct parse.
 *  2. Strip markdown code fences + outer prose, re-parse.
 *  3. Bracket-close (handles truncated output).
 */
function parseAiJson(raw: string, tag: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch (firstErr) {
    // Step 2: try stripping markdown / prose wrappers
    const unwrapped = stripJsonWrappers(raw);
    if (unwrapped !== raw.trim()) {
      try {
        const result = JSON.parse(unwrapped);
        // Privacy: do not log model content (see privacy.ts:50).
        console.warn(`${tag} JSON parsed after stripping wrappers (length=${raw.length})`);
        return result;
      } catch {
        // fall through to bracket repair
      }
    }
    // Step 3: bracket repair (handles token-truncated output)
    const candidate = unwrapped !== raw.trim() ? unwrapped : raw;
    const opens: string[] = [];
    for (const ch of candidate) {
      if (ch === "{" || ch === "[") opens.push(ch === "{" ? "}" : "]");
      else if (ch === "}" || ch === "]") opens.pop();
    }
    const repaired = candidate + opens.reverse().join("");
    try {
      const result = JSON.parse(repaired);
      console.warn(`${tag} JSON repaired (${opens.length} bracket(s) closed)`);
      return result;
    } catch {
      console.error(
        `${tag} JSON parse failed after all repair attempts (length=${raw.length}, err=${firstErr instanceof Error ? firstErr.constructor.name : "unknown"})`,
      );
      throw firstErr;
    }
  }
}

export interface CallAiAndParseOpts {
  userId: string;
  isTrialEligible: boolean;
  requestedProvider?: LLMProvider;
  requestedModel?: string;
  promptVersion?: string;
}

export async function callAiAndParse(
  systemPrompt: string,
  userMessage: string,
  imageUrls: string[],
  contextUrls: string[],
  isFlowMode: boolean,
  opts: CallAiAndParseOpts,
  maxTokensOverride?: number,
  maxAttempts?: number,
  timeoutMs?: number,
  imageLabels?: string[],
  auditId?: string | null,
): Promise<AnalysisResult> {
  const result = await runLLM({
    userId: opts.userId,
    isTrialEligible: opts.isTrialEligible,
    requestedProvider: opts.requestedProvider,
    requestedModel: opts.requestedModel,
    systemPrompt,
    userMessage,
    imageUrls,
    contextUrls,
    imageLabels,
    // Token budgets tuned 2026-05-20 after a flow audit on a haiku-class model hit
    // the cap at 8000 tokens (truncated JSON → parse failure). Bumped generously
    // so prose-heavy models (OpenAI mini) have headroom.
    maxTokens: maxTokensOverride ?? (isFlowMode ? 16000 : 6000),
    maxAttempts,
    timeoutMs,
    auditId,
    promptVersion: opts.promptVersion,
  });

  if (result.finishReason === "length") {
    console.error("[analyze-run] response truncated — JSON will likely be malformed");
  }

  // Use the existing parseAiJson repair logic
  const raw = parseAiJson(result.content, "[analyze-run]");

  if (typeof raw !== "object" || raw === null) throw new Error("AI response is not a valid JSON object");

  const sub = raw.sub_scores || {};
  const systemLogicScore = Math.max(0, Math.min(100, sub.system_logic_score ?? 0));
  const heuristicScore = Math.max(0, Math.min(100, sub.heuristic_score ?? 0));
  const cognitiveScore = Math.max(0, Math.min(100, sub.cognitive_score ?? 0));
  const interactionScore = Math.max(0, Math.min(100, sub.interaction_score ?? 0));

  const pcScore = typeof raw.prototype_completeness?.score === "number"
    ? Math.max(0, Math.min(100, raw.prototype_completeness.score))
    : null;
  const cfScore = typeof raw.cross_frame?.score === "number"
    ? Math.max(0, Math.min(100, raw.cross_frame.score))
    : null;

  const scoreInputs = [systemLogicScore, heuristicScore, cognitiveScore, interactionScore];
  if (pcScore !== null) scoreInputs.push(pcScore);
  if (cfScore !== null) scoreInputs.push(cfScore);
  const overallScore = Math.round(scoreInputs.reduce((a, b) => a + b, 0) / scoreInputs.length);

  return {
    score: overallScore,
    analysis_mode: isFlowMode ? "flow" : "single",
    step_count: imageUrls.length,
    sub_scores: {
      system_logic_score: systemLogicScore,
      heuristic_score: heuristicScore,
      cognitive_score: cognitiveScore,
      interaction_score: interactionScore,
      ...(pcScore !== null ? { prototype_completeness_score: pcScore } : {}),
      ...(cfScore !== null ? { cross_frame_score: cfScore } : {}),
    },
    one_big_thing: raw.one_big_thing || "No key recommendation provided.",
    flow_analysis: raw.flow_analysis || null,
    engines: raw.engines || {
      system_logic: [],
      heuristic: [],
      cognitive: [],
      interaction: [],
    },
    accessibility: raw.accessibility || null,
    cross_session: raw.cross_session || null,
    cross_frame: raw.cross_frame || null,
    prototype_completeness: raw.prototype_completeness || null,
    design_system: raw.design_system || null,
  };
}
