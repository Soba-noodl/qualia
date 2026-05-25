#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * Phase 1.5 — Empirical BYOK provider verification.
 *
 * Sends a representative ~1440x900 image to Anthropic, OpenAI, and Gemini
 * via the new _shared/llm/providers/* adapters with a JSON-output prompt.
 * Catches:
 *   - Image-size cap violations (Anthropic 5MB/1568px, OpenAI per-model, etc.)
 *   - Anthropic JSON-output reliability without response_format
 *   - Provider error mapping to typed LLMError
 *
 * Usage (from project root):
 *   export ANTHROPIC_API_KEY=$(security find-generic-password -s ANTHROPIC_API_KEY -w)
 *   export OPENAI_API_KEY=$(security find-generic-password -s OPENAI_API_KEY -w)
 *   # Pulls platform Gemini key from supabase secrets — or set TEST_GEMINI_API_KEY
 *   deno run --allow-net --allow-env --allow-read scripts/byok-phase15-smoke.ts
 *
 * No commits — just prints findings.
 */
import { callGemini } from "../supabase/functions/_shared/llm/providers/gemini.ts";
import { callAnthropic } from "../supabase/functions/_shared/llm/providers/anthropic.ts";
import { callOpenAI } from "../supabase/functions/_shared/llm/providers/openai.ts";
import { LLMError } from "../supabase/functions/_shared/llm/errors.ts";

// Set via TEST_IMAGE_URL env var. Must be a valid Supabase storage signed URL
// pointing at a PNG/JPEG screenshot in the `screenshots` bucket. Generate one
// from the Supabase dashboard (Storage → screenshots → ... → Get URL) or via
// `supabase storage sign`. Falls back to throwing if unset to avoid baking
// real production paths into the script.
const TEST_IMAGE_URL = Deno.env.get("TEST_IMAGE_URL");
if (!TEST_IMAGE_URL) {
  console.error("TEST_IMAGE_URL is required. Generate a signed URL from the screenshots bucket and export it before running.");
  Deno.exit(1);
}

const SYSTEM_PROMPT = `You are a UI auditor. The user will show you a screenshot.
Return strictly valid JSON with this shape, nothing else:
{
  "observed": "one-sentence description of what's in the image",
  "is_ui_screenshot": true | false
}`;

const USER_MSG = "Describe this screenshot in the JSON format specified.";

interface ProbeResult {
  provider: string;
  model: string;
  status: "ok" | "json_failed" | "error";
  errCode?: string;
  jsonValid?: boolean;
  parsed?: unknown;
  rawSnippet?: string;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs: number;
}

async function probe(name: string, fn: () => Promise<unknown>): Promise<ProbeResult> {
  const t0 = performance.now();
  const base: Partial<ProbeResult> = { provider: name };
  try {
    const res = await fn() as {
      content: string; finishReason: string; rawModel: string;
      usage: { prompt_tokens: number; completion_tokens: number };
    };
    base.model = res.rawModel;
    base.finishReason = res.finishReason;
    base.promptTokens = res.usage.prompt_tokens;
    base.completionTokens = res.usage.completion_tokens;
    base.rawSnippet = res.content.slice(0, 200);

    let parsed: unknown = null;
    let jsonValid = false;
    try {
      parsed = JSON.parse(res.content);
      jsonValid = true;
    } catch {
      // Try a lightweight repair: strip Markdown code fences
      const stripped = res.content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      try {
        parsed = JSON.parse(stripped);
        jsonValid = true;
        base.rawSnippet = `[fence-stripped] ${stripped.slice(0, 200)}`;
      } catch {
        // give up
      }
    }
    return {
      ...base,
      status: jsonValid ? "ok" : "json_failed",
      jsonValid,
      parsed,
      durationMs: Math.round(performance.now() - t0),
    } as ProbeResult;
  } catch (e) {
    return {
      ...base,
      model: base.model ?? "unknown",
      status: "error",
      errCode: e instanceof LLMError ? e.code : (e as Error).name,
      rawSnippet: (e as Error).message?.slice(0, 200),
      durationMs: Math.round(performance.now() - t0),
    } as ProbeResult;
  }
}

