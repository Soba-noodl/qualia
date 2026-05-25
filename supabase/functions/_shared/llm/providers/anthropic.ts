import { postWithRetry, type ProviderCallResult } from "./gemini.ts";
import { LLMRequestError } from "../errors.ts";
import { resizeForAnthropic } from "../anthropic-resize.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/chat/completions";

/**
 * Anthropic's hard limit: in multi-image requests, every image must be ≤ 2000px
 * on its long side. Single-image requests allow up to 8000px. Qualia exports
 * Figma frames at 2x (~2880×1800), so flow/prototype/auto audits on Anthropic
 * blow past the cap unless we resize server-side.
 *
 * T-080: when `totalImages > 1` AND storage paths are available, this adapter
 * runs a concurrency-6 worker pool that fetches each frame from `screenshots`
 * via Supabase Storage's transform option, caches the resized JPEG in
 * `audit-resized/<audit_id>/<frame_index>.jpg`, and signs that URL to send to
 * Anthropic. Single-image calls skip the resize entirely (8000px cap is fine).
 *
 * Fallback: if storage paths aren't available (legacy callers / non-storage
 * URLs) we send the originals; Anthropic will still 400, but that's the
 * existing behavior for those code paths.
 */
// Worker-pool concurrency for the imagescript decode/resize/encode pipeline.
// Started at 6; dropped to 4 after Supabase OOM'd an 11-frame Claude audit on
// 2026-05-22 (Free-tier 256 MB ceiling). Peak working set per concurrent
// worker is ~20-25 MB (source PNG bytes + decoded RGBA + JPEG encode buffer)
// and Deno V8 amplifies binary data 2-4×, so 6 × ~25 MB tripped the limit.
// At concurrency 4 peak ≈ 100 MB plus function overhead — well within 256.
const RESIZE_CONCURRENCY = 4;

/**
 * Per-provider frame-count ceiling enforced before the API call so users get
 * a fast, friendly error instead of waiting 150 s for Supabase Edge Functions'
 * Free-tier wall-clock to kill the request mid-flight.
 *
 * Recalibrated 2026-05-23 against live data — initial 25-frame cap was
 * wildly optimistic. Observed:
 *   - 46 frames → killed by 150 s timeout
 *   - 11 frames → killed by 150 s timeout (PNG fast-path skipped resize;
 *                 pure Anthropic latency was the cliff)
 *   - 1 frame   → 22-48 s wall-clock
 *
 * Anthropic Sonnet 4.6 vision latency is ~12-15 s per image at scale. 150 s
 * budget / 13 s/frame ≈ 11.5 frames max — 11 already busts it on slow days.
 * 8 gives a ~104 s ceiling with margin. Larger prototypes routed to Gemini
 * (no scaling issues observed on Gemini's side).
 */
const ANTHROPIC_MAX_FRAMES = 8;

export interface AnthropicCallInput {
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
  temperature?: number;
  /**
   * T-080: storage paths in the `screenshots` bucket, aligned 1:1 with
   * `imageUrls`. Required for multi-image resize; ignored for single-image.
   */
  imageStoragePaths?: string[];
  contextStoragePaths?: string[];
  /** Cache key prefix for `audit-resized/<auditId>/<frame_index>.jpg`. */
  auditId?: string;
  /** Service-role client. Required when `totalImages > 1` and resize is needed. */
  supabase?: SupabaseClient;
}

