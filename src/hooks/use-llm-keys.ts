import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import * as svc from "@/services/llm-key.service";

export function useLlmKeys() {
  return useQuery({
    queryKey: queryKeys.llmKeys(),
    queryFn: svc.listLlmKeys,
    staleTime: 60_000,
  });
}

export function useSaveLlmKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { provider: svc.LLMProvider; api_key: string; model_override?: string | null }) =>
      svc.saveLlmKey(args.provider, args.api_key, args.model_override),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.llmKeys() });
      qc.invalidateQueries({ queryKey: queryKeys.spendSummary() });
      // Save on first-ever key auto-sets default — refresh that too.
      qc.invalidateQueries({ queryKey: queryKeys.defaultLlmProvider() });
    },
  });
}

export function useTestLlmKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: svc.LLMProvider) => svc.testLlmKey(provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.llmKeys() }),
  });
}

export function useDeleteLlmKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: svc.LLMProvider) => svc.deleteLlmKey(provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.llmKeys() });
      qc.invalidateQueries({ queryKey: queryKeys.spendSummary() });
      // Deleting the default provider clears/reassigns it server-side.
      qc.invalidateQueries({ queryKey: queryKeys.defaultLlmProvider() });
    },
  });
}

export function useSetDefaultLlmProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: svc.LLMProvider) => svc.setDefaultLlmProvider(provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.llmKeys() });
      qc.invalidateQueries({ queryKey: queryKeys.defaultLlmProvider() });
    },
  });
}

export function useDefaultLlmProvider() {
  return useQuery({
    queryKey: queryKeys.defaultLlmProvider(),
    queryFn: svc.fetchDefaultProvider,
    staleTime: 60_000,
  });
}

export function useUpdateLlmModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { provider: svc.LLMProvider; model_override: string | null }) =>
      svc.updateLlmModel(args.provider, args.model_override),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.llmKeys() }),
  });
}

export function useSpendSummary() {
  return useQuery({
    queryKey: queryKeys.spendSummary(),
    queryFn: svc.fetchSpendSummary,
    staleTime: 60_000,
  });
}
