import { useState } from "react";
import { Users, AlertTriangle, CheckCircle, AlertCircle, XCircle, Quote, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { SynthUsersBlock, SynthVerdict, SynthEmotion } from "./synthUserTypes";

interface SynthUserSectionProps {
  synthUsers: SynthUsersBlock;
}

function VerdictBadge({ verdict }: { verdict: SynthVerdict }) {
  const config = {
    PASS: { label: "PASS", className: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
    FRICTION: { label: "FRICTION", className: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: AlertCircle },
    BLOCKER: { label: "BLOCKER", className: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  }[verdict];

  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function EmotionBadge({ emotion }: { emotion: SynthEmotion }) {
  const config = {
    Satisfied: "bg-green-500/10 text-green-400",
    Confused: "bg-blue-500/10 text-blue-400",
    Frustrated: "bg-red-500/10 text-red-400",
    Anxious: "bg-amber-500/10 text-amber-400",
  }[emotion];
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", config)}>
      {emotion}
    </span>
  );
}

function NextActionBadge({ action }: { action: "CLICK" | "TYPE" | "ABANDON" }) {
  const config = {
    CLICK: "text-blue-400",
    TYPE: "text-purple-400",
    ABANDON: "text-red-400",
  }[action];
  return <span className={cn("text-xs font-mono font-bold uppercase shrink-0", config)}>{action}</span>;
}

function VerdictDot({ verdict }: { verdict: SynthVerdict }) {
  const color = { PASS: "bg-green-400", FRICTION: "bg-amber-400", BLOCKER: "bg-red-400" }[verdict];
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", color)} />;
}

const VERDICT_PRIORITY: Record<SynthVerdict, number> = { BLOCKER: 3, FRICTION: 2, PASS: 1 };

const SynthUserSection = ({ synthUsers }: SynthUserSectionProps) => {
  const { t } = useLanguage();
  const { shared_friction, results } = synthUsers;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const criticalResult = results.length > 0
    ? results.reduce((a, b) => VERDICT_PRIORITY[b.verdict] > VERDICT_PRIORITY[a.verdict] ? b : a)
    : null;

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Verdict at a glance */}
      <div className="glass rounded-xl border border-border/50 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold">{t("synthVerdictGridTitle")}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-foreground">
            {t("synthPersonaCount").replace("{count}", String(results.length))}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {results.map((r) => (
            <div key={r.persona_id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-1 border border-border">
              <VerdictDot verdict={r.verdict} />
              <span className="text-sm font-medium">{r.persona_name}</span>
              <EmotionBadge emotion={r.emotion} />
            </div>
          ))}
        </div>
      </div>

      {/* Critical finding — persona-report style, distinct from OBT */}
      {criticalResult && (
        <div
          className="glass rounded-xl overflow-hidden border border-border/50"
          style={{
            borderLeftWidth: 4,
            borderLeftColor: criticalResult.verdict === "BLOCKER"
              ? "hsl(var(--destructive))"
              : "hsl(40 96% 60%)",
          }}
        >
          <div className="px-5 py-3 flex items-center gap-3 border-b border-border/30 bg-surface-1/30">
            <AlertTriangle
              className={cn(
                "h-4 w-4 shrink-0",
                criticalResult.verdict === "BLOCKER" ? "text-[hsl(var(--destructive))]" : "text-amber-400"
              )}
            />
            <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex-1">
              {t("synthCriticalFindingLabel")}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-foreground border border-border/50">
                {criticalResult.persona_name}
              </span>
              <EmotionBadge emotion={criticalResult.emotion} />
              <VerdictBadge verdict={criticalResult.verdict} />
            </div>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-foreground/85 leading-relaxed">{criticalResult.reasoning}</p>
          </div>
        </div>
      )}

      {/* Shared friction */}
      {shared_friction.length > 0 && (
        <div className="glass rounded-xl border border-border/50 px-4 py-3">
          <p className="text-xs text-muted-foreground mb-2">{t("synthSharedFrictionLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {shared_friction.map((friction, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-surface-1 border border-border text-muted-foreground">
                {friction}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Per-persona collapsible cards */}
      <h2 className="text-lg font-semibold">Detailed Breakdown</h2>
      <div className="space-y-3">
        {results.map((r) => {
          const isExpanded = expandedIds.has(r.persona_id);
          return (
            <div key={r.persona_id} className="glass rounded-xl border border-border/50 overflow-hidden">
              {/* Card header */}
              {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: full-width p-4 collapsible synth user card with avatar icon+name+zone nested; Button primitive (h-10 rounded-md) would conflict */}
              <button
                onClick={() => toggleExpanded(r.persona_id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-1/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">{r.persona_name}</span>
                  {r.zone_detected && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {r.zone_detected}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <EmotionBadge emotion={r.emotion} />
                  <VerdictBadge verdict={r.verdict} />
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Card body — divider-separated sections */}
              {isExpanded && (
                <div className="border-t border-border/40 divide-y divide-border/30">
                  {/* Goal + Primary focus — stat-block layout */}
                  {(r.current_goal || r.primary_focus) && (
                    <div className={cn(
                      "px-4 py-3 bg-surface-1/20 grid gap-x-4 gap-y-3",
                      r.current_goal && r.primary_focus ? "grid-cols-2" : "grid-cols-1"
                    )}>
                      {r.current_goal && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{t("synthCurrentGoalLabel")}</p>
                          <p className="text-sm text-foreground/85 leading-snug">{r.current_goal}</p>
                        </div>
                      )}
                      {r.primary_focus && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{t("synthPrimaryFocusLabel")}</p>
                          <p className="text-sm text-foreground/85 leading-snug">{r.primary_focus}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Synth user reaction */}
                  {r.persona_reaction && (
                    <div className="px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-400 mb-1.5">Synth user reaction</p>
                      <p className="text-sm text-foreground/85 leading-relaxed">{r.persona_reaction}</p>
                    </div>
                  )}

                  {/* Missing affordance */}
                  {r.missing_affordance && (
                    <div className="px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">{t("synthMissingAffordanceLabel")}</p>
                      <p className="text-sm text-foreground/80 leading-snug">{r.missing_affordance}</p>
                    </div>
                  )}

                  {/* Next action — decision summary */}
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{t("synthNextActionLabel")}</p>
                      <NextActionBadge action={r.next_action} />
                      {r.target_element && (
                        <span className="text-xs text-muted-foreground font-mono">→ {r.target_element}</span>
                      )}
                    </div>
                    {r.reasoning && (
                      <p className="text-sm text-foreground/85 leading-relaxed">{r.reasoning}</p>
                    )}
                  </div>

                  {/* Inner monologue — first-person pull-quote, last */}
                  {r.diary_entry && (
                    <div className="px-4 py-3 bg-primary/5">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Inner monologue</p>
                      <div className="flex gap-3">
                        <Quote className="h-4 w-4 text-primary/40 shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground/70 italic leading-relaxed">{r.diary_entry}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SynthUserSection;
