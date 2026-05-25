import { useState, useCallback } from "react";
import { ANALYZE_UI_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveReportLanguage } from "@/lib/resolveReportLanguage";
import type { Project } from "@/hooks/use-project";
import type { UploadPersona } from "@/types/audit";
import type { LLMProvider } from "@/services/llm-key.service";

type TFunction = (key: string) => string;

export function useAnalyzeScreenshot(project: Project | null, t: TFunction) {
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const { session } = useAuth();
  const { language } = useLanguage();

  const analyzeScreenshot = useCallback(
    async (
      auditId: string,
      screenshotUrl: string,
      selectedPersonas?: UploadPersona[],
      screenContext?: string,
      contextImageUrls?: string[],
      additionalContext?: string,
      figmaMetadata?: unknown,
      deepFigmaUiRequested?: boolean,
      userData?: string,
      synthPersonaIds?: string[],
      provider?: LLMProvider,
      model?: string
    ): Promise<{ success: boolean; errorKey?: string; errorMessage?: string; llmError?: { error: string; provider?: string; retry_after_sec?: number; message?: string } | null }> => {
      if (!project) return { success: false };
      if (!session) return { success: false, errorKey: "authRequiredError" };

      setAnalyzing(auditId);

      const ANALYZE_TIMEOUT_MS =
        synthPersonaIds && synthPersonaIds.length > 0 ? 150_000 : 90_000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

      try {
        const personaForAnalysis =
          selectedPersonas && selectedPersonas.length > 0
            ? selectedPersonas.map((p) => `${p.name}: ${p.description}`).join("\n\n")
            : project.persona;

        const projectMissionForAnalysis =
          project.scope === "section" && project.global_mission?.trim()
            ? `Product: ${project.global_mission.trim()}\n\nThis section: ${project.mission}`
            : project.mission;

        const response = await fetch(ANALYZE_UI_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            audit_id: auditId,
            screenshot_url: screenshotUrl,
            contextImages:
              contextImageUrls && contextImageUrls.length > 0 ? contextImageUrls : undefined,
            project_mission: projectMissionForAnalysis,
            project_persona: personaForAnalysis,
            project_constraints: project.constraints,
            project_language: resolveReportLanguage(project.language, language as "en" | "it"),
            screen_context: screenContext || null,
            user_data: userData?.trim() || undefined,
            project_additional_context: additionalContext || undefined,
            figma_metadata: figmaMetadata ?? undefined,
            deep_figma_ui_requested: deepFigmaUiRequested === true,
            ...(synthPersonaIds && synthPersonaIds.length > 0
              ? { synth_persona_ids: synthPersonaIds }
              : {}),
            ...(provider ? { provider } : {}),
            ...(model ? { model } : {}),
          }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const serverMessage = typeof errorData?.error === "string" ? errorData.error : undefined;
          const llmError = (errorData && typeof errorData === "object" && errorData.error)
            ? errorData as { error: string; provider?: string; retry_after_sec?: number; message?: string }
            : null;
          if (response.status === 429)
            return { success: false, errorKey: "rateLimitError", errorMessage: serverMessage, llmError };
          if (response.status === 402)
            return { success: false, errorKey: "creditsExhaustedError", errorMessage: serverMessage, llmError };
          if (response.status === 401)
            return { success: false, errorKey: "authRequiredError", errorMessage: serverMessage, llmError };
          if (response.status === 500 || response.status === 503)
            return { success: false, errorKey: "aiServiceError", errorMessage: serverMessage, llmError };
          if (response.status === 400 || response.status === 403)
            return { success: false, errorKey: "analysisError", errorMessage: serverMessage, llmError };
          throw new Error(serverMessage || "Analysis failed");
        }

        await response.json();
        return { success: true };
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const message = err instanceof Error ? err.message : String(err);
        const isAbort = err instanceof Error && err.name === "AbortError";
        if (
          isAbort ||
          message.includes("network") ||
          message.includes("timeout") ||
          err instanceof TypeError
        ) {
          return { success: false, errorKey: "networkError" };
        }
        return { success: false, errorKey: "analysisError", errorMessage: message };
      } finally {
        setAnalyzing(null);
      }
    },
    [project, session, language]
  );

  return { analyzeScreenshot, analyzing, setAnalyzing };
}
