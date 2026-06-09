import React from "react";
import { usePluginLanguage } from "../usePluginLanguage";

type Severity = "high" | "medium" | "low";
type Stance = "agree" | "disagree" | "already_fixed" | "not_relevant";

type Props = {
  text: string;
  whyItMatters?: string;
  suggestion?: string;
  severity: Severity;
  engineLabel?: string;
  screenLabel?: string;
  principle?: string;
  stance: Stance | null;
  reason: string;
  onStanceChange: (stance: Stance | null) => void;
  onReasonChange: (reason: string) => void;
  onReasonBlur: (reason: string) => void;
  onClick?: () => void;
};

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "bg-red-600 text-white",
  medium: "bg-amber-500 text-black",
  low: "bg-blue-500 text-white",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

const STANCES = [
  { key: "agree" as const,         labelKey: "issueFeedbackStanceAgree" },
  { key: "disagree" as const,      labelKey: "issueFeedbackStanceDisagree" },
  { key: "already_fixed" as const, labelKey: "issueFeedbackStanceAlreadyFixed" },
  { key: "not_relevant" as const,  labelKey: "issueFeedbackStanceNotRelevant" },
];

export function IssueCard({
  text, whyItMatters, suggestion, severity, engineLabel, screenLabel, principle,
  stance, reason, onStanceChange, onReasonChange, onReasonBlur, onClick,
}: Props) {
  const { t } = usePluginLanguage();
  const handleCardClick = () => {
    if (onClick) onClick();
  };

  const stop = (e: React.MouseEvent | React.FocusEvent) => e.stopPropagation();

  const cardInteractive = onClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: handleCardClick,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        },
      }
    : {};

  return (
    <div
      className={[
        "bg-surface-1 border border-border rounded-xl p-3 flex flex-col gap-0",
        onClick ? "cursor-pointer hover:border-primary/50 hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" : "",
      ].join(" ")}
      {...cardInteractive}
    >
      {/* Header row: severity + labels + focus hint */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SEVERITY_STYLES[severity]}`}>
          {SEVERITY_LABELS[severity]}
        </span>
        {screenLabel && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-surface-2 border border-border text-foreground/75">
            {screenLabel}
          </span>
        )}
        {engineLabel && (
          <span className="text-[9px] text-foreground/60 bg-surface-2 border border-border px-1.5 py-0.5 rounded">
            {engineLabel}
          </span>
        )}
        {onClick && (
          <span className="ml-auto text-[9px] text-primary/70">↗ focus</span>
        )}
      </div>

      {/* Issue title */}
      <p className="text-[13px] font-semibold text-foreground leading-relaxed mb-2">{text}</p>

      {/* UX principle pill */}
      {principle && principle.trim() && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-primary/80 bg-primary/10 border border-primary/25 rounded-full px-2 py-0.5">
            <span className="w-1 h-1 rounded-full bg-primary/70 shrink-0" />
            {principle.trim()}
          </span>
        </div>
      )}

      {/* Why it matters */}
      {whyItMatters && (
        <p className="text-[12px] text-foreground/70 leading-relaxed mb-2">
          <span className="font-semibold text-amber-400">Why it matters: </span>
          {whyItMatters}
        </p>
      )}

      {/* Suggestion box */}
      {suggestion && (
        <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 rounded-lg p-2.5 mb-2">
          <span className="text-[13px] shrink-0">💡</span>
          <p className="text-[12px] text-foreground/85 leading-relaxed m-0">{suggestion}</p>
        </div>
      )}

      {/* Feedback section */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- propagation fence: onClick={stop} only prevents the outer card click from triggering when interacting with feedback inputs, not a real interactive surface */}
      <div
        className="border-t border-border/40 pt-2.5 mt-1 flex flex-col gap-2"
        onClick={stop}
        onMouseDown={stop}
      >
        <p className="text-[11px] font-medium text-foreground/65 m-0">{t("issueFeedbackYourResponse")}</p>
        <div className="flex flex-wrap gap-1.5">
          {STANCES.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStanceChange(stance === key ? null : key);
              }}
              className={[
                "text-[11px] px-2 py-1 rounded-md border transition-colors",
                stance === key
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-surface-2 border-border text-foreground/65 hover:text-foreground hover:border-border/80",
              ].join(" ")}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        <textarea
            aria-label={t("issueFeedbackReasonPlaceholder")}
            className="w-full min-h-[48px] px-2 py-1.5 rounded-md border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 resize-none transition-colors"
            placeholder={t("issueFeedbackReasonPlaceholder")}
            value={reason}
            onChange={(e) => { e.stopPropagation(); onReasonChange(e.target.value); }}
            onBlur={(e) => { e.stopPropagation(); onReasonBlur(e.target.value); }}
            onClick={stop}
            rows={2}
          />
      </div>
    </div>
  );
}
