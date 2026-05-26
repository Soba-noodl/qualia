/**
 * Lightweight Gemini call helper for synthetic user persona simulation.
 * Mirrors callAiAndParse from analyze-run.ts but tailored for synth output schema.
 */

import { SYNTH_MASTER_PROMPT, SYNTH_FLOW_ADDENDUM, SYNTH_PERSONA_PROFILES } from "./synth-prompts.ts";
import { sanitizePromptInput } from "./analyze-run.ts";
import { runLLM, type LLMProvider } from "./llm/index.ts";

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

export const VALID_SYNTH_PERSONA_IDS = new Set([
  "power_user",
  "spreadsheet_veteran",
  "admin_gatekeeper",
  "the_boss",
  "automator",
  "daily_driver",
]);

const PERSONA_NAMES: Record<string, string> = {
  power_user: "Power User",
  spreadsheet_veteran: "Spreadsheet Veteran",
  admin_gatekeeper: "Admin Gatekeeper",
  the_boss: "The Boss",
  automator: "Automator",
  daily_driver: "Daily Driver",
};

const VALID_VERDICTS = new Set(["PASS", "FRICTION", "BLOCKER"]);
const VALID_EMOTIONS = new Set(["Satisfied", "Confused", "Frustrated", "Anxious"]);
const VALID_ACTIONS = new Set(["CLICK", "TYPE", "ABANDON"]);

function buildSynthPrompt(personaId: string, projectContext: string, isFlow: boolean): string {
  const profile = SYNTH_PERSONA_PROFILES[personaId];
  if (!profile) throw new Error(`Unknown persona_id: ${personaId}`);
  const base = SYNTH_MASTER_PROMPT
    .replace("{persona_profile}", profile)
    .replace("{project_context}", projectContext);
  return isFlow ? base + SYNTH_FLOW_ADDENDUM : base;
}

/** One Gemini call, images attached once — reduces Storage egress vs N persona calls each re-fetching URLs. */
function buildBatchSynthSystemPrompt(personaIds: string[], projectContext: string, isFlow: boolean): string {
  const blocks = personaIds.map((id) => {
    const profile = SYNTH_PERSONA_PROFILES[id];
    if (!profile) throw new Error(`Unknown persona_id: ${id}`);
    return `#### persona_id: ${id}\n${profile}`;
  });

  const outputShape = `{
  "persona_results": [
    {
      "persona_id": "<must match one of the persona_id values below>",
      "simulation_meta": {
        "adopted_persona": "[Name from that persona's profile]",
        "situational_context": "I am aware that I just... [derived from context]",
        "current_goal": "I am looking for... [what this screen must provide]"
      },
      "visual_audit": {
        "zone_detected": "[Setup / Data / Work / Nav]",
        "primary_focus": "[First element noticed on TARGET image]",
        "missing_affordance": "[What is missing on TARGET image given the context, or 'nothing' if PASS]",
        "persona_reaction": "[Specific reaction based on that persona's traits relevant to this screen type]"
      },
      "diary_entry": {
        "thought_process": "First-person monologue for THIS persona only.",
        "emotion": "[Satisfied / Confused / Frustrated / Anxious]"
      },
      "decision": {
        "verdict": "[PASS / FRICTION / BLOCKER]",
        "next_action": "[CLICK / TYPE / ABANDON]",
        "target_element": "[Element Name or 'nothing']",
        "reasoning": "Why I am doing this."
      }
    }
  ]
}`;

  return `### BATCH B2B SYNTHETIC USER ENGINE

You will receive the SAME screenshot(s) for every persona. Analyze the UI once visually, but produce ONE independent simulation per persona listed below.

RULES:
- Output exactly ${personaIds.length} objects in persona_results, in this order: ${personaIds.join(", ")}.
- Each object MUST include the correct "persona_id" matching its slot.
- Fully embody each persona separately (biases, heuristics, voice) — do not merge personas.
- Use the same JSON shape per persona as specified below (no markdown fences).

PERSONA PROFILES:
${blocks.join("\n\n---\n\n")}

---

2. INPUT ARCHITECTURE
RAW_TEXT_CONTEXT:
${projectContext}

CURRENT_TARGET_IMAGE(S): The image(s) in the user message are the sole target of all verdicts.

---

3. COGNITIVE LOOP (apply separately per persona)
Same as single-persona synth: situational grounding → knowledge filter → visual audit → verdict & monologue.
${isFlow ? SYNTH_FLOW_ADDENDUM : ""}

---

4. OUTPUT FORMAT (strict JSON object only)
${outputShape}`;
}

