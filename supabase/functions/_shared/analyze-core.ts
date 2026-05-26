/**
 * Shared analyze logic: prompts, sanitization, AI call, and response parsing.
 * Used by analyze-ui and plugin-analyze.
 */

export { SINGLE_SCREEN_PROMPT, FLOW_ANALYSIS_PROMPT, AUTO_CRAWL_PROMPT, FIGMA_PROTOTYPE_CRAWL_PROMPT } from "./analyze-prompts.ts";
export {
  sanitizePromptInput,
  validateLanguage,
  buildAnalysisPrompts,
  buildAutoCrawlPrompts,
  buildPrototypeCrawlPrompts,
  callAiAndParse,
  type AnalysisResult,
  type BuildPromptsParams,
  type BuildAutoCrawlPromptsParams,
  type BuildPrototypeCrawlPromptsParams,
} from "./analyze-run.ts";
