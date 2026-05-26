import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/query-keys";
import {
  getAnalyticsData,
  type AnalyticsData,
  type AnalyticsProject,
  type AnalyticsAudit,
  type AnalyticsScope,
} from "@/services/analytics.service";

export type { AnalyticsData, AnalyticsProject, AnalyticsAudit, AnalyticsScope } from "@/services/analytics.service";

export function useAnalyticsData(
  dateRange: Parameters<typeof getAnalyticsData>[0],
  scope: AnalyticsScope = "personal",
  orgId?: string | null
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.analytics(dateRange), scope, orgId ?? "personal"],
    queryFn: () => getAnalyticsData(dateRange, scope, orgId),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}
