import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export interface Persona {
  id?: string;
  name: string;
  description: string;
}

interface PersonaManagerProps {
  personas: Persona[];
  onChange: (personas: Persona[]) => void;
  disabled?: boolean;
}

const PersonaManager = ({ personas, onChange, disabled = false }: PersonaManagerProps) => {
  const { t } = useLanguage();

  // Assign a stable local id to each persona object (keyed on object identity)
  // so React's reconciliation tracks each input across re-renders. Persona DB
  // records already have `id`; locally-added personas do not, so we mint one.
  const localKeysRef = useRef<WeakMap<Persona, string>>(new WeakMap());
  const getKey = (persona: Persona): string => {
    if (persona.id) return persona.id;
    const existing = localKeysRef.current.get(persona);
    if (existing) return existing;
    const fresh = `local-${crypto.randomUUID()}`;
    localKeysRef.current.set(persona, fresh);
    return fresh;
  };

  const handleAdd = () => {
    onChange([...personas, { name: "", description: "" }]);
  };

  const handleRemove = (index: number) => {
    if (personas.length <= 1) return;
    onChange(personas.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, field: keyof Persona, value: string) => {
    const updated = personas.map((p, i) => {
      if (i !== index) return p;
      const next = { ...p, [field]: value };
      // Carry the stable local key over to the new object identity so
      // the input retains focus across re-renders.
      const carried = localKeysRef.current.get(p);
      if (carried) localKeysRef.current.set(next, carried);
      return next;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-primary">{t("personas")}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={disabled}
          className="gap-1"
        >
          <Plus className="h-3 w-3" />
          {t("addPersona")}
        </Button>
      </div>

      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
        {personas.map((persona, index) => (
          <div
            key={getKey(persona)}
            className="p-4 rounded-lg bg-surface-1 border border-border space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <Label htmlFor={`persona-name-${index}`} className="text-sm text-muted-foreground">
                  {t("personaName")}
                </Label>
                <Input
                  id={`persona-name-${index}`}
                  value={persona.name}
                  onChange={(e) => handleUpdate(index, "name", e.target.value)}
                  placeholder={t("personaNamePlaceholder")}
                  className="bg-surface-2 border-border mt-1"
                  disabled={disabled}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground text-right mt-0.5">{persona.name.length}/100</p>
              </div>
              {personas.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  className="text-red-400 hover:text-red-400/80 mt-5"
                  aria-label={`${t("removePersona") ?? "Remove persona"} ${persona.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div>
              <Label htmlFor={`persona-desc-${index}`} className="text-sm text-muted-foreground">
                {t("personaDescription")}
              </Label>
              <Textarea
                id={`persona-desc-${index}`}
                value={persona.description}
                onChange={(e) => handleUpdate(index, "description", e.target.value)}
                placeholder={t("personaDescriptionPlaceholder")}
                className="bg-surface-2 border-border min-h-[60px] resize-none mt-1"
                disabled={disabled}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right mt-0.5">{persona.description.length}/500</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonaManager;
