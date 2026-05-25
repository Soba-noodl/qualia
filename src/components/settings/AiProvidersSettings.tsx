// q-disable DS-COLOR-001 (provider logo backgrounds use brand colors per provider identity guidelines)
import { useEffect, useState } from "react";
import { MODEL_OPTIONS_BY_PROVIDER, DEFAULT_MODEL_BY_PROVIDER, CUSTOM_MODEL_SENTINEL } from "@/lib/llm-defaults";
import { AlertTriangle, CheckCircle2, XCircle, Clock, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useLlmKeys,
  useSaveLlmKey,
  useTestLlmKey,
  useDeleteLlmKey,
  useSetDefaultLlmProvider,
  useDefaultLlmProvider,
  useSpendSummary,
  useUpdateLlmModel,
} from "@/hooks/use-llm-keys";
import type { LLMProvider, UserLlmKeyRow } from "@/services/llm-key.service";

// ── Provider config ──────────────────────────────────────────────────────────

type LogoStyle = { className: string; char: string };

const PROVIDER_CONFIG: Record<LLMProvider, {
  name: string;
  logoStyle: LogoStyle;
  defaultModel: string;
  /** Curated options + custom sentinel appended at render time. */
  modelOptions: Array<{ value: string; label: string; note?: string }>;
  keyPlaceholder: string;
  keyPattern: RegExp;
  keyDashboardUrl: string;
  billingDashboardUrl: string;
}> = {
  gemini: {
    name: "Google Gemini",
    logoStyle: { className: "bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white", char: "G" },
    defaultModel: DEFAULT_MODEL_BY_PROVIDER.gemini,
    modelOptions: [
      ...MODEL_OPTIONS_BY_PROVIDER.gemini,
      { value: CUSTOM_MODEL_SENTINEL, label: "Other (paste model ID)" },
    ],
    keyPlaceholder: "AIza…",
    keyPattern: /^AIza[A-Za-z0-9_-]+$/,
    keyDashboardUrl: "https://aistudio.google.com/app/apikey",
    billingDashboardUrl: "https://aistudio.google.com/usage",
  },
  anthropic: {
    name: "Anthropic Claude",
    logoStyle: { className: "bg-[#d4a27f] text-black", char: "A" },
    defaultModel: DEFAULT_MODEL_BY_PROVIDER.anthropic,
    modelOptions: [
      ...MODEL_OPTIONS_BY_PROVIDER.anthropic,
      { value: CUSTOM_MODEL_SENTINEL, label: "Other (paste model ID)" },
    ],
    keyPlaceholder: "sk-ant-…",
    keyPattern: /^sk-ant-[A-Za-z0-9_-]+$/,
    keyDashboardUrl: "https://console.anthropic.com/account/keys",
    billingDashboardUrl: "https://console.anthropic.com/settings/billing",
  },
  openai: {
    name: "OpenAI GPT",
    logoStyle: { className: "bg-[#10a37f] text-white", char: "O" },
    defaultModel: DEFAULT_MODEL_BY_PROVIDER.openai,
    modelOptions: [
      ...MODEL_OPTIONS_BY_PROVIDER.openai,
      { value: CUSTOM_MODEL_SENTINEL, label: "Other (paste model ID)" },
    ],
    keyPlaceholder: "sk-proj-…",
    keyPattern: /^sk-(proj-)?[A-Za-z0-9_-]+$/,
    keyDashboardUrl: "https://platform.openai.com/api-keys",
    billingDashboardUrl: "https://platform.openai.com/account/billing",
  },
};

