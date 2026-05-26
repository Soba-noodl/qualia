import { useState } from "react";
import { ChevronDown, Database, Images, TriangleAlert } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/contexts/LanguageContext";
import UserDataInput from "./UserDataInput";
import ContextImageUploader, { type ContextImage } from "./ContextImageUploader";
import PersonaSelector from "./PersonaSelector";
import ScreenContextInput from "./ScreenContextInput";
import SynthUserSelector from "./SynthUserSelector";
import type { UploadPersona } from "@/types/audit";

interface AuditContextFieldsProps {
  screenContext: string;
  onScreenContextChange: (value: string) => void;
  screenContextLabel: string;
  screenContextPlaceholder?: string;
  userData: string;
  onUserDataChange: (value: string) => void;
  personas: UploadPersona[];
  selectedPersonaIds: string[];
  onTogglePersona: (personaId: string) => void;
  contextImages?: {
    onContextImagesChange: (images: ContextImage[]) => void;
    disabled?: boolean;
    figmaConnected: boolean;
    checkingFigma: boolean;
    figmaContextAllowed?: boolean;
  };
  synthUsers?: {
    enabled: boolean;
    onEnabledChange: (v: boolean) => void;
    selectedIds: string[];
    onToggleId: (id: string) => void;
  };
}

const AuditContextFields = ({
  screenContext,
  onScreenContextChange,
  screenContextLabel,
  screenContextPlaceholder,
  userData,
  onUserDataChange,
  personas,
  selectedPersonaIds,
  onTogglePersona,
  contextImages,
  synthUsers,
}: AuditContextFieldsProps) => {
  const { t } = useLanguage();
  const [userDataOpen, setUserDataOpen] = useState(false);
  const [contextImagesOpen, setContextImagesOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div data-tour="goal-input">
        <ScreenContextInput
          value={screenContext}
          onChange={onScreenContextChange}
          label={screenContextLabel}
          placeholder={screenContextPlaceholder}
        />
      </div>

      <PersonaSelector
        personas={personas}
        selectedPersonaIds={selectedPersonaIds}
        onToggle={onTogglePersona}
      />
      {selectedPersonaIds.length === 0 && personas.length > 0 && (
        <div className="flex items-start gap-1.5 -mt-1 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30">
          <TriangleAlert className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400">
            No archetype selected — analysis will evaluate for a general first-time user. Select an archetype for more targeted findings.
          </p>
        </div>
      )}

      <div className="space-y-1">
        <Collapsible open={userDataOpen} onOpenChange={setUserDataOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
            <Database className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">{t("addUserData")}</span>
            {userData.trim() && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${userDataOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <UserDataInput value={userData} onChange={onUserDataChange} />
          </CollapsibleContent>
        </Collapsible>

        {contextImages && (
          <Collapsible open={contextImagesOpen} onOpenChange={setContextImagesOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
              <Images className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">{t("addReferenceImages")}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${contextImagesOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <ContextImageUploader
                onContextImagesChange={contextImages.onContextImagesChange}
                disabled={contextImages.disabled}
                figmaConnected={contextImages.figmaConnected}
                checkingFigma={contextImages.checkingFigma}
                figmaContextAllowed={contextImages.figmaContextAllowed}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {synthUsers && (
        <div className="pt-2 border-t border-border/50">
          <SynthUserSelector
            enabled={synthUsers.enabled}
            onEnabledChange={synthUsers.onEnabledChange}
            selectedIds={synthUsers.selectedIds}
            onToggleId={synthUsers.onToggleId}
          />
        </div>
      )}
    </div>
  );
};

export default AuditContextFields;