function parseGeminiJsonContent(content: string): Record<string, unknown> {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();
  // Privacy: we never log model output content (see privacy.ts:50).
  // Length-only signal is enough for debugging truncation issues.
  console.info(`[synth-run] response length=${jsonString.length} chars`);
  try {
    return JSON.parse(jsonString) as Record<string, unknown>;
  } catch (firstErr) {
    const opens: string[] = [];
    for (const ch of jsonString) {
      if (ch === "{" || ch === "[") opens.push(ch === "{" ? "}" : "]");
      else if (ch === "}" || ch === "]") opens.pop();
    }
    const repaired = jsonString + opens.reverse().join("");
    try {
      const result = JSON.parse(repaired) as Record<string, unknown>;
      console.warn(`[synth-run] JSON repaired (${opens.length} bracket(s) closed)`);
      return result;
    } catch {
      console.error(`[synth-run] JSON parse failed after repair (length=${jsonString.length})`);
      throw firstErr;
    }
  }
}

interface SynthCallOpts {
  userId: string;
  isTrialEligible: boolean;
  requestedProvider?: LLMProvider;
  requestedModel?: string;
  promptVersion?: string;
}

async function callGeminiSynthRaw(
  systemPrompt: string,
  userInstruction: string,
  imageUrls: string[],
  opts: SynthCallOpts,
  maxTokens: number,
  auditId?: string | null,
): Promise<Record<string, unknown>> {
  const result = await runLLM({
    userId: opts.userId,
    isTrialEligible: opts.isTrialEligible,
    requestedProvider: opts.requestedProvider,
    requestedModel: opts.requestedModel,
    systemPrompt,
    userMessage: userInstruction,
    imageUrls,
    maxTokens,
    maxAttempts: 3,
    auditId,
    promptVersion: opts.promptVersion,
  });

  if (result.finishReason === "length") {
    console.error("[synth-run] response truncated (finish_reason=length) — JSON will likely be malformed");
  }
  if (!result.content) {
    console.error("[synth-run] Empty content in response.");
    throw new Error("No content in synth response");
  }

  try {
    return parseGeminiJsonContent(result.content);
  } catch (parseErr) {
    // Privacy: do not log model content. Length + error class is enough.
    console.error(
      `[synth-run] JSON parse failed (length=${result.content.length}, err=${parseErr instanceof Error ? parseErr.constructor.name : "unknown"})`,
    );
    throw parseErr;
  }
}

/** Batch: one request, images once. ~3× less URL fetch pressure on Storage than parallel per-persona calls. */
async function callGeminiForSynthBatch(
  personaIds: string[],
  projectContext: string,
  imageUrls: string[],
  opts: SynthCallOpts,
  isFlow: boolean,
  auditId?: string | null,
): Promise<SynthUserResult[]> {
  const systemPrompt = buildBatchSynthSystemPrompt(personaIds, projectContext, isFlow);
  const userInstruction = isFlow
    ? `Analyze this complete user flow (${imageUrls.length} sequential steps shown in order). Return ONLY the JSON object with persona_results for all ${personaIds.length} personas.`
    : `Analyze this UI screen. Return ONLY the JSON object with persona_results for all ${personaIds.length} personas.`;

  // ~3 personas × structured JSON — allow headroom vs single 3000-token responses
  const parsed = await callGeminiSynthRaw(systemPrompt, userInstruction, imageUrls, opts, 9000, auditId);
  const rawList = parsed.persona_results;
  if (!Array.isArray(rawList)) {
    throw new Error("Missing or invalid persona_results array");
  }

  return personaIds.map((personaId, index) => {
    const fromId = rawList.find(
      (item) =>
        item &&
        typeof item === "object" &&
        String((item as Record<string, unknown>).persona_id ?? "") === personaId
    ) as Record<string, unknown> | undefined;
    const fromOrder = rawList[index] as Record<string, unknown> | undefined;
    const raw = fromId ?? fromOrder;
    if (!raw || typeof raw !== "object") {
      console.warn(`[synth-run] batch: missing block for ${personaId} at index ${index}`);
      return {
        persona_id: personaId,
        persona_name: PERSONA_NAMES[personaId] ?? personaId,
        verdict: "FRICTION" as const,
        emotion: "Confused" as const,
        diary_entry: "Analysis unavailable for this persona.",
        missing_affordance: "",
        next_action: "ABANDON" as const,
        reasoning: "Incomplete batch response.",
      };
    }
    return mapToSynthResult(personaId, raw);
  });
}

