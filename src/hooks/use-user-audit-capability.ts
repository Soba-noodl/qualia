import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { useLlmKeys, useDefaultLlmProvider, useSpendSummary } from "@/hooks/use-llm-keys";
import { DEFAULT_MODEL_BY_PROVIDER } from "@/lib/llm-defaults";
import type { LLMProvider } from "@/services/llm-key.service";

export type AuditCapability =
  | { kind: "byok"; provider: LLMProvider; modelLabel: string; monthSpend: number }
  | { kind: "trial"; trialAvailable: boolean };

export function useUserAuditCapability(): { data: AuditCapability | undefined; isLoading: boolean } {
  const { user } = useAuth();
  const { data: keys = [], isLoading: keysLoading } = useLlmKeys();
  const { data: defaultProvider } = useDefaultLlmProvider();
  const { data: spend } = useSpendSummary();

  // Profile (free_analysis_used_at)
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: [...queryKeys.all, "profile-trial", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // eslint-disable-next-line no-restricted-syntax -- direct profile read for free_analysis_used_at
      const { data } = await supabase
        .from("profiles")
        .select("free_analysis_used_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data ?? null;
    },
    staleTime: 30_000,
  });

  const isLoading = keysLoading || profileLoading;
  if (isLoading) return { isLoading: true, data: undefined };

  if (keys.length > 0) {
    const picked =
      keys.find((k) => k.provider === defaultProvider) ?? keys[0];
    return {
      isLoading: false,
      data: {
        kind: "byok",
        provider: picked.provider,
        modelLabel: picked.model_override ?? DEFAULT_MODEL_BY_PROVIDER[picked.provider],
        monthSpend: spend?.month.byProvider[picked.provider]?.usd ?? 0,
      },
    };
  }

  return {
    isLoading: false,
    data: { kind: "trial", trialAvailable: !profile?.free_analysis_used_at },
  };
}
