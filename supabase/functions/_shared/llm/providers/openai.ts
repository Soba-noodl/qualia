import { postWithRetry, type ProviderCallResult } from "./gemini.ts";
import { LLMRequestError } from "../errors.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Per-provider frame-count ceiling enforced before the API call so users get
 * a fast, friendly error instead of waiting 150 s for Supabase Edge Functions'
 * Free-tier wall-clock to kill the request mid-flight.
 *
 * Calibrated from observed wall-clock data (2026-05-22): GPT-5.4 processed 46
 * frames in 133 s — only 17 s from the 150 s ceiling. 35 frames lands
 * comfortably under ~100 s with built-in headroom for slow API days.
 * Larger prototypes are pointed at Gemini (no observed scaling issues there).
 */
const OPENAI_MAX_FRAMES = 35;

export interface OpenAICallInput {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  imageUrls: string[];
  contextUrls?: string[];
  imageLabels?: string[];
  maxTokens?: number;
  maxAttempts?: number;
  timeoutMs?: number;
}

export async function callOpenAI(input: OpenAICallInput): Promise<ProviderCallResult> {
  const totalImages = input.imageUrls.length + (input.contextUrls?.length ?? 0);

  // Pre-flight frame-count cap: fail fast (<1 s) with a clear, actionable
  // message instead of waiting for Supabase's 150 s Free-tier wall-clock to
  // kill the request mid-OpenAI-call.
  if (totalImages > OPENAI_MAX_FRAMES) {
    throw new LLMRequestError({
      provider: "openai",
      message:
        `GPT can audit up to ${OPENAI_MAX_FRAMES} frames at once (this audit has ${totalImages}). ` +
        `Switch to Gemini for larger prototypes (up to 50 frames).`,
    });
  }

  const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: input.userMessage },
  ];
  const hasLabels = Array.isArray(input.imageLabels) && input.imageLabels.length === input.imageUrls.length;
  for (let i = 0; i < input.imageUrls.length; i++) {
    if (hasLabels) messageContent.push({ type: "text", text: input.imageLabels![i] });
    messageContent.push({ type: "image_url", image_url: { url: input.imageUrls[i] } });
  }
  for (const url of (input.contextUrls ?? [])) {
    messageContent.push({ type: "image_url", image_url: { url } });
  }

  // GPT-5.x and o-series reject `max_tokens` — they require `max_completion_tokens`.
  // Older models (gpt-4o, gpt-4-turbo) accept either. Send the new field for forward-compat;
  // older models silently accept it.
  const tokenLimit = input.maxTokens ?? 4000;
  const body: Record<string, unknown> = {
    model: input.model,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: messageContent },
    ],
    max_completion_tokens: tokenLimit,
    response_format: { type: "json_object" },
  };

  return await postWithRetry({
    url: OPENAI_URL,
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
    body,
    maxAttempts: input.maxAttempts ?? 5,
    perAttemptTimeoutMs: input.timeoutMs ?? 120_000,
    provider: "openai",
    rawModel: input.model,
  });
}