async function main() {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const geminiKey = Deno.env.get("TEST_GEMINI_API_KEY") ?? Deno.env.get("GEMINI_API_KEY");

  console.log(`Phase 1.5 BYOK smoke — image: ${TEST_IMAGE_URL}\n`);

  const results: ProbeResult[] = [];

  if (geminiKey) {
    results.push(await probe("gemini", () => callGemini({
      apiKey: geminiKey,
      model: "gemini-3-flash-preview",
      systemPrompt: SYSTEM_PROMPT,
      userMessage: USER_MSG,
      imageUrls: [TEST_IMAGE_URL],
      maxTokens: 200,
      maxAttempts: 1,
      timeoutMs: 60_000,
    })));
  } else {
    console.warn("⚠ No Gemini key in env (set GEMINI_API_KEY or TEST_GEMINI_API_KEY); skipping.");
  }

  if (anthropicKey) {
    results.push(await probe("anthropic", () => callAnthropic({
      apiKey: anthropicKey,
      model: "claude-opus-4-7",
      systemPrompt: SYSTEM_PROMPT,
      userMessage: USER_MSG,
      imageUrls: [TEST_IMAGE_URL],
      maxTokens: 200,
      maxAttempts: 1,
      timeoutMs: 60_000,
    })));
    // Also a cheaper-model run on Anthropic to compare JSON reliability
    results.push(await probe("anthropic-haiku", () => callAnthropic({
      apiKey: anthropicKey,
      model: "claude-haiku-4-5",
      systemPrompt: SYSTEM_PROMPT,
      userMessage: USER_MSG,
      imageUrls: [TEST_IMAGE_URL],
      maxTokens: 200,
      maxAttempts: 1,
      timeoutMs: 60_000,
    })));
  } else {
    console.warn("⚠ No Anthropic key in env (set ANTHROPIC_API_KEY); skipping.");
  }

  if (openaiKey) {
    results.push(await probe("openai", () => callOpenAI({
      apiKey: openaiKey,
      model: "gpt-5.4",
      systemPrompt: SYSTEM_PROMPT,
      userMessage: USER_MSG,
      imageUrls: [TEST_IMAGE_URL],
      maxTokens: 200,
      maxAttempts: 1,
      timeoutMs: 60_000,
    })));
  } else {
    console.warn("⚠ No OpenAI key in env (set OPENAI_API_KEY); skipping.");
  }

  console.log("\n────────────── RESULTS ──────────────\n");
  for (const r of results) {
    console.log(`▸ ${r.provider} · model=${r.model} · ${r.durationMs}ms`);
    if (r.status === "ok") {
      console.log(`  ✓ OK · finish=${r.finishReason} · tokens=${r.promptTokens}+${r.completionTokens}`);
      console.log(`  JSON parsed: ${JSON.stringify(r.parsed)}`);
    } else if (r.status === "json_failed") {
      console.log(`  ⚠ JSON PARSE FAILED · finish=${r.finishReason} · tokens=${r.promptTokens}+${r.completionTokens}`);
      console.log(`  raw: ${r.rawSnippet}`);
    } else {
      console.log(`  ✗ ERROR · code=${r.errCode}`);
      console.log(`  ${r.rawSnippet}`);
    }
    console.log("");
  }

  console.log("────────────── SUMMARY ──────────────");
  const okCount = results.filter((r) => r.status === "ok").length;
  const jsonFails = results.filter((r) => r.status === "json_failed").length;
  const errors = results.filter((r) => r.status === "error").length;
  console.log(`${okCount}/${results.length} OK · ${jsonFails} JSON-parse failures · ${errors} provider errors`);
  if (jsonFails > 0) {
    console.log("\n⚠ ACTION: Anthropic JSON unreliable without response_format. Consider:");
    console.log("  - Native Messages API (Anthropic-specific)");
    console.log("  - Stronger 'return ONLY JSON' instruction in system prompt");
    console.log("  - Trust existing parseAiJson repair logic (handles truncation)");
  }
  if (errors > 0) {
    console.log("\n✗ ACTION: Investigate provider errors — may indicate wrong model ID, billing block, or image format issue.");
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  Deno.exit(1);
});