export async function callAnthropic(input: AnthropicCallInput): Promise<ProviderCallResult> {
  const totalImages = input.imageUrls.length + (input.contextUrls?.length ?? 0);

  // Pre-flight frame-count cap: fail fast (<1 s) with a clear, actionable
  // message instead of waiting for Supabase's 150 s Free-tier wall-clock to
  // kill the request after the resize + half the Anthropic call.
  if (totalImages > ANTHROPIC_MAX_FRAMES) {
    throw new LLMRequestError({
      provider: "anthropic",
      message:
        `Claude can audit up to ${ANTHROPIC_MAX_FRAMES} frames at once (this audit has ${totalImages}). ` +
        `Switch to Gemini for larger prototypes (up to 50 frames).`,
    });
  }

  // T-080: multi-image resize pipeline. Single-image (totalImages <= 1) skips
  // this entirely because Anthropic's 8000px cap accommodates 2x Figma exports.
  let effectiveImageUrls = input.imageUrls;
  let effectiveContextUrls = input.contextUrls ?? [];

  if (totalImages > 1) {
    const hasResizeInputs =
      input.supabase &&
      input.auditId &&
      Array.isArray(input.imageStoragePaths) &&
      input.imageStoragePaths.length === input.imageUrls.length &&
      (!input.contextUrls?.length ||
        (Array.isArray(input.contextStoragePaths) &&
          input.contextStoragePaths.length === input.contextUrls.length));

    if (!hasResizeInputs) {
      throw new LLMRequestError({
        provider: "anthropic",
        message:
          "Multi-image Claude audits require storage paths for server-side resize. " +
          "Try Gemini or GPT for this audit type.",
      });
    }

    try {
      const imageCount = input.imageUrls.length;
      const contextCount = input.contextUrls?.length ?? 0;
      const totalToResize = imageCount + contextCount;

      // Build the full ordered work list: main images first (offset 0..N-1),
      // then context images (offset N..N+M-1). Frame index in the cache key
      // matches this global order so each (auditId, position) maps to a stable
      // cache entry.
      const tasks: Array<{ globalIndex: number; sourcePath: string }> = [];
      for (let i = 0; i < imageCount; i++) {
        tasks.push({ globalIndex: i, sourcePath: input.imageStoragePaths![i] });
      }
      for (let j = 0; j < contextCount; j++) {
        tasks.push({ globalIndex: imageCount + j, sourcePath: input.contextStoragePaths![j] });
      }

      const resized: string[] = new Array(totalToResize);
      let nextIdx = 0;

      // Worker-pool mirrors T-081's pattern in figma-plugin/src/ui/views/ReadyView.tsx:159-182.
      async function worker(): Promise<void> {
        while (true) {
          const i = nextIdx++;
          if (i >= tasks.length) return;
          const task = tasks[i];
          resized[task.globalIndex] = await resizeForAnthropic({
            supabase: input.supabase!,
            auditId: input.auditId!,
            frameIndex: task.globalIndex,
            sourcePath: task.sourcePath,
          });
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(RESIZE_CONCURRENCY, tasks.length) }, () => worker()),
      );

      effectiveImageUrls = resized.slice(0, imageCount);
      effectiveContextUrls = resized.slice(imageCount);
    } catch (err) {
      // Any resize failure aborts the whole call with a friendly error. The
      // existing error type keeps the toast UX intact.
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[anthropic] resize failed: ${detail}`);
      throw new LLMRequestError({
        provider: "anthropic",
        message:
          "Failed to prepare images for Claude (resize step). Try Gemini or GPT for this audit type.",
      });
    }
  }

  const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: input.userMessage },
  ];
  const hasLabels = Array.isArray(input.imageLabels) && input.imageLabels.length === effectiveImageUrls.length;
  for (let i = 0; i < effectiveImageUrls.length; i++) {
    if (hasLabels) messageContent.push({ type: "text", text: input.imageLabels![i] });
    messageContent.push({ type: "image_url", image_url: { url: effectiveImageUrls[i] } });
  }
  for (const url of effectiveContextUrls) {
    messageContent.push({ type: "image_url", image_url: { url } });
  }

  // Anthropic OpenAI-compat ignores response_format + reasoning_effort.
  // Caps temperature at 1. System prompt is hoisted automatically.
  // See: https://platform.claude.com/docs/en/api/openai-sdk
  const body: Record<string, unknown> = {
    model: input.model,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: messageContent },
    ],
    max_tokens: input.maxTokens ?? 4000,
  };
  if (input.temperature !== undefined) {
    body.temperature = Math.min(input.temperature, 1);
  }

  return await postWithRetry({
    url: ANTHROPIC_URL,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body,
    maxAttempts: input.maxAttempts ?? 5,
    perAttemptTimeoutMs: input.timeoutMs ?? 120_000,
    provider: "anthropic",
    rawModel: input.model,
  });
}
