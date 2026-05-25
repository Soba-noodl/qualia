import { supabase } from "@/integrations/supabase/client";
import { MANAGE_LLM_KEY_URL, USER_SPEND_SUMMARY_URL } from "@/lib/api";

export type LLMProvider = "gemini" | "anthropic" | "openai";

export interface UserLlmKeyRow {
  id: string;
  provider: LLMProvider;
  model_override: string | null;
  last_test_status: "untested" | "ok" | "invalid";
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listLlmKeys(): Promise<UserLlmKeyRow[]> {
  const { data, error } = await supabase
    .from("user_llm_keys_safe")
    .select("id, provider, model_override, last_test_status, last_used_at, created_at, updated_at");
  if (error) throw error;
  return (data ?? []) as UserLlmKeyRow[];
}

interface ManageLlmKeyResponse {
  ok?: boolean;
  last_test_status?: "ok" | "invalid";
  error?: string;
  message?: string;
}

async function invokeManageKey(body: Record<string, unknown>): Promise<ManageLlmKeyResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const res = await fetch(MANAGE_LLM_KEY_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({} as ManageLlmKeyResponse));
  if (!res.ok) {
    // Prefer the human-readable `message` (provider's actual error text) over the
    // generic `error` code. Fall back to the code, then to a generic string.
    const humanMsg = json.message ?? json.error ?? `manage-llm-key failed (${res.status})`;
    const err = new Error(humanMsg);
    (err as Error & { code?: string }).code = json.error;
    throw err;
  }
  return json;
}

export const saveLlmKey = (provider: LLMProvider, api_key: string, model_override?: string | null) =>
  invokeManageKey({ action: "save", provider, api_key, model_override });
export const testLlmKey = (provider: LLMProvider) =>
  invokeManageKey({ action: "test", provider });
export const deleteLlmKey = (provider: LLMProvider) =>
  invokeManageKey({ action: "delete", provider });
export const setDefaultLlmProvider = (provider: LLMProvider) =>
  invokeManageKey({ action: "set-default", provider });
export const updateLlmModel = (provider: LLMProvider, model_override: string | null) =>
  invokeManageKey({ action: "update-model", provider, model_override });

export interface SpendByProvider {
  usd: number;
  tokens: number;
  costKnown: boolean;
}

export interface SpendSummary {
  month: { byProvider: Record<string, SpendByProvider>; totalUsd: number };
  lifetime: { byProvider: Record<string, SpendByProvider>; totalUsd: number };
  audits: { total: number; errored: number; trial: number; byok: number };
}

export async function fetchDefaultProvider(): Promise<LLMProvider | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // eslint-disable-next-line no-restricted-syntax -- direct profile read for default_llm_provider field
  const { data, error } = await supabase
    .from("profiles")
    .select("default_llm_provider")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.default_llm_provider ?? null) as LLMProvider | null;
}

export async function fetchSpendSummary(): Promise<SpendSummary> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const res = await fetch(USER_SPEND_SUMMARY_URL, {
    headers: { "Authorization": `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error(`spend-summary failed (${res.status})`);
  return await res.json();
}
