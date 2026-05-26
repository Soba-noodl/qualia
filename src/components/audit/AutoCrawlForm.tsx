import { useState } from "react";
import { Globe, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProviderOverrideChip } from "./ProviderOverrideChip";
import { ModelOverrideChip } from "./ModelOverrideChip";
import { useUserAuditCapability } from "@/hooks/use-user-audit-capability";
import { useLlmKeys } from "@/hooks/use-llm-keys";
import { DEFAULT_MODEL_BY_PROVIDER } from "@/lib/llm-defaults";
import type { LLMProvider } from "@/services/llm-key.service";

export interface AutoCrawlPayload {
  url: string;
  provider?: LLMProvider;
  model?: string;
}

interface AutoCrawlFormProps {
  onSubmit: (payload: AutoCrawlPayload) => void;
  onBack: () => void;
  submitting?: boolean;
}

const AutoCrawlForm = ({
  onSubmit,
  onBack,
  submitting = false,
}: AutoCrawlFormProps) => {
  const { t } = useLanguage();
  const { data: cap } = useUserAuditCapability();
  const { data: keys = [] } = useLlmKeys();
  const defaultProvider: LLMProvider | undefined = cap?.kind === "byok" ? cap.provider : undefined;
  const [providerOverride, setProviderOverride] = useState<LLMProvider | null>(null);
  const activeProvider = providerOverride ?? defaultProvider;
  const [modelOverride, setModelOverride] = useState<string | null>(null);

  const savedOverrideFor = (p: LLMProvider): string | null =>
    keys.find((k) => k.provider === p)?.model_override ?? null;

  const activeModel = activeProvider
    ? (modelOverride ?? (savedOverrideFor(activeProvider) ?? DEFAULT_MODEL_BY_PROVIDER[activeProvider]))
    : null;

  const handleProviderChange = (p: LLMProvider) => {
    setProviderOverride(p);
    setModelOverride(null);
  };
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const validateUrl = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") {
        setUrlError(t("autoAuditUrlHttpsOnly"));
        return false;
      }
      setUrlError(null);
      return true;
    } catch {
      setUrlError(t("autoAuditUrlInvalid"));
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUrl(url)) return;
    onSubmit({ url, ...(activeProvider ? { provider: activeProvider } : {}), ...(activeModel ? { model: activeModel } : {}) });
  };

  // ── Form step ──────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-5">
        {/* URL input */}
        <div className="space-y-2">
          <Label htmlFor="crawl-url" className="text-sm font-medium">
            {t("autoAuditUrl")} <span className="text-red-400">*</span>
          </Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="crawl-url"
              type="url"
              placeholder={t("autoAuditUrlPlaceholder")}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) validateUrl(e.target.value);
              }}
              onBlur={() => url && validateUrl(url)}
              className="pl-9"
              disabled={submitting}
              required
              aria-invalid={urlError ? true : undefined}
              aria-describedby={urlError ? "crawl-url-error" : undefined}
            />
          </div>
          {urlError && (
            <p id="crawl-url-error" className="text-xs text-red-400">{urlError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("autoAuditUrlHint")}
          </p>
        </div>

        {/* No login-required step: users crawl their public/figma prototype URL directly */}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border flex-shrink-0">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("back")}
        </Button>
        <div className="flex gap-3 items-center">
          {activeProvider && activeModel && (
            <>
              <ProviderOverrideChip value={activeProvider} onChange={handleProviderChange} />
              <ModelOverrideChip
                provider={activeProvider}
                value={activeModel}
                savedOverride={savedOverrideFor(activeProvider)}
                onChange={setModelOverride}
              />
            </>
          )}
        <Button type="submit" disabled={!url || submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("autoAuditCrawling")}
            </>
          ) : (
            t("autoAuditStart")
          )}
        </Button>
        </div>
      </div>
    </form>
  );
};

export default AutoCrawlForm;
