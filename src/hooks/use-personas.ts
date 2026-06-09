import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { listPersonas } from "@/services/persona.service";

export type { PersonaItem } from "@/services/persona.service";

export function usePersonas(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.personas(projectId ?? ""),
    queryFn: () => {
      if (!projectId) throw new Error("usePersonas queryFn called without projectId");
      return listPersonas(projectId);
    },
    enabled: !!projectId,
  });
}
