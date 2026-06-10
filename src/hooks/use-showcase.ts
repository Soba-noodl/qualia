import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  listShowcaseAudits,
  getShowcaseAuditBySlug,
  showcaseScreenUrl,
  type ShowcaseRow,
} from "@/services/showcase.service";

export type { ShowcaseRow };
export { showcaseScreenUrl };

export function useShowcaseList() {
  return useQuery({
    queryKey: queryKeys.showcase.list(),
    queryFn: listShowcaseAudits,
    staleTime: 60 * 60_000, // 1 hour
  });
}

export function useShowcaseAudit(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.showcase.audit(slug ?? ""),
    queryFn: () => getShowcaseAuditBySlug(slug!),
    enabled: !!slug,
    staleTime: 60 * 60_000,
  });
}
