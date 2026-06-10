import { useState, useEffect, useRef } from "react";
import { Target, Rocket, Users, AlertCircle, Image as ImageIcon, ChevronDown, ChevronUp, BarChart2, Link, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { createScreenshotSignedUrls } from "@/services/storage.service";
import { storagePathsKey } from "@/lib/storage-paths";
import { cn } from "@/lib/utils";

interface Persona {
  id: string;
  name: string;
  description: string;
}

/** Matches the legacy fallback stored when flow goal was left empty (treat as empty for display) */
const FLOW_GOAL_PLACEHOLDER = /^Flow analysis \(\d+ steps?\)$/i;

interface AuditContextCardProps {
  screenGoal: string | null;
  /** When true, label shows "Flow goal" and empty/placeholder is shown as "No flow goal specified" */
  isFlowAudit?: boolean;
  /** When true, the goal block shows "Prototype link" with the Figma URL */
  isPrototypeMode?: boolean;
  userData?: string | null;
  mission: string;
  personas: Persona[];
  /** Names of personas actually selected for this audit — only these get highlighted in purple */
  selectedPersonaNames?: string[];
  constraints: string | null;
  contextImages?: string[] | null;
}

// Expandable text component with "Show more/less" toggle
const ExpandableText = ({ 
  text, 
  maxLines = 3,
  className = ""
}: { 
  text: string; 
  maxLines?: number;
  className?: string;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Estimate if text needs expansion (rough heuristic: ~60 chars per line)
  const needsExpansion = text.length > maxLines * 60;
  
  return (
    <div className={className}>
      <p 
        className={cn(
          "text-sm text-foreground transition-all",
          !isExpanded && needsExpansion && "line-clamp-3"
        )}
      >
        {text}
      </p>
      {needsExpansion && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-1 text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          {isExpanded ? (
            <>
              Show less
              <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Show more
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
};

const AuditContextCard = ({ screenGoal, isFlowAudit, isPrototypeMode, userData, mission, personas, selectedPersonaNames, constraints, contextImages }: AuditContextCardProps) => {
  const { t } = useLanguage();
  const goalLabel = isPrototypeMode ? "Prototype link" : isFlowAudit ? t("flowGoalLabel") : t("screenGoal");
  const isEmptyGoal =
    !screenGoal?.trim() || (!isPrototypeMode && isFlowAudit && FLOW_GOAL_PLACEHOLDER.test(screenGoal.trim()));
  const emptyGoalText = isPrototypeMode ? "No prototype link" : isFlowAudit ? t("noFlowGoal") : t("noScreenGoal");
  const displayGoal = isEmptyGoal ? null : screenGoal!.trim();
  const [personasExpanded, setPersonasExpanded] = useState(false);
  const [signedContextUrls, setSignedContextUrls] = useState<string[]>([]);
  const [isPersonasOverflowing, setIsPersonasOverflowing] = useState(false);
  const personasRef = useRef<HTMLDivElement>(null);
  const contextPathsKey = storagePathsKey(contextImages);
  const contextImagesRef = useRef(contextImages);
  contextImagesRef.current = contextImages;

  // Measure if personas content overflows (exceeds 3 lines / ~72px)
  useEffect(() => {
    const checkOverflow = () => {
      if (personasRef.current) {
        // Check if scrollHeight exceeds clientHeight (content is clipped)
        const isOverflowing = personasRef.current.scrollHeight > personasRef.current.clientHeight;
        setIsPersonasOverflowing(isOverflowing);
      }
    };
    
    // Run after render
    checkOverflow();
    
    // Also check on window resize
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [personas]);

  useEffect(() => {
    const paths = contextImagesRef.current;
    const generateContextImageUrls = async () => {
      if (!paths || paths.length === 0) {
        setSignedContextUrls([]);
        return;
      }

      const urls = await createScreenshotSignedUrls(paths, 3600);
      setSignedContextUrls(urls);
    };

    void generateContextImageUrls();
  }, [contextPathsKey]);

  return (
    <Card className="bg-surface-1 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Target className="h-4 w-4 text-primary" />
          </div>
          {t("auditContext")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Screen / Flow Goal / Prototype Link - Highest Priority */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-3">
            {isPrototypeMode
              ? <Link className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              : <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            }
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary font-medium mb-1">{goalLabel}</p>
              {isPrototypeMode && displayGoal ? (
                <a
                  href={displayGoal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Open Figma prototype
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                </a>
              ) : (
                <p className="text-sm font-semibold text-foreground">
                  {displayGoal ?? <span className="text-muted-foreground italic">{emptyGoalText}</span>}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* User data - same style as Screen Goal */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-3">
            <BarChart2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary font-medium mb-1">{t("userDataLabel")}</p>
              <p className="text-sm font-semibold text-foreground">
                {userData?.trim() || <span className="text-muted-foreground italic">{t("noUserData")}</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Mission - Expandable */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{t("mission")}</p>
            <ExpandableText text={mission} maxLines={3} />
          </div>
        </div>

        {/* Personas - Expandable */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{t("personas")}</p>
            {personas.length > 0 ? (
              <div>
                <div 
                  ref={personasRef}
                  className={cn(
                    "flex flex-wrap gap-1.5 transition-all",
                    !personasExpanded && "max-h-[72px] overflow-hidden"
                  )}
                >
                  {personas.map((persona) => {
                    const isSelected = selectedPersonaNames
                      ? selectedPersonaNames.includes(persona.name)
                      : true;
                    return (
                      <span
                        key={persona.id}
                        className={cn(
                          "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium",
                          isSelected
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-muted text-muted-foreground"
                        )}
                        title={persona.description}
                      >
                        {persona.name}
                      </span>
                    );
                  })}
                </div>
                {isPersonasOverflowing && (
                  <button
                    onClick={() => setPersonasExpanded(!personasExpanded)}
                    className="mt-1 text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                  >
                    {personasExpanded ? (
                      <>
                        Show less
                        <ChevronUp className="h-3 w-3" />
                      </>
                    ) : (
                      <>
                        Show more
                        <ChevronDown className="h-3 w-3" />
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">{t("noPersonas")}</p>
            )}
          </div>
        </div>

        {/* Constraints - Expandable */}
        {constraints && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">{t("constraints")}</p>
              <ExpandableText text={constraints} maxLines={3} />
            </div>
          </div>
        )}

        {/* Visual Context - Context Images (non-clickable thumbnails) */}
        {signedContextUrls.length > 0 && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-2">{t("visualContext")}</p>
              <div className="grid grid-cols-3 gap-2">
                {signedContextUrls.map((imageUrl, index) => (
                  <div
                    key={imageUrl}
                    className="w-16 h-16 rounded-md overflow-hidden border border-border bg-surface-2"
                  >
                    <img
                      src={imageUrl}
                      alt={`Context ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditContextCard;
