import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SYNTH_USER_ANALYZE_URL } from "@/lib/api";
import type { TranslationKey } from "@/utils/translations";
import { queryKeys } from "@/lib/query-keys";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveReportLanguage } from "@/lib/resolveReportLanguage";

const SYNTH_TIMEOUT_MS = 180_000;

type RunSynthArgs = {
  auditId: string;
  projectId: string;
  personaIds: string[];
  /** Project's stored language preference, falls back to UI language */
  projectLanguage?: string;
  /** Audit's screen context (already-known by AuditDetail) */
  screenContext?: string | null;
};

type RunStatus = "idle" | "submitting" | "error";

export function useRunSynth(setIsSynthPending: (v: boolean) => void) {
  const { session } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RunStatus>("idle");

  const runSynth = useCallback(
    async ({ auditId, projectId, personaIds, projectLanguage, screenContext }: RunSynthArgs): Promise<{ ok: boolean; errorKey?: TranslationKey }> => {
      if (!session) return { ok: false, errorKey: "authRequiredError" };

      setStatus("submitting");
      setIsSynthPending(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SYNTH_TIMEOUT_MS);

      try {
        const response = await fetch(SYNTH_USER_ANALYZE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            audit_id: auditId,
            persona_ids: personaIds,
            project_language: resolveReportLanguage(projectLanguage, language as "en" | "it"),
            screen_context: screenContext ?? undefined,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          setIsSynthPending(false);
          setStatus("error");
          if (response.status === 402) return { ok: false, errorKey: "creditsExhaustedError" };
          if (response.status === 401) return { ok: false, errorKey: "authRequiredError" };
          if (response.status === 429) return { ok: false, errorKey: "rateLimitError" };
          return { ok: false, errorKey: "addSynthFailedToast" };
        }

        await response.json();

        // Invalidate the audits query so the synth_users field on the audit row is picked up.
        // The useEffect in Project.tsx watching auditsData will clear isSynthPending.
        await queryClient.invalidateQueries({ queryKey: queryKeys.audits(projectId) });

        setStatus("idle");
        return { ok: true };
      } catch (err) {
        clearTimeout(timeoutId);
        console.error("[useRunSynth] error:", err);
        setIsSynthPending(false);
        setStatus("error");
        return { ok: false, errorKey: "addSynthFailedToast" };
      }
    },
    [session, language, queryClient, setIsSynthPending]
  );

  return { runSynth, status };
}
