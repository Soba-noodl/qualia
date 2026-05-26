import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Target,
  Users,
  AlertTriangle,
  Calendar,
  Pencil,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useContextDocuments } from "@/hooks/use-context-documents";
import ContextDocumentList from "@/components/context-documents/ContextDocumentList";
import { formatDate } from "@/lib/dateFormat";

interface Persona {
  id: string;
  name: string;
  description: string;
}

interface ProjectContextCardProps {
  project: {
    id: string;
    name: string;
    mission: string;
    constraints: string | null;
    created_at: string;
    scope?: "whole" | "section";
    global_mission?: string | null;
  };
  personas: Persona[];
  onEdit: () => void;
}

const ProjectContextCard = ({ project, personas, onEdit }: ProjectContextCardProps) => {
  const { t } = useLanguage();
  const [missionExpanded, setMissionExpanded] = useState(false);
  const [globalMissionExpanded, setGlobalMissionExpanded] = useState(false);
  const [constraintsExpanded, setConstraintsExpanded] = useState(false);
  const { data: contextDocs = [] } = useContextDocuments(project.id);

  const isSection = project.scope === "section" && (project.global_mission ?? "").trim() !== "";

  // Check if text needs "Read More" (rough estimate: more than ~150 chars)
  const needsExpansion = (text: string) => text.length > 150;

  const renderExpandableText = (
    text: string,
    expanded: boolean,
    onToggle: () => void
  ) => (
    <>
      <p
        className={`text-sm text-muted-foreground leading-relaxed ${
          !expanded && needsExpansion(text) ? "line-clamp-3" : ""
        }`}
      >
        {text}
      </p>
      {needsExpansion(text) && (
        <button
          onClick={onToggle}
          className="mt-1 text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              {t("showLess")}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {t("readMore")}
            </>
          )}
        </button>
      )}
    </>
  );

  return (
    <div className="glass rounded-xl glow-border overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">{t("projectContext")}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={t("editContext") ?? "Edit context"}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-5">
        {/* Mission / Brief Section — for section projects: global mission then section purpose */}
        {isSection ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Target className="h-4 w-4" />
                {t("globalMissionLabel")}
              </div>
              <div className="relative">
                {renderExpandableText(
                  (project.global_mission ?? "").trim(),
                  globalMissionExpanded,
                  () => setGlobalMissionExpanded((v) => !v)
                )}
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Target className="h-4 w-4" />
                {t("whatsSectionMission")}
              </div>
              <div className="relative">
                {renderExpandableText(
                  project.mission,
                  missionExpanded,
                  () => setMissionExpanded((v) => !v)
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Target className="h-4 w-4" />
              {t("mission")}
            </div>
            <div className="relative">
              {renderExpandableText(
                project.mission,
                missionExpanded,
                () => setMissionExpanded((v) => !v)
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Personas Section - Accordion */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Users className="h-4 w-4" />
            {t("personas")} ({personas.length})
          </div>
          
          {personas.length > 0 ? (
            <Accordion type="multiple" className="w-full space-y-1">
              {personas.map((persona, idx) => (
                <AccordionItem
                  key={persona.id || idx}
                  value={persona.id || `persona-${idx}`}
                  className="border border-border rounded-lg px-3 bg-surface-1/50 data-[state=open]:bg-surface-1"
                >
                  <AccordionTrigger className="py-2 hover:no-underline">
                    <span className="text-sm font-medium text-foreground text-left">
                      {persona.name}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {persona.description}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {t("noPersonas")}
            </p>
          )}
        </div>

        {/* Constraints Section (if exists) */}
        {project.constraints && (
          <>
            <div className="border-t border-border" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <AlertTriangle className="h-4 w-4" />
                {t("constraints")}
              </div>
              <div className="relative">
                <p
                  className={`text-sm text-muted-foreground leading-relaxed ${
                    !constraintsExpanded && needsExpansion(project.constraints) ? "line-clamp-3" : ""
                  }`}
                >
                  {project.constraints}
                </p>
                {needsExpansion(project.constraints) && (
                  <button
                    onClick={() => setConstraintsExpanded(!constraintsExpanded)}
                    className="mt-1 text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
                  >
                    {constraintsExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        {t("showLess")}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        {t("readMore")}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Additional Context Section (if documents exist) */}
        {contextDocs.length > 0 && (
          <>
            <div className="border-t border-border" />
            <div className="pl-4">
              <ContextDocumentList
                projectId={project.id}
                readOnly
                showHeader
                maxVisible={5}
              />
            </div>
          </>
        )}

        {/* Footer - Created Date */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {t("created")} {formatDate(project.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectContextCard;