function callGeminiForSynth(
  systemPrompt: string,
  imageUrls: string[],
  opts: SynthCallOpts,
  isFlow: boolean,
  auditId?: string | null,
): Promise<Record<string, unknown>> {
  const userInstruction = isFlow
    ? `Analyze this complete user flow (${imageUrls.length} sequential steps shown in order) as your persona. Walk through each step and evaluate the full journey. Return ONLY valid JSON matching the specified output format.`
    : "Analyze this UI screen as your persona. Return ONLY valid JSON matching the specified output format.";
  return callGeminiSynthRaw(systemPrompt, userInstruction, imageUrls, opts, 3000, auditId);
}

function mapToSynthResult(personaId: string, raw: Record<string, unknown>): SynthUserResult {
  // The model may occasionally wrap the response under a top-level key — unwrap if needed
  const unwrapped: Record<string, unknown> =
    raw.decision || raw.diary_entry || raw.visual_audit
      ? raw
      : (Object.values(raw).find((v) => v && typeof v === "object" && (v as Record<string, unknown>).decision) as Record<string, unknown>) ?? raw;

  const decision = (unwrapped.decision ?? {}) as Record<string, unknown>;
  const diaryEntry = (unwrapped.diary_entry ?? {}) as Record<string, unknown>;
  const visualAudit = (unwrapped.visual_audit ?? {}) as Record<string, unknown>;
  const simulationMeta = (unwrapped.simulation_meta ?? {}) as Record<string, unknown>;

  console.info(`[synth-run] ${personaId} raw keys: ${Object.keys(unwrapped).join(",")} | decision keys: ${Object.keys(decision).join(",")} | diary keys: ${Object.keys(diaryEntry).join(",")}`);

  const verdict = String(decision.verdict ?? "FRICTION");
  const emotion = String(diaryEntry.emotion ?? "Confused");
  const nextAction = String(decision.next_action ?? "ABANDON");

  // Diary entry: prefer thought_process, fall back to persona_reaction → situational_context
  const rawDiaryEntry = String(diaryEntry.thought_process ?? "").trim();
  const diaryEntryFallback = String(visualAudit.persona_reaction ?? simulationMeta.situational_context ?? "").trim();
  const resolvedDiaryEntry = rawDiaryEntry || diaryEntryFallback;

  // Reasoning: prefer decision.reasoning, fall back to missing_affordance
  const rawReasoning = String(decision.reasoning ?? "").trim();
  const resolvedReasoning = rawReasoning || String(visualAudit.missing_affordance ?? "").trim();

  if (!resolvedDiaryEntry && !resolvedReasoning) {
    console.warn(`[synth-run] ${personaId}: all text fields empty. Raw keys: ${Object.keys(raw).join(",")}`);
  }

  return {
    persona_id: personaId,
    persona_name: PERSONA_NAMES[personaId] ?? personaId,
    verdict: VALID_VERDICTS.has(verdict) ? (verdict as SynthUserResult["verdict"]) : "FRICTION",
    emotion: VALID_EMOTIONS.has(emotion) ? (emotion as SynthUserResult["emotion"]) : "Confused",
    diary_entry: resolvedDiaryEntry,
    missing_affordance: String(visualAudit.missing_affordance ?? ""),
    next_action: VALID_ACTIONS.has(nextAction) ? (nextAction as SynthUserResult["next_action"]) : "ABANDON",
    reasoning: resolvedReasoning,
    zone_detected: String(visualAudit.zone_detected ?? ""),
    persona_reaction: String(visualAudit.persona_reaction ?? ""),
    current_goal: String(simulationMeta.current_goal ?? "").trim() || undefined,
    primary_focus: String(visualAudit.primary_focus ?? "").trim() || undefined,
    target_element: String(decision.target_element ?? "").trim().replace(/^nothing$/i, "") || undefined,
  };
}

