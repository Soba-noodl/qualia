import { useState } from "react";
import { Figma, ArrowLeft, Loader2, ExternalLink, Info, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIntegrationStatus, useInitiateOAuth } from "@/hooks/use-integrations";
import { PluginCTABanner } from "@/components/PluginCTABanner";
import PersonaSelector from "./PersonaSelector";
import UserDataInput from "./UserDataInput";
import type { UploadPersona } from "@/types/audit";
import { ProviderOverrideChip } from "./ProviderOverrideChip";
import { ModelOverrideChip } from "./ModelOverrideChip";
import { useUserAuditCapability } from "@/hooks/use-user-audit-capability";
import { useLlmKeys } from "@/hooks/use-llm-keys";
import { DEFAULT_MODEL_BY_PROVIDER } from "@/lib/llm-defaults";
import type { LLMProvider } from "@/services/llm-key.service";

export interface PrototypeCrawlPayload {
  figmaUrl: string;
  selectedPersonaIds: string[];
  userData: string;
  reauditUserNote?: string;
  provider?: LLMProvider;
  model?: string;
}

interface PrototypeCrawlFormProps {
  personas: UploadPersona[];
  onSubmit: (payload: PrototypeCrawlPayload) => void;
  onBack: () => void;
  submitting?: boolean;
  isReauditFlow?: boolean;
}

const FIGMA_URL_RE = /figma\.com\/(file|design|proto)\/[a-zA-Z0-9]+/;

const PrototypeCrawlForm = ({
  personas,
  onSubmit,
  onBack,
  submitting = false,
  isReauditFlow = false,
}: PrototypeCrawlFormProps) => {
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
  const [figmaUrl, setFigmaUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [userData, setUserData] = useState("");
  const [reauditUserNote, setReauditUserNote] = useState("");

  const { data: integrationStatus, isLoading: checkingIntegrations } = useIntegrationStatus();
  const initiateOAuth = useInitiateOAuth();
  const figmaConnected = integrationStatus?.figma ?? false;

  const validateUrl = (value: string): boolean => {
    try {
      new URL(value);
      if (!FIGMA_URL_RE.test(value)) {
        setUrlError(t("prototypeCrawlUrlInvalid"));
        return false;
      }
      setUrlError(null);
      return true;
    } catch {
      setUrlError(t("prototypeCrawlUrlInvalid"));
      return false;
    }
  };

  const handleTogglePersona = (id: string) => {
    setSelectedPersonaIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUrl(figmaUrl)) return;
    onSubmit({
      figmaUrl,
      selectedPersonaIds,
      userData,
      ...(reauditUserNote.trim() ? { reauditUserNote: reauditUserNote.trim() } : {}),
      ...(activeProvider ? { provider: activeProvider } : {}),
      ...(activeModel ? { model: activeModel } : {}),
    });
  };

  const handleConnectFigma = () => {
    initiateOAuth.mutate("figma");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-5">
        {/* Plugin nudge — bigger prototypes fare better in the plugin */}
        {!isReauditFlow && (
          <PluginCTABanner
            variant="bold"
            storageKey="plugin_cta_prototype_dismissed"
            headline={t("pluginCtaBannerPrototypeHeadline")}
            body={t("pluginCtaBannerPrototypeBody")}
          />
        )}

        {/* Figma connection status */}
        {checkingIntegrations ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("prototypeCrawlConnecting")}</span>
          </div>
        ) : !figmaConnected ? (
          <div className="space-y-3 p-4 rounded-lg bg-surface-1 border border-border text-center">
            <Figma className="h-6 w-6 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("prototypeCrawlNotConnected")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleConnectFigma}
              disabled={initiateOAuth.isPending}
            >
              {initiateOAuth.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              {t("connectFigma")}
            </Button>
          </div>
        ) : (
          <>
            {/* Figma URL input */}
            <div className="space-y-2">
              <Label htmlFor="prototype-url" className="text-sm font-medium">
                {t("prototypeCrawlUrl")} <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <Figma className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="prototype-url"
                  type="url"
                  placeholder={t("prototypeCrawlUrlPlaceholder")}
                  value={figmaUrl}
                  onChange={(e) => {
                    setFigmaUrl(e.target.value);
                    if (urlError) validateUrl(e.target.value);
                  }}
                  onBlur={() => figmaUrl && validateUrl(figmaUrl)}
                  className="pl-9"
                  disabled={submitting}
                  required
                />
              </div>
              {urlError && (
                <p className="text-xs text-red-400">{urlError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("prototypeCrawlUrlHint")}
              </p>
            </div>

            {isReauditFlow ? (
              /* Re-audit: inherit persona + goal, only show the note field */
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t("reauditUserNoteLabel")}</Label>
                    <span className="text-xs text-muted-foreground bg-surface-1 border border-border rounded px-1.5 py-0.5">{t("optional")}</span>
                  </div>
                  <Textarea
                    value={reauditUserNote}
                    onChange={(e) => setReauditUserNote(e.target.value.slice(0, 1000))}
                    placeholder={t("reauditUserNotePlaceholder")}
                    className="bg-surface-1 border-border resize-none"
                    rows={2}
                    disabled={submitting}
                  />
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3 w-3 shrink-0" />
                  {t("reauditContextInherited")}
                </p>
              </div>
            ) : (
              <>
                {/* User Archetypes */}
                {personas.length > 0 && (
                  <>
                    <PersonaSelector
                      personas={personas}
                      selectedPersonaIds={selectedPersonaIds}
                      onToggle={handleTogglePersona}
                    />
                    {selectedPersonaIds.length === 0 && (
                      <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30">
                        <TriangleAlert className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-400">
                          No archetype selected — analysis will evaluate for a general first-time user. Select an archetype for more targeted findings.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* User Data */}
                <UserDataInput value={userData} onChange={setUserData} />
              </>
            )}
          </>
        )}
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
        <Button
          type="submit"
          disabled={!figmaUrl || !figmaConnected || submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("prototypeCrawlCrawling")}
            </>
          ) : (
            t("prototypeCrawlStart")
          )}
        </Button>
        </div>
      </div>
    </form>
  );
};

export default PrototypeCrawlForm;
