import { toast } from "@/components/ui/sonner";

export interface LlmErrorBody {
  error: "no_key" | "invalid_key" | "rate_limit" | "billing_block" | "provider_error" | "bad_request" | string;
  provider?: "gemini" | "anthropic" | "openai" | null;
  retry_after_sec?: number;
  message?: string;
}

function capitalize(s?: string | null): string {
  if (!s) return "Provider";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Translate Supabase Edge Functions' infrastructure-level errors
 * ("Function failed due to not having enough compute resources" /
 * "Request idle timeout limit (150s) reached") into user-facing copy
 * with an actionable suggestion. Plain provider errors pass through.
 */
function sanitizeInfraError(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  if (/compute resources/i.test(raw)) {
    return "This audit hit the function memory limit during image processing on Claude. Try a smaller prototype on Claude (up to 8 frames), or switch to Gemini for larger ones.";
  }
  if (/idle timeout|request timeout|exceeded.*timeout/i.test(raw)) {
    return "The audit took longer than the function timeout (150 s on the Free tier). For larger prototypes, switch to Gemini — it's faster on multi-frame audits.";
  }
  return raw;
}

const BILLING_DASHBOARD_URLS: Record<string, string> = {
  gemini: "https://aistudio.google.com/usage",
  anthropic: "https://console.anthropic.com/settings/billing",
  openai: "https://platform.openai.com/account/billing",
};

/**
 * Surface an LLM error from a Qualia edge function with a typed toast.
 * - no_key → caller handles via TrialExhaustedDialog; this function returns early.
 * - invalid_key → toast + "Update key" action to /settings
 * - rate_limit → toast + retry_after_sec countdown
 * - billing_block → toast + deep link to provider billing dashboard
 * - provider_error → toast (no auto-retry)
 * - bad_request → toast asking user to report
 * - other → generic toast with message
 *
 * @param err parsed LLM error body
 * @param t i18n function (from useLanguage)
 * @param navigate optional router navigate fn for actions
 */
export function llmErrorToast(
  err: LlmErrorBody,
  t: (key: string) => string,
  navigate?: (path: string) => void,
): void {
  // no_key is handled by TrialExhaustedDialog at the call site, not here
  if (err.error === "no_key") return;

  const providerLabel = capitalize(err.provider);
  const goToSettings = navigate ? () => navigate("/settings?tab=ai-providers") : undefined;

  if (err.error === "invalid_key") {
    toast.error(
      t("llmErrorInvalidKeyTitle").replace("{provider}", providerLabel),
      {
        description: t("llmErrorInvalidKeyDesc"),
        action: goToSettings
          ? { label: t("llmErrorActionUpdateKey"), onClick: goToSettings }
          : undefined,
      },
    );
    return;
  }

  if (err.error === "rate_limit") {
    const seconds = err.retry_after_sec ?? 60;
    toast.warning(
      t("llmErrorRateLimitTitle").replace("{provider}", providerLabel),
      {
        description: t("llmErrorRateLimitDesc").replace("{seconds}", String(seconds)),
      },
    );
    return;
  }

  if (err.error === "billing_block") {
    const billingUrl = err.provider ? BILLING_DASHBOARD_URLS[err.provider] : undefined;
    toast.error(
      t("llmErrorBillingTitle").replace("{provider}", providerLabel),
      {
        description: err.message || t("llmErrorBillingDesc"),
        action: billingUrl
          ? {
              label: t("llmErrorActionOpenBilling"),
              onClick: () => window.open(billingUrl, "_blank", "noopener,noreferrer"),
            }
          : undefined,
      },
    );
    return;
  }

  if (err.error === "provider_error") {
    toast.error(
      t("llmErrorProviderTitle").replace("{provider}", providerLabel),
      {
        description: sanitizeInfraError(err.message) || t("llmErrorProviderDesc"),
      },
    );
    return;
  }

  if (err.error === "bad_request") {
    toast.error(t("llmErrorBadRequestTitle"), {
      description: sanitizeInfraError(err.message) || t("llmErrorBadRequestDesc"),
    });
    return;
  }

  // Unknown error code — generic fallback
  toast.error(t("llmErrorGenericTitle"), {
    description: sanitizeInfraError(err.message) || err.error || t("llmErrorGenericDesc"),
  });
}