const PROVIDERS: LLMProvider[] = ["gemini", "anthropic", "openai"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtUsd(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

// ── Per-provider card ────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: LLMProvider;
  row: UserLlmKeyRow | undefined;
  isDefault: boolean;
  monthUsd: number;
  lifetimeUsd: number;
  monthTokens: number;
}

function ProviderCard({ provider, row, isDefault, monthUsd, lifetimeUsd, monthTokens }: ProviderCardProps) {
  const { t } = useLanguage();
  const cfg = PROVIDER_CONFIG[provider];

  const existingModel = row?.model_override ?? cfg.defaultModel;
  const isCustomExisting = existingModel
    ? !cfg.modelOptions.some((o) => o.value === existingModel && o.value !== CUSTOM_MODEL_SENTINEL)
    : false;

  const [keyInput, setKeyInput] = useState("");
  const [showInput, setShowInput] = useState(!row);
  const [selectedModel, setSelectedModel] = useState<string>(
    isCustomExisting ? CUSTOM_MODEL_SENTINEL : existingModel
  );
  const [customModelId, setCustomModelId] = useState<string>(isCustomExisting ? existingModel : "");
  const [keyError, setKeyError] = useState<string | null>(null);

  // Sync local dropdown state when the persisted row updates (async query resolves,
  // refetch after save, etc.). Without this, useState's one-time initializer keeps
  // the dropdown stuck on whatever was visible at first render — which means a
  // saved model_override doesn't appear after page reload until the user touches
  // the dropdown.
  useEffect(() => {
    const persistedModel = row?.model_override ?? cfg.defaultModel;
    const isCustom = !cfg.modelOptions.some(
      (o) => o.value === persistedModel && o.value !== CUSTOM_MODEL_SENTINEL,
    );
    setSelectedModel(isCustom ? CUSTOM_MODEL_SENTINEL : persistedModel);
    setCustomModelId(isCustom ? persistedModel : "");
  }, [row?.model_override, cfg.defaultModel, cfg.modelOptions]);

  const save = useSaveLlmKey();
  const test = useTestLlmKey();
  const del = useDeleteLlmKey();
  const updateModel = useUpdateLlmModel();

  const resolvedModel = selectedModel === CUSTOM_MODEL_SENTINEL ? customModelId.trim() : selectedModel;

  function handleSave() {
    const trimmed = keyInput.trim();
    if (!cfg.keyPattern.test(trimmed)) {
      setKeyError(t("byokInvalidKeyFormat").replace("{provider}", cfg.name));
      return;
    }
    setKeyError(null);
    save.mutate(
      { provider, api_key: trimmed, model_override: resolvedModel || null },
      {
        onSuccess: () => {
          toast.success(t("byokSaveSuccess"));
          setKeyInput("");
          setShowInput(false);
        },
        onError: (err: Error) => toast.error(`${t("byokSaveFailed")}: ${err.message}`),
      }
    );
  }

  function handleTest() {
    test.mutate(provider, {
      onSuccess: (data) => {
        if (data.last_test_status === "ok") {
          toast.success(t("keyStatusActive"));
        } else {
          toast.error(t("keyStatusInvalid"));
        }
      },
      onError: (err: Error) => toast.error(`${t("keyStatusInvalid")}: ${err.message}`),
    });
  }

  function handleDelete() {
    del.mutate(provider, {
      onSuccess: () => {
        toast.success(t("byokDeleteSuccess"));
        setShowInput(true);
        setKeyInput("");
      },
      onError: () => toast.error(t("byokSaveFailed")),
    });
  }

  const status = row?.last_test_status;

  return (
    <Card className="glass border border-border">
      <CardHeader className="pb-3">
        {/* Header row: logo + name + status chip */}
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold flex-shrink-0 ${cfg.logoStyle.className}`}>
            {cfg.logoStyle.char}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{cfg.name}</span>
              {isDefault && (
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                  default
                </span>
              )}
              {status === "ok" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  {t("keyStatusActive")}
                </span>
              )}
              {status === "invalid" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                  <XCircle className="h-3 w-3" />
                  {t("keyStatusInvalid")}
                </span>
              )}
              {status === "untested" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                  <Clock className="h-3 w-3" />
                  {t("keyStatusUntested")}
                </span>
              )}
              {!row && (
                <span className="text-[11px] text-muted-foreground">{t("notConfigured")}</span>
              )}
            </div>
          </div>
        </div>

        {/* Model selector (always visible) */}
        <div className="mt-3 space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("byokModelLabel")}</Label>
          <Select
            value={selectedModel}
            onValueChange={(newVal) => {
              setSelectedModel(newVal);
              // Auto-persist when an already-configured provider switches to a known
              // model. The custom-ID path needs an explicit Save click (below) because
              // the input value isn't known yet at dropdown-change time.
              if (row && newVal !== CUSTOM_MODEL_SENTINEL && newVal !== existingModel) {
                updateModel.mutate(
                  { provider, model_override: newVal },
                  {
                    onSuccess: () => toast.success(t("byokModelUpdated")),
                    onError: (err: Error) => toast.error(`${t("byokModelUpdateFailed")}: ${err.message}`),
                  },
                );
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cfg.modelOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                  {opt.note && <span className="ml-1.5 text-muted-foreground">— {opt.note}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedModel === CUSTOM_MODEL_SENTINEL && (
            <div className="space-y-1">
              <div className="flex gap-2">
                <Input
                  className="h-8 text-xs font-mono flex-1"
                  placeholder={t("byokCustomModelPlaceholder")}
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                {row && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs flex-shrink-0"
                    disabled={!customModelId.trim() || updateModel.isPending}
                    onClick={() => {
                      updateModel.mutate(
                        { provider, model_override: customModelId.trim() },
                        {
                          onSuccess: () => toast.success(t("byokModelUpdated")),
                          onError: (err: Error) => toast.error(`${t("byokModelUpdateFailed")}: ${err.message}`),
                        },
                      );
                    }}
                  >
                    {updateModel.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("byokSaveCustomModel")}
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {t("byokCustomModelHint").replace("{provider}", cfg.name)}
              </p>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Key input area */}
        {showInput ? (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground sr-only">API Key</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={cfg.keyPlaceholder}
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); setKeyError(null); }}
                className="h-8 text-xs font-mono flex-1"
                // Block browser keychain autofill / autosave. A type="password" input
                // without these hints can silently overwrite macOS Keychain entries
                // whose names heuristically match a field on the page (incident 2026-05-20).
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                name={`byok-key-${cfg.id}-${Math.random().toString(36).slice(2, 8)}`}
                data-form-type="other"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
              />
              <Button
                size="sm"
                className="h-8 text-xs flex-shrink-0"
                disabled={save.isPending || !keyInput.trim()}
                onClick={handleSave}
              >
                {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("keySaveAndTest")}
              </Button>
              {row && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs flex-shrink-0"
                  onClick={() => { setShowInput(false); setKeyInput(""); setKeyError(null); }}
                >
                  ✕
                </Button>
              )}
            </div>
            {keyError && (
              <p className="text-[11px] text-destructive">{keyError}</p>
            )}
          </div>
        ) : (
          /* Configured state: action buttons */
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setShowInput(true)}
            >
              {t("keyReplace")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={test.isPending}
              onClick={handleTest}
            >
              {test.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("keyTest")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              disabled={del.isPending}
              onClick={handleDelete}
            >
              {del.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("keyDelete")}
            </Button>
          </div>
        )}

        {/* Spend meta row (configured only) */}
        {row && (
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">{t("byokSpendMonth")}</p>
              <p className="text-xs font-semibold tabular-nums">{fmtUsd(monthUsd)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">{t("byokSpendLifetime")}</p>
              <p className="text-xs font-semibold tabular-nums">{fmtUsd(lifetimeUsd)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">{t("byokTokensMonth")}</p>
              <p className="text-xs font-semibold tabular-nums">{fmtTokens(monthTokens)}</p>
            </div>
          </div>
        )}

        {/* Help links */}
        <div className="flex gap-3 pt-1">
          <a
            href={cfg.keyDashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-primary hover:underline"
          >
            {t("byokGetKey")}
          </a>
          {row && (
            <a
              href={cfg.billingDashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground hover:underline"
            >
              {t("byokViewBilling")}
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function AiProvidersSettings() {
  const { t } = useLanguage();
  const { data: keys = [] } = useLlmKeys();
  const { data: spend } = useSpendSummary();
  const { data: defaultProvider = null } = useDefaultLlmProvider();
  const setDefault = useSetDefaultLlmProvider();

  function keyFor(p: LLMProvider): UserLlmKeyRow | undefined {
    return keys.find((k) => k.provider === p);
  }

  function monthUsd(p: LLMProvider): number {
    return spend?.month.byProvider[p]?.usd ?? 0;
  }
  function lifetimeUsd(p: LLMProvider): number {
    return spend?.lifetime.byProvider[p]?.usd ?? 0;
  }
  function monthTokens(p: LLMProvider): number {
    return spend?.month.byProvider[p]?.tokens ?? 0;
  }

  return (
    <div className="space-y-6">
      {/* 1 — Liability banner */}
      <Card className="border border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3 items-start">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-amber-200">{t("byokLiabilityHeader")}</p>
              <p className="text-xs text-amber-200/70 leading-relaxed">
                {t("byokLiabilityBody")}{" "}
                <a href="/terms#byok" className="underline hover:text-amber-200">
                  {t("byokReadClause")}
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 1b — Quality / provider-recommendation banner */}
      <Card className="border border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3 items-start">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">{t("byokQualityHeader")}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("byokQualityBody")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2 — Spend summary grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="glass border border-border text-center">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">{t("spendThisMonth")}</p>
            <p className="text-2xl font-bold tabular-nums">{fmtUsd(spend?.month.totalUsd ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="glass border border-border text-center">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">{t("spendLifetime")}</p>
            <p className="text-2xl font-bold tabular-nums">{fmtUsd(spend?.lifetime.totalUsd ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="glass border border-border text-center">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">{t("auditsRun")}</p>
            <p className="text-2xl font-bold tabular-nums">{spend?.audits.byok ?? 0}</p>
            {spend && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {spend.audits.total} total · {spend.audits.errored} errored
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-3">{t("spendFootnote")}</p>

      {/* 3 — Default provider selector */}
      <Card className="glass border border-border">
        <CardContent className="pt-4 pb-4">
          <Label className="text-sm font-medium block mb-3">{t("defaultProviderLabel")}</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => {
              const cfg = PROVIDER_CONFIG[p];
              const row = keyFor(p);
              const isConfigured = !!row && row.last_test_status !== "invalid";
              const isSelected = defaultProvider === p;
              return (
                <button
                  key={p}
                  disabled={!isConfigured || setDefault.isPending}
                  onClick={() => {
                    if (!isSelected) {
                      setDefault.mutate(p, {
                        onSuccess: () => toast.success(t("byokDefaultProviderUpdated").replace("{provider}", cfg.name)),
                        onError: (err: Error) => toast.error(`${t("byokSaveFailed")}: ${err.message}`),
                      });
                    }
                  }}
                  className={[
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : isConfigured
                        ? "border-border hover:bg-surface-2 text-foreground"
                        : "border-border/40 text-muted-foreground cursor-not-allowed opacity-50",
                  ].join(" ")}
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.logoStyle.className}`} />
                  {cfg.name}
                  {!isConfigured && (
                    <span className="text-[10px] text-muted-foreground">({t("notConfigured")})</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 4 — Per-provider cards */}
      <div className="space-y-4">
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p}
            provider={p}
            row={keyFor(p)}
            isDefault={defaultProvider === p}
            monthUsd={monthUsd(p)}
            lifetimeUsd={lifetimeUsd(p)}
            monthTokens={monthTokens(p)}
          />
        ))}
      </div>
    </div>
  );
}
