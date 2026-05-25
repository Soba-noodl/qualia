import {
  LLMInvalidKeyError,
  LLMRateLimitError,
  LLMBillingError,
  LLMProviderError,
} from "../errors.ts";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export interface GeminiCallInput {
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

export interface ProviderCallResult {
  content: string;
  finishReason: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens?: number };
  rawModel: string;
}

export async function callGemini(input: GeminiCallInput): Promise<ProviderCallResult> {
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

  return await postWithRetry({
    url: GEMINI_URL,
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
    body: {
      model: input.model,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: messageContent },
      ],
      max_tokens: input.maxTokens ?? 4000,
      response_format: { type: "json_object" },
    },
    maxAttempts: input.maxAttempts ?? 5,
    perAttemptTimeoutMs: input.timeoutMs ?? 120_000,
    provider: "gemini",
    rawModel: input.model,
  });
}

/**
 * Shared retry + error-mapping logic used by all 3 provider adapters.
 * Mirrors the existing retry logic in _shared/analyze-run.ts:336-399 — the only
 * difference is throwing typed LLMErrors instead of generic Error.
 */
export async function postWithRetry(args: {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  maxAttempts: number;
  perAttemptTimeoutMs: number;
  provider: "gemini" | "anthropic" | "openai";
  rawModel: string;
}): Promise<ProviderCallResult> {
  let response: Response | null = null;
  for (let attempt = 1; attempt <= args.maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), args.perAttemptTimeoutMs);
    try {
      response = await fetch(args.url, {
        method: "POST",
        headers: args.headers,
        body: JSON.stringify(args.body),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
    } catch (fetchErr) {
      const isAbort = fetchErr instanceof Error && fetchErr.name === "AbortError";
      if (!isAbort || attempt >= args.maxAttempts) {
        const friendly = isAbort
          ? `Provider timed out (>${Math.round(args.perAttemptTimeoutMs / 1000)}s). Try again.`
          : String(fetchErr);
        throw new LLMProviderError({ provider: args.provider, message: friendly });
      }
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      continue;
    }
    if (response.ok) break;

    // Non-retriable: auth + billing failures
    if (response.status === 401 || response.status === 403) {
      throw new LLMInvalidKeyError({ provider: args.provider });
    }
    if (response.status === 402) {
      const text = await response.text().catch(() => "");
      throw new LLMBillingError({ provider: args.provider, message: text.slice(0, 200) });
    }

    // Retry transient failures
    if (attempt < args.maxAttempts) {
      const isRateLimit = response.status === 429;
      const waitMs = isRateLimit
        ? Math.min(attempt * 10_000, 30_000)
        : Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    // Out of retries
    if (response.status === 429) {
      const ra = response.headers.get("retry-after");
      throw new LLMRateLimitError({
        provider: args.provider,
        retryAfterSec: ra ? parseInt(ra, 10) : undefined,
      });
    }
    if (response.status === 503) {
      throw new LLMProviderError({
        provider: args.provider,
        message: "Provider temporarily overloaded — try again in a moment.",
      });
    }
    const text = await response.text().catch(() => "");
    throw new LLMProviderError({ provider: args.provider, message: `${response.status}: ${text.slice(0, 200)}` });
  }
  if (!response) {
    throw new LLMProviderError({ provider: args.provider, message: "no response after retries" });
  }
  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    finishReason: data.choices?.[0]?.finish_reason ?? "unknown",
    usage: {
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
      total_tokens: data.usage?.total_tokens,
    },
    rawModel: args.rawModel,
  };
}
