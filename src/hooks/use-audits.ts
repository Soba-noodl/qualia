import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { queryKeys } from "@/lib/query-keys";
import { posthog } from "@/lib/posthog";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  listAudits,
  createAudit as createAuditService,
  deleteAudit as deleteAuditService,
  updateAuditFeedback as updateAuditFeedbackService,
  transformAudit,
  type Audit,
  type AiReport,
  type CreateAuditParams,
  type UpdateAuditFeedbackParams,
} from "@/services/audit.service";
import {
  listAuditIssueFeedback,
  upsertAuditIssueFeedback,
  deleteAuditIssueFeedback,
  type IssueFeedbackStance,
  type UpsertAuditIssueFeedbackParams,
} from "@/services/audit-issue-feedback.service";

export type { Audit, AiReport, UpdateAuditFeedbackParams } from "@/services/audit.service";
export { transformAudit } from "@/services/audit.service";

/** Alias for create-audit params (e.g. in Project page). */
export type AuditInsert = CreateAuditParams;

function deriveAuditType(audit: Pick<Audit, "follow_up_audit_id" | "flow_images">): string {
  if (audit.follow_up_audit_id) return "re-audit";
  if (audit.flow_images?.length) return "flow";
  return "single";
}

/** Substrings (lowercase) that mark a Figma rate-limit / paywall failure */
const FIGMA_RATE_LIMIT_KEYWORDS = [
  "figma rate limit",
  "rate limit hit",
  "image export api isn't",
  "moving too fast",
  "1 call/10min",
  "paid accounts allow",
  "free accounts are slower",
  "6 api calls per month",
  "too many or too large frames",
];

function isFigmaRateLimitError(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return FIGMA_RATE_LIMIT_KEYWORDS.some((kw) => lower.includes(kw));
}

export function useAudits(projectId: string | undefined) {
  const { t } = useLanguage();
  const query = useQuery({
    queryKey: queryKeys.audits(projectId ?? ""),
    queryFn: () => {
      if (!projectId) throw new Error("useAudits queryFn called without projectId");
      return listAudits(projectId);
    },
    enabled: !!projectId,
    refetchInterval: (query) => {
      const audits = query.state.data as Audit[] | undefined;
      // Poll every 5 s while any audit is in-flight.
      // Stop after 10 min — server-side stale cleanup marks it failed on the next request.
      const TIMEOUT_MS = 10 * 60 * 1000;
      const hasInFlight = audits?.some(
        (a) =>
          (a.status === "pending" || a.status === "processing") &&
          Date.now() - new Date(a.created_at).getTime() < TIMEOUT_MS
      );
      return hasInFlight ? 5000 : false;
    },
  });

  const seenStatuses = useRef<Map<string, string>>(new Map());
  // Track which audit IDs we've already shown a failure toast for, so re-renders don't spam
  const toastedFailures = useRef<Set<string>>(new Set());

  const prevProjectId = useRef<string | undefined>(projectId);
  if (prevProjectId.current !== projectId) {
    seenStatuses.current.clear();
    toastedFailures.current.clear();
    prevProjectId.current = projectId;
  }

  useEffect(() => {
    const audits = query.data ?? [];
    for (const audit of audits) {
      const prev = seenStatuses.current.get(audit.id);
      if (prev !== undefined && prev !== "completed" && audit.status === "completed") {
        posthog.capture("audit_completed", {
          audit_type: deriveAuditType(audit),
        });
      }
      // Fire a toast on pending|processing → failed so users see WHY it failed
      // (the audit card already shows error_message inline, but a transient toast catches the eye)
      if (
        prev !== undefined &&
        (prev === "pending" || prev === "processing") &&
        audit.status === "failed" &&
        !toastedFailures.current.has(audit.id)
      ) {
        toastedFailures.current.add(audit.id);
        const message = isFigmaRateLimitError(audit.error_message)
          ? t("figmaRateLimitMessage")
          : audit.error_message ?? t("analysisError");
        toast.error(message, { duration: 15000 });
      }
      seenStatuses.current.set(audit.id, audit.status);
    }
  }, [query.data, t]);

  return query;
}

export function useCreateAudit(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAuditService,
    onSuccess: (_, variables) => {
      posthog.capture("audit_started", {
        audit_type: deriveAuditType({ follow_up_audit_id: variables.follow_up_audit_id ?? null, flow_images: variables.flow_images ?? null }),
        has_personas: !!(variables.selected_personas?.length),
        has_screen_context: !!variables.screen_context,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audits(projectId) });
    },
  });
}

export function useDeleteAudit(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAuditService,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.audits(projectId) });
    },
  });
}

export function useUpdateAuditFeedback(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { auditId: string } & UpdateAuditFeedbackParams) =>
      updateAuditFeedbackService(params.auditId, {
        feedback_rating: params.feedback_rating,
        feedback_comment: params.feedback_comment,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.audits(projectId) });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.all, "analytics"] });
    },
  });
}

export type { IssueFeedbackStance, UpsertAuditIssueFeedbackParams };

export function useAuditIssueFeedback(auditId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.auditIssueFeedback(auditId ?? ""),
    queryFn: () => {
      if (!auditId) throw new Error("useAuditIssueFeedback queryFn called without auditId");
      return listAuditIssueFeedback(auditId);
    },
    enabled: !!auditId,
    staleTime: 30_000,
  });
}

export function useUpsertAuditIssueFeedback() {
  return useMutation({
    mutationFn: async (params: UpsertAuditIssueFeedbackParams & { stance: IssueFeedbackStance | null }) => {
      if (params.stance === null) {
        await deleteAuditIssueFeedback(params.auditId, params.engineId, params.issueIndex);
      } else {
        await upsertAuditIssueFeedback(params as UpsertAuditIssueFeedbackParams);
      }
    },
  });
}
