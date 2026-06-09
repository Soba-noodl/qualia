import { Users, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { SYNTH_ARCHETYPES, MAX_SYNTH_ARCHETYPES } from "./synthUserTypes";
import { cn } from "@/lib/utils";

interface SynthUserSelectorProps {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  selectedIds: string[];
  onToggleId: (id: string) => void;
  hideToggleRow?: boolean;
}

const SynthUserSelector = ({
  enabled,
  onEnabledChange,
  selectedIds,
  onToggleId,
  hideToggleRow = false,
}: SynthUserSelectorProps) => {
  const { t } = useLanguage();
  const atLimit = selectedIds.length >= MAX_SYNTH_ARCHETYPES;

  return (
    <div className="space-y-3">
      {/* Toggle row */}
      {!hideToggleRow && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t("synthToggleLabel")}</span>
          </div>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
      )}

      {/* Archetype picker */}
      {(enabled || hideToggleRow) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">{t("synthToggleNote")}</p>
            {selectedIds.length > 0 && (
              <span className="text-xs font-semibold text-primary">
                {selectedIds.length} / {MAX_SYNTH_ARCHETYPES} selected
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2">
            {SYNTH_ARCHETYPES.map((archetype) => {
              const isSelected = selectedIds.includes(archetype.id);
              const isDisabled = !isSelected && atLimit;

              return (
                <button
                  key={archetype.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onToggleId(archetype.id)}
                  className={cn(
                    "relative w-full text-left px-3 py-2.5 pr-9 rounded-lg border text-sm transition-all",
                    isSelected
                      ? "border-primary bg-primary/15 text-foreground"
                      : isDisabled
                      ? "border-border bg-surface-1/30 text-muted-foreground/40 cursor-not-allowed"
                      : "border-border bg-surface-1/50 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-surface-1"
                  )}
                >
                  <span className="font-medium block">{archetype.name}</span>
                  <span className="text-xs text-muted-foreground block mt-0.5 leading-snug">
                    {archetype.description}
                  </span>
                  {/* Checkbox indicator */}
                  <span
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-border bg-background"
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
          {atLimit && (
            <p className="text-xs text-amber-400 px-1 font-medium">
              {t("synthMaxSelected")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SynthUserSelector;