function aggregateResults(results: SynthUserResult[]): SynthUsersBlock {
  // Critical finding: prefer BLOCKER, then FRICTION, then highest drama
  const verdictPriority = { BLOCKER: 3, FRICTION: 2, PASS: 1 };
  const sorted = [...results].sort(
    (a, b) => (verdictPriority[b.verdict] ?? 0) - (verdictPriority[a.verdict] ?? 0)
  );
  const worst = sorted[0];
  const criticalFinding = worst
    ? `${worst.persona_name} (${worst.verdict}): ${worst.reasoning}`
    : "No critical findings.";

  // Shared friction: missing_affordances that appear in 2+ personas
  const affordanceCounts = new Map<string, number>();
  for (const r of results) {
    if (r.missing_affordance && r.missing_affordance !== "" && r.missing_affordance.toLowerCase() !== "nothing") {
      affordanceCounts.set(r.missing_affordance, (affordanceCounts.get(r.missing_affordance) ?? 0) + 1);
    }
  }
  const sharedFriction = [...affordanceCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([affordance]) => affordance);

  return { critical_finding: criticalFinding, shared_friction: sharedFriction, results };
}

export async function runSynthAnalysis(params: {
  userId: string;
  isTrialEligible: boolean;
  requestedProvider?: LLMProvider;
  requestedModel?: string;
  promptVersion?: string;
  personaIds: string[];
  imageUrls: string[];
  projectMission: string;
  screenContext: string;
  projectLanguage: string;
  auditId?: string | null;
}): Promise<SynthUsersBlock> {
  const { userId, isTrialEligible, requestedProvider, requestedModel, promptVersion, personaIds, imageUrls, projectMission, screenContext, projectLanguage, auditId } = params;

  const synthOpts: SynthCallOpts = {
    userId,
    isTrialEligible,
    requestedProvider,
    requestedModel,
    promptVersion,
  };

  const projectContext = [
    `Project mission: ${sanitizePromptInput(projectMission, 500)}`,
    screenContext ? `Screen goal: ${sanitizePromptInput(screenContext, 300)}` : "",
    `Write your diary entry in ${projectLanguage}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const isFlow = imageUrls.length > 1;
  console.info(`[synth-run] mode=${isFlow ? "flow" : "single"} images=${imageUrls.length} personas=${personaIds.length}`);

  try {
    const batchResults = await callGeminiForSynthBatch(personaIds, projectContext, imageUrls, synthOpts, isFlow, auditId);
    return aggregateResults(batchResults);
  } catch (batchErr) {
    console.error("[synth-run] batch synth failed, falling back to per-persona calls (higher Storage URL fetch count):", batchErr);
  }

  const results = await Promise.all(
    personaIds.map(async (personaId) => {
      try {
        const systemPrompt = buildSynthPrompt(personaId, projectContext, isFlow);
        const raw = await callGeminiForSynth(systemPrompt, imageUrls, synthOpts, isFlow, auditId);
        return mapToSynthResult(personaId, raw);
      } catch (err) {
        console.error(`[synth-run] persona ${personaId} failed:`, err);
        return {
          persona_id: personaId,
          persona_name: PERSONA_NAMES[personaId] ?? personaId,
          verdict: "FRICTION" as const,
          emotion: "Confused" as const,
          diary_entry: "Analysis unavailable for this persona.",
          missing_affordance: "",
          next_action: "ABANDON" as const,
          reasoning: "Simulation error.",
        };
      }
    })
  );

  return aggregateResults(results);
}
