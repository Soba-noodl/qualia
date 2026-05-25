import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSaveLlmKey } from "@/hooks/use-llm-keys";
import { toast } from "@/components/ui/sonner";
import type { LLMProvider } from "@/services/llm-key.service";

interface ProviderPasteConfig {
  id: LLMProvider;
  name: string;
  dotClass: string;
  placeholder: string;
  keyDashboardUrl: string;
  keyPattern: RegExp;
}

const PROVIDERS: ProviderPasteConfig[] = [
  {
    id: "gemini",
    name: "Gemini",
    dotClass: "bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500",
    placeholder: "AIza…",
    keyDashboardUrl: "https://aistudio.google.com/app/apikey",
    keyPattern: /^AIza[A-Za-z0-9_-]+$/,
  },
  {
    id: "anthropic",
    name: "Claude",
    dotClass: "bg-[#d4a27f]",
    placeholder: "sk-ant-…",
    keyDashboardUrl: "https://console.anthropic.com/account/keys",
    keyPattern: /^sk-ant-[A-Za-z0-9_-]+$/,
  },
  {
    id: "openai",
    name: "GPT",
    dotClass: "bg-[#10a37f]",
    placeholder: "sk-proj-…",
    keyDashboardUrl: "https://platform.openai.com/api-keys",
    keyPattern: /^sk-(proj-)?[A-Za-z0-9_-]+$/,
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires after the user saves at least one key. Caller should retry the audit. */
  onSavedKey?: () => void;
}

export function TrialExhaustedDialog({ open, onOpenChange, onSavedKey }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const save = useSaveLlmKey();
  const [pastedKeys, setPastedKeys] = useState<Record<LLMProvider, string>>({
    gemini: "",
    anthropic: "",
    openai: "",
  });
  const [tosAccepted, setTosAccepted] = useState(true); // pre-checked per spec
  const [savingProvider, setSavingProvider] = useState<LLMProvider | null>(null);

  const pastedCount = Object.values(pastedKeys).filter((v) => v.trim().length > 0).length;
  const canSave = pastedCount > 0 && tosAccepted;

  async function handleSaveAndRetry() {
    if (!tosAccepted) return;
    // Save each non-empty key in sequence; bail on first failure.
    for (const cfg of PROVIDERS) {
      const trimmed = pastedKeys[cfg.id].trim();
      if (!trimmed) continue;
      if (!cfg.keyPattern.test(trimmed)) {
        toast.error(t("byokInvalidKeyFormat").replace("{provider}", cfg.name));
        return;
      }
      setSavingProvider(cfg.id);
      try {
        await save.mutateAsync({ provider: cfg.id, api_key: trimmed, model_override: null });
      } catch (err) {
        toast.error(`${t("byokSaveFailed")}: ${(err as Error).message}`);
        setSavingProvider(null);
        return;
      }
    }
    setSavingProvider(null);
    toast.success(t("byokSaveSuccess"));
    onOpenChange(false);
    onSavedKey?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>{t("trialExhaustedTitle")}</DialogTitle>
          <DialogDescription>{t("trialExhaustedBody")}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-foreground/80">
          {t("trialExhaustedRetryNote")}
        </div>

        <p className="text-xs text-muted-foreground uppercase tracking-wide mt-2">
          {t("trialExhaustedPasteDivider")}
        </p>

        <div className="space-y-2">
          {PROVIDERS.map((cfg) => (
            <div key={cfg.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-surface-2/50">
              <span className={`w-5 h-5 rounded ${cfg.dotClass} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
                {cfg.name[0]}
              </span>
              <div className="w-16 flex-shrink-0">
                <div className="text-xs font-semibold">{cfg.name}</div>
                <a
                  href={cfg.keyDashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  {t("byokGetKey")}
                </a>
              </div>
              <Input
                type="password"
                placeholder={cfg.placeholder}
                value={pastedKeys[cfg.id]}
                onChange={(e) => setPastedKeys((prev) => ({ ...prev, [cfg.id]: e.target.value }))}
                className="flex-1 h-8 text-xs font-mono"
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                name={`trial-exhausted-key-${cfg.id}-${Math.random().toString(36).slice(2, 8)}`}
                data-form-type="other"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
              />
              {pastedKeys[cfg.id].trim() && <span className="text-xs text-green-400 flex-shrink-0">✓</span>}
            </div>
          ))}
        </div>

        <label className="flex items-start gap-2 text-xs text-muted-foreground mt-2 cursor-pointer">
          <Checkbox
            checked={tosAccepted}
            onCheckedChange={(v) => setTosAccepted(v === true)}
            className="mt-0.5 flex-shrink-0"
          />
          <span>
            {t("trialExhaustedTosLine")}{" "}
            <a href="/terms#byok" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">
              {t("byokReadClause")}
            </a>
          </span>
        </label>

        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              navigate("/settings?tab=ai-providers");
            }}
          >
            {t("trialExhaustedOpenSettings")}
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAndRetry}
            disabled={!canSave || save.isPending}
          >
            {save.isPending ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />{savingProvider}</>
            ) : (
              t("trialExhaustedSaveAndRetry")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
