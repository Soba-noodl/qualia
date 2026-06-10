import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { listProjectAuditStats, type AuditStat } from "@/services/audit.service";

export type { AuditStat };

export function useProjectAuditStats(projectIds: string[]) {
  return useQuery({
    queryKey: queryKeys.projectAuditStats(projectIds),
    queryFn: () => listProjectAuditStats(projectIds),
    enabled: projectIds.length > 0,
    staleTime: 60_000,
  });
}
