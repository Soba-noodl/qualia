import { Label } from "@/components/ui/label";
import { Check, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UploadPersona } from "@/types/audit";

interface PersonaSelectorProps {
  personas: UploadPersona[];
  selectedPersonaIds: string[];
  onToggle: (id: string) => void;
}

const PersonaSelector = ({ personas, selectedPersonaIds, onToggle }: PersonaSelectorProps) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{t("selectUserArchetypes")}</Label>
        {selectedPersonaIds.length > 0 && (
          <span className="text-xs font-semibold text-primary flex items-center gap-1">
            <Users className="h-3 w-3" />
            {selectedPersonaIds.length} selected
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {personas.map((persona) => {
          const isSelected = selectedPersonaIds.includes(persona.id);
          return (
            <button
              key={persona.id}
              type="button"
              onClick={() => onToggle(persona.id)}
              className={`
                relative p-3 pr-8 rounded-lg border-2 transition-all cursor-pointer
                flex items-center text-left min-h-[48px]
                ${isSelected
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted/30"
                }
              `}
            >
              <span className={`text-sm ${isSelected ? "font-semibold" : "font-medium"}`}>
                {persona.name}
              </span>
              <span
                className={`absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                  isSelected ? "border-primary bg-primary" : "border-border bg-background"
                }`}
              >
                {isSelected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("selectMultiplePersonasHint")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("archetypeComparisonHint")}
      </p>
    </div>
  );
};

export default PersonaSelector;
