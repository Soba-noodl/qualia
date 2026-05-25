import { decrypt } from "../encryption.ts";
import { LLMNoKeyError } from "./errors.ts";
import type { LLMProvider } from "./pricing.ts";
import { DEFAULT_MODEL_BY_PROVIDER } from "./pricing.ts";

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = any;

export interface ResolveKeyInput {
  supabase: AnySupabaseClient;
  userId: string;
  /** Only true for analyze-ui single-screen path. Other edge fns pass false. */
  isTrialEligible: boolean;
  /** Optional: user requested a specific provider (per-audit override). */
  requestedProvider?: LLMProvider;
  /** Optional: user requested a specific model for this audit only.
   *  Preferred over the user's saved model_override for BYOK calls.
   *  Ignored for trial (platform) calls — trial always uses platform Gemini. */
  requestedModel?: string;
  encryptionKey: string;
}

export interface ResolveKeyResult {
  apiKey: string;
  provider: LLMProvider;
  model: string;
  paidBy: "platform" | "user";
}

export async function resolveKey(input: ResolveKeyInput): Promise<ResolveKeyResult> {
  // Step 1: Try user keys
  const { data: keyRows } = await input.supabase
    .from("user_llm_keys")
    .select("provider, encrypted_key, model_override")
    .eq("user_id", input.userId);

  const userKeys = (keyRows ?? []) as Array<{ provider: LLMProvider; encrypted_key: string; model_override: string | null }>;

  if (userKeys.length > 0) {
    // Pick: requested → default → first available
    const { data: profile } = await input.supabase
      .from("profiles")
      .select("default_llm_provider")
      .eq("user_id", input.userId)
      .maybeSingle();
    const defaultProvider = profile?.default_llm_provider as LLMProvider | undefined;

    const picked =
      (input.requestedProvider && userKeys.find((k) => k.provider === input.requestedProvider)) ??
      (defaultProvider && userKeys.find((k) => k.provider === defaultProvider)) ??
      userKeys[0];

    const apiKey = await decrypt(picked.encrypted_key, input.encryptionKey);
    return {
      apiKey,
      provider: picked.provider,
      model: input.requestedModel ?? picked.model_override ?? DEFAULT_MODEL_BY_PROVIDER[picked.provider],
      paidBy: "user",
    };
  }

  // Step 2: No user keys. Trial path or error.
  if (!input.isTrialEligible) {
    throw new LLMNoKeyError();
  }

  // Step 3: Trial path — check + atomically consume.
  const { data: profile } = await input.supabase
    .from("profiles")
    .select("free_analysis_used_at")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (profile?.free_analysis_used_at) {
    throw new LLMNoKeyError();
  }

  // Atomic: only succeed if free_analysis_used_at IS NULL (optimistic concurrency)
  const { data: updated, error } = await input.supabase
    .from("profiles")
    .update({ free_analysis_used_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .is("free_analysis_used_at", null)
    .select("free_analysis_used_at");

  if (error || !updated || updated.length === 0) {
    // Race lost — another concurrent request consumed the trial first.
    throw new LLMNoKeyError();
  }

  const platformKey = Deno.env.get("GEMINI_API_KEY");
  if (!platformKey) {
    throw new LLMNoKeyError({ message: "Platform Gemini key not configured" });
  }

  return {
    apiKey: platformKey,
    provider: "gemini",
    model: DEFAULT_MODEL_BY_PROVIDER.gemini,
    paidBy: "platform",
  };
}
