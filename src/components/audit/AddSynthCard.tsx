import { useState } from "react";
import { Users, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import SynthUserSelector from "./SynthUserSelector";

interface AddSynthCardProps {
  onRun: (personaIds: string[]) => Promise<void>;
  /** When true, "Run" becomes "Retry" — prior attempt failed */
  isRetry?: boolean;
  /** When true, all archetypes from the failed attempt are pre-selected and the picker is open */
  initialPersonaIds?: string[];
}

const AddSynthCard = ({ onRun, isRetry = false, initialPersonaIds = [] }: AddSynthCardProps) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<boolean>(initialPersonaIds.length > 0);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialPersonaIds);
  const [submitting, setSubmitting] = useState(false);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleRun = async () => {
    if (selectedIds.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onRun(selectedIds);
      // On success, the parent unmounts this card via its visibility predicate.
      // No state cleanup needed.
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <div className="glass rounded-xl border border-primary/30 bg-gradient-to-br from-primary/8 to-primary/2 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{t("addSynthCardTitle")}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{t("addSynthCardDesc")}</p>
          </div>
          <Button size="sm" onClick={() => setExpanded(true)} className="shrink-0 self-center">
            {isRetry ? t("addSynthRetryButton") : "Add"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl border border-primary/30 bg-gradient-to-br from-primary/8 to-primary/2 px-4 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("addSynthCardTitle")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("addSynthCardPickerHint")}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="shrink-0 p-1.5 rounded-md hover:bg-surface-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t("closeButtonAria")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <SynthUserSelector
        enabled
        onEnabledChange={() => { /* always-on within the card */ }}
        selectedIds={selectedIds}
        onToggleId={toggleId}
        hideToggleRow
      />

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <span className="text-xs text-muted-foreground">ⓘ {t("addSynthCreditDisclosure")}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setExpanded(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleRun} disabled={selectedIds.length === 0 || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {t("addSynthRunButton")}
              </>
            ) : (
              isRetry ? t("addSynthRetryButton") : t("addSynthRunButton")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddSynthCard;
