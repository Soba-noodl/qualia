import { Eye, GitBranch, Figma } from "lucide-react";
import { LogoIcon } from "@/components/Logo";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserAuditCapability } from "@/hooks/use-user-audit-capability";

export type AuditType = "single" | "flow" | "auto" | "prototype";

interface AuditTypeSelectorProps {
  onSelect: (type: AuditType) => void;
  auditsRemaining: number | typeof Infinity;
  maxAudits?: number;
  isAdmin?: boolean;
  isUnlimited?: boolean;
}

const AuditTypeSelector = ({
  onSelect,
  auditsRemaining,
  maxAudits = 2,
  isAdmin = false,
  isUnlimited = false,
}: AuditTypeSelectorProps) => {
  const { t } = useLanguage();
  const { data: cap } = useUserAuditCapability();

  // Tile enable is driven by BYOK capability only. The legacy isAdmin/isUnlimited
  // props are kept for backwards compat but no longer gate tile rendering — they
  // used to bypass the pre-BYOK daily cap which has been removed.
  void isAdmin;
  void isUnlimited;
  void auditsRemaining;

  const singleEnabled = cap?.kind === "byok" || (cap?.kind === "trial" && cap.trialAvailable);
  const nonSingleEnabled = cap?.kind === "byok";
  const tileTooltip = !nonSingleEnabled ? t("byokKeyRequired") : undefined;

  const cap2 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="space-y-4">
      {/* Global Limit Indicator */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-surface-2/50 border border-border">
        <LogoIcon className="h-4 w-4" />
        {!cap ? (
          <span className="text-sm text-muted-foreground">…</span>
        ) : cap.kind === "byok" ? (
          <span className="text-sm text-muted-foreground">
            <strong className="text-foreground">{t("unlimited")}</strong>
            {" · "}{t("runningOn")} {cap2(cap.provider)}
            {cap.monthSpend > 0 && (
              <span className="text-foreground/50"> · ${cap.monthSpend.toFixed(2)} {t("spendThisMonth").toLowerCase()}</span>
            )}
          </span>
        ) : cap.trialAvailable ? (
          <span className="text-sm text-muted-foreground">
            <strong className="text-foreground">1/1</strong> {t("trialAvailable")}
            {" · "}
            <a href="/settings?tab=ai-providers" className="text-primary hover:underline">{t("addKey")} →</a>
          </span>
        ) : (
          <span className="text-sm text-foreground">
            {t("trialUsed")}
            {" · "}
            <a href="/settings?tab=ai-providers" className="text-primary hover:underline">{t("addKey")} →</a>
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground text-center">
        {t("selectAuditType")}
      </p>

      <div className="grid gap-3" data-tour="audit-type-tabs">
        {/* Single Screen Audit */}
        {/* eslint-disable-next-line react/forbid-elements, jsx-a11y/control-has-associated-label -- DS-PRIMITIVE-001: large audit type tile p-5 rounded-xl border-2 with icon+heading+description block; nested h3+p text content via {t(...)} provides the accessible name but jsx-a11y can't see through the dynamic translation */}
        <button
          type="button"
          onClick={() => onSelect("single")}
          disabled={!singleEnabled}
          title={!singleEnabled ? t("byokKeyRequired") : undefined}
          className="group relative p-5 rounded-xl border-2 border-border bg-surface-1/50 hover:border-primary/50 hover:bg-surface-1 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <Eye className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">
                {t("singleScreenAudit")}
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                {t("singleScreenAuditDesc")}
              </p>
            </div>
          </div>
        </button>

        {/* User Flow Analysis */}
        {/* eslint-disable-next-line react/forbid-elements, jsx-a11y/control-has-associated-label -- DS-PRIMITIVE-001: large audit type tile p-5 rounded-xl border-2 with icon+heading+description block; nested h3+p text content via {t(...)} provides the accessible name but jsx-a11y can't see through the dynamic translation */}
        <button
          type="button"
          onClick={() => onSelect("flow")}
          disabled={!nonSingleEnabled}
          title={tileTooltip}
          className="group relative p-5 rounded-xl border-2 border-border bg-surface-1/50 hover:border-primary/50 hover:bg-surface-1 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <GitBranch className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">
                {t("userFlowAnalysis")}
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                {t("userFlowAnalysisDesc")}
              </p>
            </div>
          </div>
        </button>

        {/* Prototype Audit */}
        {/* eslint-disable-next-line react/forbid-elements, jsx-a11y/control-has-associated-label -- DS-PRIMITIVE-001: large audit type tile p-5 rounded-xl border-2 with icon+heading+description block; nested h3+p text content via {t(...)} provides the accessible name but jsx-a11y can't see through the dynamic translation */}
        <button
            type="button"
            onClick={() => onSelect("prototype")}
            disabled={!nonSingleEnabled}
            title={tileTooltip}
            className="group relative p-5 rounded-xl border-2 border-border bg-surface-1/50 hover:border-primary/50 hover:bg-surface-1 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <Figma className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                  {t("prototypeCrawl")}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("prototypeCrawlDesc")}
                </p>
              </div>
            </div>
          </button>

      </div>
    </div>
  );
};

export default AuditTypeSelector;
