import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Image as ImageIcon, ArrowUpDown } from "lucide-react";
import { AuditCard } from "./AuditCard";
import type { Audit } from "@/hooks/use-audits";

type SortOption = "date-desc" | "date-asc" | "score-desc" | "score-asc";
type AuditFilter = "all" | "single" | "flow" | "prototype";
type TFunction = (key: string) => string;

interface ProjectAuditsListProps {
  audits: Audit[];
  sortedAudits: Audit[];
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  getSignedUrl: (path: string) => string;
  analyzingAuditId: string | null;
  onSelectAudit: (audit: Audit) => void;
  onDeleteAudit: (e: React.MouseEvent, audit: Audit) => void;
  onRetryAudit: (audit: Audit) => (e: React.MouseEvent) => void;
  t: TFunction;
  /** All audits (unsorted) for resolving follow-up deltas */
  allAudits?: Audit[];
}

export function ProjectAuditsList({
  audits,
  sortedAudits,
  sortBy,
  onSortChange,
  getSignedUrl,
  analyzingAuditId,
  onSelectAudit,
  onDeleteAudit,
  onRetryAudit,
  t,
  allAudits,
}: ProjectAuditsListProps) {
  const getReAuditDelta = (audit: Audit): number | null => {
    if (!audit.follow_up_audit_id) return null;
    const pool = allAudits ?? audits;
    const prev = pool.find(a => a.id === audit.follow_up_audit_id);
    if (!prev) return null;
    const prevScore = prev.overall_score ?? prev.ai_report?.score ?? null;
    const currScore = audit.overall_score ?? audit.ai_report?.score ?? null;
    if (prevScore === null || currScore === null) return null;
    return currScore - prevScore;
  };

  const [filter, setFilter] = useState<AuditFilter>("all");
  const [reauditOnly, setReauditOnly] = useState(false);

  const filteredAudits = sortedAudits.filter((audit) => {
    if (reauditOnly && !audit.follow_up_audit_id) return false;
    if (filter === "all") return true;
    const mode = audit.ai_report?.analysis_mode;
    if (filter === "prototype") return mode === "prototype";
    if (filter === "flow") return mode === "flow" || mode === "auto" || (!mode && !!(audit.flow_images && audit.flow_images.length > 0));
    return mode === "single" || (!mode && !(audit.flow_images && audit.flow_images.length > 0));
  });

  const hasReaudits = audits.some(a => !!a.follow_up_audit_id);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{t("pastAudits")}</h2>
        {audits.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Type filter */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(["all", "single", "flow", "prototype"] as AuditFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`h-8 px-3 text-sm rounded-md transition-colors ${
                    filter === f
                      ? "bg-secondary text-secondary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(f === "all" ? "filterAll" : f === "single" ? "filterSingle" : f === "flow" ? "filterFlow" : "filterPrototype")}
                </button>
              ))}
            </div>
            {/* Re-audit toggle — only shown if the project has any re-audits */}
            {hasReaudits && (
              <button
                type="button"
                onClick={() => setReauditOnly(v => !v)}
                className={`flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg border transition-colors ${
                  reauditOnly
                    ? "bg-primary/10 border-primary/40 text-primary font-medium"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                }`}
                title={t("filterReaudit")}
              >
                {t("filterReaudit")}
              </button>
            )}
            {/* Sort */}
            <Select
              value={sortBy}
              onValueChange={(value: SortOption) => onSortChange(value)}
            >
              <SelectTrigger className="w-[180px] glass border-border">
                <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="date-desc">{t("sortDateNewest")}</SelectItem>
                <SelectItem value="date-asc">{t("sortDateOldest")}</SelectItem>
                <SelectItem value="score-desc">{t("sortScoreHigh")}</SelectItem>
                <SelectItem value="score-asc">{t("sortScoreLow")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div data-tour="audits-list">
        {audits.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t("noAuditsYet")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t("selectAuditEmptyState")}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredAudits.map((audit) => (
              <AuditCard
                key={audit.id}
                audit={audit}
                imageUrl={getSignedUrl(audit.screenshot_url)}
                isAnalyzing={analyzingAuditId === audit.id}
                onSelect={() => onSelectAudit(audit)}
                onDelete={(e) => onDeleteAudit(e, audit)}
                onRetry={onRetryAudit(audit)}
                t={t}
                reAuditDelta={getReAuditDelta(audit)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
