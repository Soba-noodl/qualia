import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  X,
  Workflow,
  Compass,
  Eye,
  MousePointer2,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Star,
  Send,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Loader2,
  Download,
  BookOpen,
  ShieldCheck,
  Info,
  GitBranch,
  Layers,
  Check,
  Copy,
  ExternalLink,
} from "lucide-react";
import { LogoIcon } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import ScoreCard from "./ScoreCard";
import AuditContextCard from "./AuditContextCard";
import FlowImageCarousel from "./audit/FlowImageCarousel";
import ImageAnnotator, { type IssueRectOverlay } from "./audit/ImageAnnotator";
import { resolveLayerIds } from "@/lib/resolveLayerIds";
import AutoCrawlThumbnailStrip from "./audit/AutoCrawlThumbnailStrip";
import { isScreenshotExpired } from "@/lib/screenshot-retention";
import AutoCrawlDesignSystem from "./audit/AutoCrawlDesignSystem";
import UserDataNudge from "./audit/UserDataNudge";
import ContextDocNudge from "./audit/ContextDocNudge";
import { AccessibilityCard } from "./AccessibilityCard";
import SynthUserSection from "./audit/SynthUserSection";
import AddSynthCard from "./audit/AddSynthCard";
import { AuditProvenanceRow } from "./audit/AuditProvenanceRow";
import { useResultsTour } from "@/hooks/use-product-tour";
import { TourBridge } from "@/components/TourBridge";
import {
  useUpdateAuditFeedback,
  useAuditIssueFeedback,
  useUpsertAuditIssueFeedback,
  type IssueFeedbackStance,
} from "@/hooks/use-audits";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { scoreToTailwindColor } from "@/lib/score-colors";
import { getMarkerColor } from "@/lib/markerColors";
import { stripCoordinateFromReportText } from "@/lib/stripReportCoordinateText";
import { getPrincipleDescription } from "@/lib/uxTaxonomy";
import { EXPLAIN_REAUDIT_DELTA_URL, GENERATE_FEEDBACK_RESPONSE_URL, REFRAME_EXPORT_URL } from "@/lib/api";
import {
  updateAuditReauditExplanation,
  type AiReport,
  type FlowTransition,
  type FlowAnalysis,
  type FlowIssueData,
  type AccessibilityBlock,
  type SynthUserResult,
  type SynthUsersBlock,
  type CrossSession,
  type DesignSystemBlock,
  type PrototypeCompleteness,
  type BoundingBox,
} from "@/services/audit.service";
import { createScreenshotSignedUrl, createScreenshotSignedUrls } from "@/services/storage.service";
import { invokeReframeExport } from "@/services/integration.service";
import { exportAuditPptx, type ExportPreset, type ExecutiveReframedContent } from "@/lib/exportAuditPptx";
import { exportAuditAi } from "@/lib/exportAuditAi";
import { ExportPresetModal } from "@/components/ExportPresetModal";
import { McpSetupModal } from "@/components/McpSetupModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useIntegrationStatus } from "@/hooks/use-integrations";
import { formatDate, formatDateTime } from "@/lib/dateFormat";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "@/components/ui/sonner";
import { PluginCTABanner } from "@/components/PluginCTABanner";

// UI timing constants. Long enough to register as confirmation,
// short enough not to linger past the user's next action.
const FEEDBACK_SAVED_TOAST_MS = 2000;       // "Saved" indicator next to feedback inputs
const ISSUE_HIGHLIGHT_CLEAR_MS = 2000;      // Issue-card click highlight pulse on canvas markers
const SCROLL_HIGHLIGHT_CLEAR_MS = 1500;     // Marker click → smooth-scroll-to-issue highlight pulse
const PROMPT_COPIED_TOAST_MS = 2000;        // "Copied!" indicator on the export-prompt copy button

interface Persona {
  id: string;
  name: string;
  description: string;
}

// Computed marker position (percentage-based for CSS)
interface MarkerPosition {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
}

interface AuditDetailProps {
  audit: {
    id: string;
    screenshot_url: string;
    /** Storage path (before signing) for same-screen comparison; if set, use this for isFeedbackOnlyReaudit */
    screenshot_storage_path?: string;
    flow_images?: string[] | null;
    context_images?: string[] | null;
    created_at: string;
    screen_context?: string | null;
    user_data?: string | null;
    feedback_rating?: number | null;
    feedback_comment?: string | null;
    follow_up_audit_id?: string | null;
    reaudit_explanation?: string | null;
    ai_provider?: string | null;
    /**
     * T-079: per-frame node maps captured by the plugin. Aligned 1:1 with
     * the exported images. Used to resolve `layer_ids` from the LLM response
     * into pixel rectangles. Null for webapp audits and pre-T-079 plugin runs.
     */
    node_maps?: Array<Array<{ id: string; name: string; type: string; bounds: [number, number, number, number] }>> | null;
    /** T-079: scale factor used by the plugin's exportAsync (e.g. 2 / 1.25 / 1). */
    export_scale?: number | null;
  };
  aiReport: AiReport;
  projectContext: {
    name: string;
    mission: string;
    persona: string;
    constraints: string | null;
    language?: string;
  };
  personas: Persona[];
  projectId: string;
  onClose: () => void;
  userId?: string;
  onReAuditRequest?: () => void;
  /** When provided, re-audit boxes show a link to open the previous audit (same modal, switch to that audit) */
  onOpenAuditId?: (auditId: string) => void;
  previousAudit?: { id: string; overall_score: number | null; screenshot_url?: string | null; flow_images?: string[] | null; ai_report?: { score: number; one_big_thing?: string } | null } | null;
  /** The most recent re-audit of this audit, if any. Shown as a "View latest re-audit" link. */
  latestReaudit?: { id: string } | null;
  /** Synth analysis is still running in the background */
  isSynthPending?: boolean;
  /** When provided, prototype audits show an Add Synth Card; called when user runs post-hoc synth */
  onRunSynth?: (personaIds: string[]) => Promise<void>;
  /** When true, show a one-time nudge to install the Figma plugin (used after auditing via Figma URL from web app) */
  showPluginCTA?: boolean;
}

type IssueFeedbackStanceType = IssueFeedbackStance;

type IssueFeedbackDraft = {
  stance: IssueFeedbackStanceType | null;
  reason: string | null;
};

function IssueReplyBlock({
  displayStance,
  displayReason,
  onStanceChange,
  onReasonChange,
  onReasonBlur,
  t,
}: {
  displayStance: IssueFeedbackStanceType | null;
  displayReason: string;
  onStanceChange: (stance: IssueFeedbackStanceType | null, currentReason: string | null) => void;
  onReasonChange: (reason: string) => void;
  onReasonBlur: (trimmedReason: string | null) => void;
  t: (key: string) => string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!showSaved) return;
    const id = window.setTimeout(() => setShowSaved(false), FEEDBACK_SAVED_TOAST_MS);
    return () => clearTimeout(id);
  }, [showSaved]);

  const handleStance = (stance: IssueFeedbackStanceType) => {
    const next = displayStance === stance ? null : stance;
    const reason = displayReason.trim() || null;
    onStanceChange(next, reason);
  };

  const hasContent = displayReason.trim().length > 0;

  const handleReasonBlur = () => {
    const trimmed = displayReason.trim() || null;
    onReasonBlur(trimmed);
    if (trimmed) setShowSaved(true);
    setIsFocused(false);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- propagation fence: the onClick/onMouseDown handlers only stopPropagation to prevent the parent issue card from closing while interacting with feedback inputs; not a real interactive surface
    <div
      className="relative z-10 mt-3 pt-3 border-t border-border/40 space-y-2"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-medium text-muted-foreground">{t("issueFeedbackYourResponse")}</p>
      <div className="flex flex-wrap gap-1.5">
        {(["agree", "disagree", "already_fixed", "not_relevant"] as const).map((stance) => (
          // eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: feedback stance button with per-stance conditional bg-primary/20 border and text color; Button variant ergonomics don't map cleanly to the 4-stance inline chip row
          <button
            key={stance}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStance(stance);
            }}
            className={cn(
              "text-xs px-2.5 py-1.5 rounded-md border transition-colors",
              displayStance === stance
                ? "bg-primary/20 border-primary/50 text-primary"
                : "bg-surface-1 border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            )}
          >
            {t(stance === "agree" ? "issueFeedbackStanceAgree" : stance === "disagree" ? "issueFeedbackStanceDisagree" : stance === "already_fixed" ? "issueFeedbackStanceAlreadyFixed" : "issueFeedbackStanceNotRelevant")}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <textarea
          aria-label={t("issueFeedbackYourResponse")}
          className={cn(
            "w-full min-h-[60px] px-2.5 py-2 rounded-md border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 resize-none transition-colors",
            isFocused && "border-primary/50 bg-primary/10 focus:ring-primary/50",
            hasContent && !isFocused && "border-primary/20 bg-primary/5",
            !hasContent && !isFocused && "bg-background border-border focus:ring-primary/50"
          )}
          placeholder={t("issueFeedbackReasonPlaceholder")}
          value={displayReason}
          onChange={(e) => onReasonChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleReasonBlur}
          maxLength={300}
        />
        {showSaved && (
          <p className="text-[10px] text-primary font-medium animate-in fade-in">
            {t("issueFeedbackReasonSaved")}
          </p>
        )}
      </div>
    </div>
  );
}

/** Returns the explanation only if it ends with a proper sentence terminator — drops truncated responses. */
function sanitizeExplanation(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return /[.!?]$/.test(trimmed) ? trimmed : null;
}

const AuditDetail = ({ audit, aiReport, projectContext, personas, projectId, onClose, userId, onReAuditRequest, onOpenAuditId, previousAudit, latestReaudit, isSynthPending, onRunSynth, showPluginCTA }: AuditDetailProps) => {
  const { t, language } = useLanguage();
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedEngine, setExpandedEngine] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ux" | "synth" | "design_system">("ux");
  const [synthRetryIds, setSynthRetryIds] = useState<string[] | null>(null);

  // Reset retry state when navigating to a different audit so the AddSynthCard
  // starts fresh ("Add", not "Retry") for each audit.
  useEffect(() => {
    setSynthRetryIds(null);
  }, [audit.id]);

  // If the synth tab disappears (e.g. failed run cleared pending without writing synth_users),
  // fall back to the UX tab so the right column doesn't render blank.
  useEffect(() => {
    if (activeTab === "synth" && !aiReport.synth_users && !isSynthPending) {
      setActiveTab("ux");
    }
  }, [activeTab, aiReport.synth_users, isSynthPending]);

  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const [highlightedIssueId, setHighlightedIssueId] = useState<string | null>(null);
  const [currentFlowSlideIndex, setCurrentFlowSlideIndex] = useState(0);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(audit.feedback_rating ?? null);
  const [feedbackComment, setFeedbackComment] = useState(audit.feedback_comment ?? "");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(!!audit.feedback_rating);
  const [reAuditExplanation, setReAuditExplanation] = useState<string | null>(sanitizeExplanation(audit.reaudit_explanation ?? "") );
  const [reAuditExplanationLoading, setReAuditExplanationLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [claudeDialogOpen, setClaudeDialogOpen] = useState(false);
  const [mcpSetupOpen, setMcpSetupOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const { data: integrationStatus } = useIntegrationStatus();
  const mcpConnected = !!integrationStatus?.mcp;
  const issueRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { startTour, destroyTour } = useResultsTour();
  const updateFeedback = useUpdateAuditFeedback(projectId);
  const { data: issueFeedbackList = [] } = useAuditIssueFeedback(audit.id);
  const previousAuditId = audit.follow_up_audit_id ?? undefined;
  const { data: previousFeedbackList = [] } = useAuditIssueFeedback(previousAuditId);
  const upsertIssueFeedback = useUpsertAuditIssueFeedback();

  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, IssueFeedbackDraft>>({});
  const [previousFeedbackExpanded, setPreviousFeedbackExpanded] = useState(false);

  useEffect(() => {
    setFeedbackDraft({});
  }, [audit.id]);

  const issueFeedbackByKey = useMemo(() => {
    const map = new Map<string, { stance: IssueFeedbackStance; reason: string | null }>();
    for (const row of issueFeedbackList) {
      const key = `${row.engine_id}-${row.issue_index}`;
      map.set(key, { stance: row.stance as IssueFeedbackStance, reason: row.reason });
    }
    return map;
  }, [issueFeedbackList]);

  // Determine render mode — auto-crawl takes priority over flow
  const isPrototypeMode = aiReport.analysis_mode === "prototype";
  const isAutoMode = aiReport.analysis_mode === "auto";
  const isFlowMode = !isAutoMode && !isPrototypeMode && !!(audit.flow_images && audit.flow_images.length > 1);

  // T-076: Pin-drift workaround — pins only work reliably on Gemini (trained on 0-1000 bbox format).
  // Null provider = legacy audit (pre-BYOK, platform Gemini key), treat as Gemini.
  const isPinProvider = !audit.ai_provider || audit.ai_provider === "gemini";

  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number | null>(null);

  // Start results tour when component mounts
  useEffect(() => {
    startTour();
    return () => destroyTour();
  }, [startTour, destroyTour]);

  // Build flat list of all issues with unique IDs for marker sync
  // Only localized issues (with valid location) get numbered markers
  const { allIssues, localizedIssues, flowIssues } = useMemo(() => {
    const engineIds = ["system_logic", "heuristic", "cognitive", "interaction"] as const;
    let localizedIndex = 0;

    // Convert bounding box [ymin, xmin, ymax, xmax] (0-1000 scale) to center position (0-100 %)
    const boxToMarkerPosition = (box: BoundingBox): MarkerPosition | null => {
      if (!box || !Array.isArray(box) || box.length !== 4) return null;
      const [ymin, xmin, ymax, xmax] = box;
      
      // Validate all values are finite numbers
      if (!box.every((v) => Number.isFinite(v))) return null;
      
      // Validate box is properly formed (min < max)
      if (ymin >= ymax || xmin >= xmax) return null;
      
      // Validate values are within 0-1000 range (with some tolerance for edge cases)
      if (ymin < -50 || ymax > 1050 || xmin < -50 || xmax > 1050) return null;
      
      // Calculate center and convert from 0-1000 to 0-100 percentage
      const centerY = (ymin + ymax) / 2 / 10;
      const centerX = (xmin + xmax) / 2 / 10;
      
      // Clamp to safe display range (5-95%)
      const clamp = (n: number) => Math.max(5, Math.min(95, n));
      
      return {
        x: clamp(centerX),
        y: clamp(centerY),
      };
    };
    
    type IssueItem = {
      id: string;
      markerIndex: number | null;
      issue: string;
      location: MarkerPosition | null;
      box_2d: BoundingBox | null;
      /** T-079: Figma layer ids the model attributed this issue to. */
      layer_ids: string[] | null;
      isGeneral: boolean;
      engineId: string;
      imageIndex: number | null;
      why_it_matters: string;
      suggestion: string;
    };
    const issues: IssueItem[] = engineIds.flatMap((engineId) => {
      const findings = aiReport.engines[engineId] || [];
      return findings.map((finding, idx) => {
        const markerPos = boxToMarkerPosition(finding.box_2d ?? null);
        const hasValidLocation = !!markerPos;
        
        // For flow/auto/prototype mode, get image_index from the finding
        const imageIndex = (isFlowMode || isAutoMode || isPrototypeMode) && typeof finding.image_index === "number"
          ? finding.image_index
          : null;
        
        return {
          id: `${engineId}-${idx}`,
          // Only assign marker index if localized (has valid bounding box)
          markerIndex: hasValidLocation ? localizedIndex++ : null,
          issue: stripCoordinateFromReportText(finding.issue),
          // Store computed center position for marker rendering
          location: markerPos,
          box_2d: finding.box_2d ?? null,
          // T-079: thread the layer_ids array (plugin path).
          layer_ids: Array.isArray(finding.layer_ids) ? finding.layer_ids : null,
          isGeneral: !hasValidLocation,
          engineId,
          imageIndex, // Which step this issue belongs to (for flow mode)
          why_it_matters: stripCoordinateFromReportText(finding.why_it_matters),
          suggestion: stripCoordinateFromReportText(finding.suggestion),
        };
      });
    });

    // Append accessibility violations that have box_2d so they get pins
    const acc = aiReport.accessibility;
    if (acc) {
      const cf = acc.contrast_failures ?? [];
      const ov = acc.other_violations ?? [];
      cf.forEach((row, idx) => {
        const markerPos = boxToMarkerPosition(row.box_2d);
        if (!markerPos) return;
        const imageIndex = (isFlowMode || isAutoMode || isPrototypeMode) && typeof row.image_index === "number" ? row.image_index : null;
        issues.push({
          id: `accessibility-contrast-${idx}`,
          markerIndex: localizedIndex++,
          issue: stripCoordinateFromReportText(row.element ?? row.element_description ?? ""),
          location: markerPos,
          box_2d: row.box_2d,
          // T-079: accessibility findings don't carry layer_ids today.
          layer_ids: null,
          isGeneral: false,
          engineId: "accessibility",
          imageIndex,
          why_it_matters: "",
          suggestion: "",
        });
      });
      ov.forEach((row, idx) => {
        const markerPos = boxToMarkerPosition(row.box_2d);
        if (!markerPos) return;
        const imageIndex = (isFlowMode || isAutoMode || isPrototypeMode) && typeof row.image_index === "number" ? row.image_index : null;
        issues.push({
          id: `accessibility-other-${idx}`,
          markerIndex: localizedIndex++,
          issue: stripCoordinateFromReportText(row.issue),
          location: markerPos,
          box_2d: row.box_2d,
          layer_ids: null,
          isGeneral: false,
          engineId: "accessibility",
          imageIndex,
          why_it_matters: "",
          suggestion: row.suggestion,
        });
      });
    }

    // Append PC/CF findings for prototype mode (not in aiReport.engines)
    if (isPrototypeMode) {
      for (const [engineId, source] of [
        ["prototype_completeness", aiReport.prototype_completeness],
        ["cross_frame", aiReport.cross_frame],
      ] as [string, { findings?: Array<{ issue: string; why_it_matters: string; suggestion: string; image_index?: number | null; box_2d?: BoundingBox | null; layer_ids?: string[] | null }> } | null | undefined][]) {
        const findings = source?.findings ?? [];
        findings.forEach((finding, idx) => {
          // For prototype completeness/cross-frame findings, fallback to full-frame box when
          // image_index is present but no specific box was provided by the model.
          const fallbackBox: BoundingBox =
            finding.box_2d ??
            (typeof finding.image_index === "number" ? [0, 0, 1000, 1000] : null);
          const markerPos = boxToMarkerPosition(fallbackBox);
          const hasValidLocation = !!markerPos;
          const imageIndex = typeof finding.image_index === "number" ? finding.image_index : null;
          issues.push({
            id: `${engineId}-${idx}`,
            markerIndex: hasValidLocation ? localizedIndex++ : null,
            issue: stripCoordinateFromReportText(finding.issue),
            location: markerPos,
            box_2d: fallbackBox,
            layer_ids: Array.isArray(finding.layer_ids) ? finding.layer_ids : null,
            isGeneral: !hasValidLocation,
            engineId,
            imageIndex,
            why_it_matters: stripCoordinateFromReportText(finding.why_it_matters),
            suggestion: stripCoordinateFromReportText(finding.suggestion),
          });
        });
      }
    }

    // Spread out markers that would visually stack on top of an earlier marker
    // (same image, centers within COLLISION_THRESHOLD% on both axes). Tries the
    // original position first, then 8 compass directions; picks the first
    // non-colliding spot. Falls back to the original if all are taken.
    const COLLISION_THRESHOLD = 4;
    const COLLISION_STEP = 5;
    const clampPct = (n: number) => Math.max(5, Math.min(95, n));
    for (let i = 1; i < issues.length; i++) {
      const original = issues[i].location;
      if (!original) continue;
      const candidates = [
        original,
        ...Array.from({ length: 8 }, (_, step) => {
          const angle = step * (Math.PI / 4);
          return {
            x: clampPct(original.x + COLLISION_STEP * Math.cos(angle)),
            y: clampPct(original.y + COLLISION_STEP * Math.sin(angle)),
          };
        }),
      ];
      for (const candidate of candidates) {
        const collides = issues.slice(0, i).some((prev) =>
          prev.location &&
          prev.imageIndex === issues[i].imageIndex &&
          Math.abs(prev.location.x - candidate.x) < COLLISION_THRESHOLD &&
          Math.abs(prev.location.y - candidate.y) < COLLISION_THRESHOLD,
        );
        if (!collides) {
          issues[i] = { ...issues[i], location: candidate };
          break;
        }
      }
    }

    return {
      allIssues: issues,
      localizedIssues: issues.filter(i => !i.isGeneral),
      // Flow issues include imageIndex for carousel sync
      flowIssues: issues.map(i => ({
        id: i.id,
        markerIndex: i.markerIndex,
        issue: i.issue,
        location: i.location,
        isGeneral: i.isGeneral,
        engineId: i.engineId,
        imageIndex: i.imageIndex,
      })),
    };
  }, [aiReport.engines, aiReport.accessibility, aiReport.prototype_completeness, aiReport.cross_frame, isFlowMode, isAutoMode, isPrototypeMode]);

  /**
   * T-079: per-issue rectangle overlays for the SINGLE-screen renderer.
   *
   * Walks `localizedIssues` and tries `resolveLayerIds(issue.layer_ids, ...)`.
   * Falls back to nothing (so the existing center-marker continues to render
   * from `box_2d` via `MarkerOverlay`). Flow / prototype renderers use the
   * carousel + a separate path that we deliberately don't touch in this PR;
   * T-078 (grid overlay) handles those.
   */
  const singleScreenRectOverlays = useMemo<IssueRectOverlay[]>(() => {
    if (isFlowMode || isAutoMode || isPrototypeMode) return [];
    const nodeMap = Array.isArray(audit.node_maps) && audit.node_maps.length > 0
      ? audit.node_maps[0]
      : null;
    const exportScale = typeof audit.export_scale === "number" ? audit.export_scale : null;
    if (!nodeMap || !exportScale) return [];
    const overlays: IssueRectOverlay[] = [];
    for (const issue of localizedIssues) {
      const rect = resolveLayerIds(issue.layer_ids, nodeMap, exportScale);
      if (!rect) continue;
      overlays.push({ issueId: issue.id, rect });
    }
    return overlays;
  }, [audit.node_maps, audit.export_scale, isFlowMode, isAutoMode, isPrototypeMode, localizedIssues]);

  // Scroll to issue card when marker is clicked
  const handleMarkerClick = useCallback((issueId: string) => {
    // Switch to UX tab if currently on synth tab so the issue is visible
    setActiveTab("ux");

    // First expand the engine section (engineId for "accessibility-contrast-0" is "accessibility")
    const engineId = issueId.split("-")[0];
    setExpandedEngine(engineId);

    // In flow/prototype mode, if this issue has an imageIndex, navigate carousel/thumbnail to that step
    const issue = allIssues.find((i) => i.id === issueId);
    if (issue?.imageIndex != null) {
      if (isFlowMode) setCurrentFlowSlideIndex(issue.imageIndex);
      else if (isPrototypeMode) setSelectedThumbnailIndex(issue.imageIndex);
    }
    
    // Then scroll after a brief delay for the section to expand
    setTimeout(() => {
      const ref = issueRefs.current.get(issueId);
      if (ref) {
        ref.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // Trigger highlight animation
        setHighlightedIssueId(issueId);
        
        // Remove highlight after animation completes
        setTimeout(() => {
          setHighlightedIssueId(null);
        }, SCROLL_HIGHLIGHT_CLEAR_MS);
      }
    }, 150);
  }, [allIssues, isFlowMode, isPrototypeMode]);

  // Handle clicking on an issue card - navigate carousel/thumbnail to that image and highlight marker
  const handleIssueCardClick = useCallback((issueId: string) => {
    if (!isFlowMode && !isPrototypeMode) return;

    // Find the issue to get its imageIndex
    const issue = allIssues.find(i => i.id === issueId);
    if (!issue || issue.imageIndex === null || issue.imageIndex === undefined) return;

    // Navigate to the correct frame/slide
    if (isFlowMode) setCurrentFlowSlideIndex(issue.imageIndex);
    else if (isPrototypeMode) setSelectedThumbnailIndex(issue.imageIndex);

    // Highlight the marker on that frame
    setHighlightedIssueId(issueId);

    // Remove highlight after animation
    setTimeout(() => {
      setHighlightedIssueId(null);
    }, ISSUE_HIGHLIGHT_CLEAR_MS);
  }, [isFlowMode, isPrototypeMode, allIssues]);

  const handleExportPptx = useCallback(async (preset: ExportPreset) => {
    setExportingPdf(true);
    try {
      const fetchBlob = async (url: string): Promise<Blob | null> => {
        try {
          const resp = await fetch(url);
          if (!resp.ok) return null;
          return await resp.blob();
        } catch (e) {
          // Export proceeds with missing image rather than aborting — surface in dev console
          console.warn("[AuditDetail.exportPptx] failed to fetch image blob:", e);
          return null;
        }
      };

      // Resolve signed URLs
      let screenshotBlob: Blob | null = null;
      let flowImageBlobs: (Blob | null)[] = [];
      let contextImageBlobs: (Blob | null)[] = [];

      if ((isFlowMode || isPrototypeMode) && audit.flow_images && audit.flow_images.length > 0) {
        const signedUrls = await createScreenshotSignedUrls(audit.flow_images);
        flowImageBlobs = await Promise.all(signedUrls.map(fetchBlob));
      } else {
        const signedUrl = await createScreenshotSignedUrl(audit.screenshot_url);
        if (signedUrl) screenshotBlob = await fetchBlob(signedUrl);
      }

      if (audit.context_images && audit.context_images.length > 0) {
        const signedUrls = await createScreenshotSignedUrls(audit.context_images);
        contextImageBlobs = await Promise.all(signedUrls.map(fetchBlob));
      }

      const dateStr = formatDate(audit.created_at);
      const scoreDelta = previousAudit?.overall_score != null
        ? aiReport.score - previousAudit.overall_score
        : null;

      // Build localized issues for screenshot pin legend
      const mappedLocalizedIssues = localizedIssues.map(li => ({
        markerIndex: li.markerIndex,
        x: li.location.x,
        y: li.location.y,
        imageIndex: li.imageIndex ?? null,
        issue: li.issue,
        engineId: li.engineId,
      }));

      // For executive preset: call reframe-export to get AI-reframed content
      let executiveContent: ExecutiveReframedContent | null = null;
      if (preset === "executive") {
        try {
          const allFindings = [
            ...aiReport.engines.system_logic.map(f => ({ issue: f.issue, why_it_matters: f.why_it_matters, engine: "system_logic" })),
            ...aiReport.engines.heuristic.map(f => ({ issue: f.issue, why_it_matters: f.why_it_matters, engine: "heuristic" })),
            ...aiReport.engines.cognitive.map(f => ({ issue: f.issue, why_it_matters: f.why_it_matters, engine: "cognitive" })),
            ...aiReport.engines.interaction.map(f => ({ issue: f.issue, why_it_matters: f.why_it_matters, engine: "interaction" })),
          ];

          const accessibility = aiReport.accessibility;
          const accessibilitySummary = accessibility
            ? (() => {
                const cf = accessibility.contrast_failures?.length ?? 0;
                const ov = accessibility.other_violations?.length ?? 0;
                const lvl = accessibility.wcag_level;
                if (cf === 0 && ov === 0) return `WCAG ${lvl}: Passed`;
                if (cf > 0) return `WCAG ${lvl}: ${cf + ov} violation(s)`;
                return `WCAG ${lvl}: ${ov} issue(s) flagged — manual review needed`;
              })()
            : null;

          const { data, error } = await invokeReframeExport({
            audit_id: audit.id,
            score: aiReport.score,
            one_big_thing: aiReport.one_big_thing,
            findings: allFindings,
            accessibility_summary: accessibilitySummary,
            synth_summary: aiReport.synth_users?.critical_finding ?? null,
            language: projectContext.language ?? language,
          });
          if (error) {
            // Extract the actual response body from FunctionsHttpError
            const body = await (error as { context?: Response }).context?.text?.().catch(() => "") ?? "";
            console.error("[reframe-export] error:", error.message, "| body:", body.slice(0, 300));
          } else {
            executiveContent = data as ExecutiveReframedContent;
          }
        } catch (e) {
          console.error("[reframe-export] catch:", e);
        }
      }

      await exportAuditPptx({
        aiReport,
        projectContext,
        date: dateStr,
        isFlow: !!(isFlowMode || isPrototypeMode),
        isPrototype: !!isPrototypeMode,
        preset,
        screenGoal: audit.screen_context,
        reauditScoreDelta: scoreDelta,
        reauditExplanation: reAuditExplanation,
        screenshotBlob,
        flowImageBlobs,
        contextImageBlobs,
        localizedIssues: mappedLocalizedIssues,
        executiveContent,
        uiLang: language as "en" | "it",
      });

      setExportModalOpen(false);
    } catch (err) {
      console.error("PPTX export failed:", err);
      toast.error(t("exportReportTitle"), { description: "Could not generate the PPTX." });
    } finally {
      setExportingPdf(false);
    }
  }, [audit, aiReport, projectContext, isFlowMode, isPrototypeMode, localizedIssues, language, reAuditExplanation, previousAudit, t]);

  const handleExportAi = useCallback(() => {
    // screen_context sometimes holds a URL (Figma prototype URL for prototype/flow audits).
    // Never render a URL as "Screen goal" — only show it as prototypeUrl for prototype audits.
    const screenContextIsUrl = !!audit.screen_context && /^https?:\/\//.test(audit.screen_context);
    exportAuditAi({
      aiReport,
      projectContext,
      date: formatDate(audit.created_at),
      isFlow: !!isFlowMode,
      isPrototype: !!isPrototypeMode,
      screenCount: audit.flow_images?.length ?? 1,
      personas: audit.selected_personas ?? [],
      screenGoal: screenContextIsUrl ? null : audit.screen_context,
      prototypeUrl: (isPrototypeMode && screenContextIsUrl) ? audit.screen_context : null,
    });
  }, [audit, aiReport, projectContext, isFlowMode, isPrototypeMode]);

  const exportPrompt = `Fetch my Qualia audit ${audit.id} for ${projectContext.name}. Summarize the findings and ask me which screens or issues to focus on. Once I pick, load those screenshots — then use Qualia's suggestions from the audit (not your own analysis) to produce before/after visual fixes. Your job is to faithfully implement what Qualia already diagnosed. Do not add your own recommendations.`;
  const copyExportPrompt = () => {
    void navigator.clipboard.writeText(exportPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), PROMPT_COPIED_TOAST_MS);
  };

  const getScoreColor = scoreToTailwindColor;

  const getEngineStatus = (findings: Array<{ issue: string }>) => {
    if (findings.length === 0) return "good" as const;
    if (findings.length <= 2) return "warning" as const;
    return "critical" as const;
  };

  const getStatusBg = (status: "good" | "warning" | "critical") => {
    if (status === "good") return "bg-green-500/10 border-green-500/30";
    if (status === "warning") return "bg-amber-500/10 border-amber-500/30";
    return "bg-red-500/10 border-red-500/30";
  };

  // Get sub-scores from AI response, with fallback calculation
  const getSubScore = (engineId: string, findings: Array<{ issue: string }>) => {
    if (aiReport.sub_scores) {
      const scoreKey = `${engineId}_score` as keyof typeof aiReport.sub_scores;
      return aiReport.sub_scores[scoreKey] ?? 0;
    }
    // Fallback for legacy reports without sub_scores
    const baseScore = 100;
    const deduction = Math.min(findings.length * 10, 40);
    return Math.max(baseScore - deduction, 0);
  };

  const engines: Array<{ id: string; title: string; icon: React.ComponentType<{ className?: string }>; description: string; findings: Array<FlowIssueData> }> = [
    {
      id: "system_logic",
      title: isAutoMode ? "Product Logic" : isPrototypeMode ? "Flow Logic" : isFlowMode ? "Transition Logic" : "System Logic & Flow",
      icon: Workflow,
      description: isAutoMode ? "Navigation logic, dead ends, missing system feedback" : isPrototypeMode ? "Navigation structure, dead ends, frame-to-frame logic" : isFlowMode ? "Flow coherence, step transitions, logical progression" : "Architecture, logical sequence, state consistency",
      findings: aiReport.engines.system_logic || [],
    },
    {
      id: "heuristic",
      title: isAutoMode ? "Consistency & Navigation" : isPrototypeMode ? "Visual Consistency" : isFlowMode ? "Context Continuity" : "Heuristic & Navigation",
      icon: Compass,
      description: isAutoMode ? "Cross-screen consistency, wayfinding, microcopy quality" : isPrototypeMode ? "Cross-frame consistency, wayfinding, microcopy quality" : isFlowMode ? "Information preservation, consistent navigation" : "Nielsen's heuristics, wayfinding, mental models",
      findings: aiReport.engines.heuristic || [],
    },
    {
      id: "cognitive",
      title: isAutoMode ? "Cognitive Load" : isPrototypeMode ? "Cognitive Load" : isFlowMode ? "Cognitive Flow" : "Cognitive & Visual",
      icon: Eye,
      description: isAutoMode ? "Decision architecture, visual hierarchy, 3-second scan" : isPrototypeMode ? "Decision architecture, visual hierarchy, 3-second scan" : isFlowMode ? "Mental load distribution, complexity balance" : "Visual hierarchy, cognitive load",
      findings: aiReport.engines.cognitive || [],
    },
    {
      id: "interaction",
      title: "Interaction Cost",
      icon: MousePointer2,
      description: isAutoMode ? "False affordances, missing states, interaction friction" : isPrototypeMode ? "False affordances, missing shown states, interaction friction" : isFlowMode ? "Unnecessary steps, consolidation opportunities" : "Fitts's Law, click depth, input friction",
      findings: aiReport.engines.interaction || [],
    },
  ];

  if (isPrototypeMode && aiReport.prototype_completeness?.findings?.length) {
    engines.push({
      id: "prototype_completeness",
      title: "Prototype Completeness",
      icon: GitBranch,
      description: "Flow coverage, dead ends, and missing user journeys",
      findings: aiReport.prototype_completeness.findings as Array<FlowIssueData>,
    });
  }
  if (isPrototypeMode && aiReport.cross_frame?.findings?.length) {
    engines.push({
      id: "cross_frame",
      title: "Frame Coherence",
      icon: Layers,
      description: "Cross-frame consistency, transitions, and peak-end evaluation",
      findings: aiReport.cross_frame.findings as Array<FlowIssueData>,
    });
  }

  const toggleEngine = (id: string) => {
    setExpandedEngine(expandedEngine === id ? null : id);
  };

  // Compute re-audit improvement
  const reAuditDelta = useMemo(() => {
    if (!previousAudit) return null;
    const prevScore = previousAudit.overall_score ?? previousAudit.ai_report?.score ?? null;
    const currScore = aiReport.score;
    if (prevScore === null) return { prevScore: null, currScore, delta: null };
    return { prevScore, currScore, delta: currScore - prevScore };
  }, [previousAudit, aiReport.score]);

  const isFeedbackOnlyReaudit = useMemo(() => {
    if (!previousAudit || audit.follow_up_audit_id !== previousAudit.id) return false;
    const currPath = audit.screenshot_storage_path ?? (audit.screenshot_url?.startsWith("http") ? null : audit.screenshot_url);
    if (currPath && previousAudit.screenshot_url) return currPath === previousAudit.screenshot_url;
    const aFlow = audit.flow_images ?? [];
    const pFlow = previousAudit.flow_images ?? [];
    return aFlow.length > 0 && pFlow.length > 0 && aFlow.length === pFlow.length && aFlow[0] === pFlow[0];
  }, [audit.follow_up_audit_id, audit.screenshot_url, audit.screenshot_storage_path, audit.flow_images, previousAudit]);

  // Fetch AI response to designer feedback (re-audit with feedback only)
  useEffect(() => {
    if (!isFeedbackOnlyReaudit || !session?.access_token) return;
    if (audit.reaudit_explanation) return;

    let cancelled = false;
    setReAuditExplanationLoading(true);

    const fetchFeedbackResponse = async () => {
      try {
        const resp = await fetch(GENERATE_FEEDBACK_RESPONSE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ auditId: audit.id, language }),
        });
        if (!resp.ok) throw new Error("fetch failed");
        const data = await resp.json();
        const clean = sanitizeExplanation(data.explanation ?? "");
        if (!cancelled && clean) {
          setReAuditExplanation(clean);
          await updateAuditReauditExplanation(audit.id, clean);
          void queryClient.invalidateQueries({ queryKey: queryKeys.audits(projectId) });
        }
      } catch (e) {
        // Background fetch — UI falls back to no explanation. Surface in dev console.
        console.warn("[AuditDetail.fetchFeedbackResponse] background fetch failed:", e);
      } finally {
        if (!cancelled) setReAuditExplanationLoading(false);
      }
    };

    void fetchFeedbackResponse();
    return () => { cancelled = true; };
  }, [isFeedbackOnlyReaudit, session?.access_token, audit.id, audit.reaudit_explanation, language, projectId, queryClient]);

  // Fetch AI explanation for score delta (re-audit after mockup changes)
  useEffect(() => {
    if (isFeedbackOnlyReaudit || !reAuditDelta || reAuditDelta.delta === null || !session?.access_token) return;
    if (audit.reaudit_explanation) return;

    let cancelled = false;
    setReAuditExplanationLoading(true);

    const fetchExplanation = async () => {
      try {
        const resp = await fetch(EXPLAIN_REAUDIT_DELTA_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            previousScore: reAuditDelta.prevScore,
            currentScore: reAuditDelta.currScore,
            delta: reAuditDelta.delta,
            previousSummary: previousAudit?.ai_report?.one_big_thing ?? undefined,
            currentSummary: aiReport.one_big_thing ?? undefined,
            language,
          }),
        });
        if (!resp.ok) throw new Error("fetch failed");
        const data = await resp.json();
        const clean = sanitizeExplanation(data.explanation ?? "");
        if (!cancelled && clean) {
          setReAuditExplanation(clean);
          await updateAuditReauditExplanation(audit.id, clean);
          void queryClient.invalidateQueries({ queryKey: queryKeys.audits(projectId) });
        }
      } catch (e) {
        // Background fetch — explanation is secondary. Surface in dev console.
        console.warn("[AuditDetail.fetchExplanation] background fetch failed:", e);
      } finally {
        if (!cancelled) setReAuditExplanationLoading(false);
      }
    };

    void fetchExplanation();
    return () => { cancelled = true; };
  }, [isFeedbackOnlyReaudit, reAuditDelta, session?.access_token, previousAudit, aiReport.one_big_thing, language, audit.id, audit.reaudit_explanation, projectId, queryClient]);

  const previousReportEngines = (previousAudit as { ai_report?: { engines?: Record<string, Array<{ issue?: string }>> } } | null)?.ai_report?.engines;

  const getStanceLabel = (stance: string) => {
    switch (stance) {
      case "agree": return t("issueFeedbackStanceAgree");
      case "disagree": return t("issueFeedbackStanceDisagree");
      case "already_fixed": return t("issueFeedbackStanceAlreadyFixed");
      case "not_relevant": return t("issueFeedbackStanceNotRelevant");
      default: return stance;
    }
  };

  // Inline JSX so parent re-renders (e.g. on feedback draft keystroke) don't remount and reset scroll
  const analysisContent = (
    <div className="space-y-6">
      {/* T-077: non-Gemini providers don't get visual highlights yet (grid-overlay
          technique pending). Banner sets expectations; pins are Gemini-only for now. */}
      {!isPinProvider && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-foreground/80">
          <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
          <span>{t("nonGeminiPinBanner")}</span>
        </div>
      )}
      {/* Your previous feedback (re-audit only): collapsible */}
      {reAuditDelta && previousFeedbackList.length > 0 && (
        <div className="glass rounded-xl border border-border overflow-hidden">
          {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: full-width px-4 py-3 collapsible section header with text+chevron nested label+count children; Button primitive (h-10 rounded-md) would conflict */}
          <button
            type="button"
            onClick={() => setPreviousFeedbackExpanded((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-surface-1/50 transition-colors"
          >
            <span className="text-sm font-medium text-foreground">{t("previousFeedbackTitle")}</span>
            <span className="text-xs text-muted-foreground shrink-0 min-w-0 truncate">
              {previousFeedbackList.length === 1
                ? t("previousFeedbackSummaryOne")
                : t("previousFeedbackSummary").replace("{count}", String(previousFeedbackList.length))}
            </span>
            <span className="text-xs text-primary font-medium shrink-0 flex items-center gap-1">
              {previousFeedbackExpanded ? t("previousFeedbackHide") : t("previousFeedbackShow")}
              {previousFeedbackExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </span>
          </button>
          {previousFeedbackExpanded && (
            <div className="px-4 pb-4 pt-0 space-y-2 border-t border-border/50">
              {previousFeedbackList.map((row) => {
                const finding = previousReportEngines?.[row.engine_id]?.[row.issue_index];
                const rawIssue = finding?.issue ? stripCoordinateFromReportText(finding.issue) : "";
                return (
                  <div
                    key={`${row.engine_id}-${row.issue_index}`}
                    className="text-xs rounded-md bg-muted/40 border border-border/50 px-3 py-2 space-y-0.5"
                  >
                    {rawIssue && <p className="text-muted-foreground whitespace-pre-wrap break-words">{rawIssue}</p>}
                    <p className="font-medium text-foreground">
                      {getStanceLabel(row.stance)}
                      {row.reason?.trim() && (
                        <span className="font-normal text-muted-foreground"> — {row.reason.trim()}</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Parent audit: link to its latest re-audit */}
      {latestReaudit && onOpenAuditId && !audit.follow_up_audit_id && (
        <div className="glass rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm font-medium text-foreground flex-1 min-w-0">{t("reAuditLabel")}</p>
            <button
              type="button"
              onClick={() => onOpenAuditId(latestReaudit.id)}
              className="text-xs text-primary font-medium underline-offset-2 hover:underline shrink-0"
            >
              {t("viewLatestReaudit")}
            </button>
          </div>
        </div>
      )}

      {/* Re-audit: feedback-only → AI response to feedback; after mockup changes → score delta + explanation */}
      {isFeedbackOnlyReaudit && (
        <div className="glass rounded-xl p-4 border border-border space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <RefreshCw className="h-5 w-5 text-primary shrink-0" />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
              <p className="text-sm font-medium text-foreground">{t("reauditResponseToFeedbackTitle")}</p>
              {reAuditDelta && reAuditDelta.delta !== null && (
                <span className="text-sm text-muted-foreground">
                  · {t("reAuditPrevious")}: {reAuditDelta.prevScore} → {t("reAuditNow")}: {reAuditDelta.currScore}
                  {" "}
                  <span className={reAuditDelta.delta >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                    ({reAuditDelta.delta > 0 ? "+" : ""}{reAuditDelta.delta})
                  </span>
                </span>
              )}
            </div>
            {previousAudit && onOpenAuditId && (
              <button
                type="button"
                onClick={() => onOpenAuditId(previousAudit.id)}
                className="text-xs text-primary font-medium underline-offset-2 hover:underline ml-auto shrink-0"
              >
                {t("viewPreviousAudit")}
              </button>
            )}
          </div>
          <div className="pl-8">
            {reAuditExplanationLoading ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("reauditResponseToFeedbackLoading")}
              </p>
            ) : reAuditExplanation ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {reAuditExplanation}
              </p>
            ) : null}
          </div>
        </div>
      )}
      {reAuditDelta && !isFeedbackOnlyReaudit && (
        <div className="glass rounded-xl p-4 border border-border space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {reAuditDelta.delta !== null ? (
              <>
                {reAuditDelta.delta >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-400 shrink-0" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-400 shrink-0" />
                )}
                <p className="text-sm text-muted-foreground min-w-0">
                  <span className="font-medium text-foreground">{t("reAuditLabel")}</span>
                  {" · "}
                  {t("reAuditPrevious")}: {reAuditDelta.prevScore} → {t("reAuditNow")}: {reAuditDelta.currScore}
                  {" "}
                  <span className={reAuditDelta.delta >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                    ({reAuditDelta.delta > 0 ? "+" : ""}{reAuditDelta.delta})
                  </span>
                </p>
              </>
            ) : (
              <>
                <RefreshCw className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{t("reAuditLabel")}</span>
                </p>
              </>
            )}
            {previousAudit && onOpenAuditId && (
              <button
                type="button"
                onClick={() => onOpenAuditId(previousAudit.id)}
                className="text-xs text-primary font-medium underline-offset-2 hover:underline ml-auto shrink-0"
              >
                {t("viewPreviousAudit")}
              </button>
            )}
          </div>
          {reAuditDelta.delta !== null && (
            <div className="pl-8">
              {reAuditExplanationLoading ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("reAuditExplanationLoading")}
                </p>
              ) : reAuditExplanation ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {reAuditExplanation}
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      <UserDataNudge userData={audit.user_data} />
      <ContextDocNudge projectId={projectId} />

      {/* Overall Score - ScoreCard */}
      <div className="glass rounded-xl p-6 glow-border">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* ScoreCard Component */}
          <ScoreCard score={aiReport.score} />
          
          {/* Mini engine scores */}
          <div className="flex-1 w-full">
            <p className="text-xs text-muted-foreground text-center mb-2">
              Score = Average of 4 dimensions
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {engines.map((engine) => {
                const score = getSubScore(engine.id, engine.findings);
                return (
                  <div key={engine.id} className="text-center p-3 rounded-lg bg-surface-1/50 border border-border/30">
                    <engine.icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <div className={`text-lg font-bold ${getScoreColor(score)}`}>
                      {score}
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-tight">
                      {engine.title.split(" ")[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* One Big Thing - High Leverage Change */}
      <div className="glass rounded-xl p-6 border-2 border-primary/30 glow-purple">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Lightbulb className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold">One Big Thing</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-foreground">
                {isAutoMode ? "Biggest Systemic Issue" : isPrototypeMode ? "Critical Design Gap" : isFlowMode ? "Biggest Friction Point" : "High Leverage Change"}
              </span>
            </div>
            <p className="text-muted-foreground">
              {stripCoordinateFromReportText(aiReport.one_big_thing)}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Analysis Engines */}
      <div className="space-y-4" data-tour="issue-feedback">
        <p className="text-xs text-muted-foreground rounded-lg bg-muted/30 border border-border/50 px-3 py-2">
          {t("issueFeedbackReauditNote")}
        </p>
        <h2 className="text-lg font-semibold">Detailed Breakdown</h2>

        {engines.map((engine) => {
          const status = getEngineStatus(engine.findings);
          const engineScore = getSubScore(engine.id, engine.findings);
          
          return (
            <div
              key={engine.id}
              className={`glass rounded-xl overflow-hidden border transition-all ${getStatusBg(status)}`}
            >
              {/* eslint-disable-next-line react/forbid-elements, jsx-a11y/control-has-associated-label -- DS-PRIMITIVE-001 + accessible name: nested <h3>{engine.title}</h3> + score readout provides the name; jsx-a11y can't trace dynamic text through engine.title */}
              <button
                onClick={() => toggleEngine(engine.id)}
                aria-expanded={expandedEngine === engine.id}
                className="w-full p-5 flex items-center gap-4 text-left hover:bg-surface-1/50 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    status === "good"
                      ? "bg-green-500/20"
                      : status === "warning"
                      ? "bg-amber-500/20"
                      : "bg-red-500/20"
                  }`}
                >
                  <engine.icon
                    className={`h-5 w-5 ${
                      status === "good"
                        ? "text-green-400"
                        : status === "warning"
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{engine.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {engine.description}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`text-2xl font-bold ${getScoreColor(engineScore)}`}>
                    {engineScore}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {engine.findings.length} {engine.findings.length === 1 ? "issue" : "issues"}
                    </span>
                    {expandedEngine === engine.id ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </button>

              {expandedEngine === engine.id && engine.findings.length > 0 && (
                <div className="px-5 pb-5 space-y-3 border-t border-border/50 pt-4">
                  {engine.findings.map((finding, idx) => {
                    const issueId = `${engine.id}-${idx}`;
                    const issueData = allIssues.find((i) => i.id === issueId);
                    const isHovered = hoveredIssueId === issueId;
                    
                    
                    const isHighlighted = highlightedIssueId === issueId;
                    const isGeneral = issueData?.isGeneral ?? true;
                    const markerIndex = typeof issueData?.markerIndex === "number" ? issueData.markerIndex : null;
                    
                    // Get imageIndex for flow mode navigation
                    const imageIndex = issueData?.imageIndex;
                    const hasImageIndex = (isFlowMode || isPrototypeMode) && typeof imageIndex === "number";

                    return (
                      <div
                        key={idx}
                        id={`issue-${markerIndex ?? `general-${idx}`}`}
                        ref={(el) => {
                          if (el) issueRefs.current.set(issueId, el);
                          else issueRefs.current.delete(issueId);
                        }}
                        className={cn(
                          "p-4 rounded-lg bg-surface-1/50 transition-all duration-200",
                          isHovered && !isGeneral && "ring-2 ring-primary/50 bg-primary/10",
                          isHighlighted && "animate-highlight-pulse ring-2 ring-primary bg-primary/20"
                        )}
                      >
                        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- interactiveProps spread below conditionally adds role/tabIndex/onClick/onKeyDown only when !isGeneral; jsx-a11y can't statically resolve the spread */}
                        <div className="flex gap-3 items-start">
                        <div
                          className={cn(
                            "flex items-start gap-3 flex-1 min-w-0",
                            !isGeneral && "cursor-pointer hover:bg-surface-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          )}
                          onMouseEnter={() => !isGeneral && setHoveredIssueId(issueId)}
                          onMouseLeave={() => setHoveredIssueId(null)}
                          {...(!isGeneral
                            ? {
                                role: "button" as const,
                                tabIndex: 0,
                                onClick: () => handleIssueCardClick(issueId),
                                onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleIssueCardClick(issueId);
                                  }
                                },
                              }
                            : {})}
                        >
                          {/* Numbered badge for localized issues, lightbulb for general tips */}
                          {!isGeneral && markerIndex !== null ? (
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ backgroundColor: getMarkerColor(markerIndex) }}
                            >
                              {markerIndex + 1}
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-amber-500/20 shrink-0">
                              <span className="text-sm">💡</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {/* Frame indicator for flow/prototype mode */}
                            {hasImageIndex && (
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-foreground font-medium">
                                  {isPrototypeMode ? `Screen ${imageIndex + 1}` : `Step ${imageIndex + 1}`}
                                </span>
                                <span className="text-[10px] text-muted-foreground">Click to view</span>
                              </div>
                            )}
                            {/* Issue title — same layout for single and flow (title only; no Trigger/Psychology/Risk) */}
                            <p className="font-semibold text-sm text-foreground mb-3 leading-relaxed whitespace-pre-line">
                              {stripCoordinateFromReportText(finding.issue)}
                            </p>
                            {/* UX principle: always-visible pill + description */}
                            {finding.principle && finding.principle.trim() && (() => {
                              const tag = finding.principle.trim();
                              const description = getPrincipleDescription(tag);
                              return (
                                <div className="mb-3 min-w-0">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary/90 bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1.5 break-words">
                                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
                                    <span>{tag}</span>
                                  </span>
                                  {description != null && (
                                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-2">
                                      {description}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                            {/* Why it matters */}
                            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                              <span className="font-medium text-amber-400">Why it matters:</span>{" "}
                              {stripCoordinateFromReportText(finding.why_it_matters)}
                            </p>
                            
                            {/* Suggestion box: foreground text for accessibility; primary icon + border for brand */}
                            <div className="flex items-start gap-2.5 bg-primary/10 rounded-lg p-3 border border-primary/20">
                              <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
                              <p className="text-sm text-foreground/85 leading-relaxed">
                                {stripCoordinateFromReportText(finding.suggestion)}
                              </p>
                            </div>
                          </div>
                        </div>
                        {/* T-077 deferred: grid-overlay-based highlight for non-Gemini. */}
                        </div>
                        {/* Per-issue reply: auto-saves on stance change and reason blur */}
                        <IssueReplyBlock
                          displayStance={
                            feedbackDraft[issueId]?.stance ?? issueFeedbackByKey.get(issueId)?.stance ?? null
                          }
                          displayReason={
                            feedbackDraft[issueId]?.reason ?? issueFeedbackByKey.get(issueId)?.reason ?? ""
                          }
                          onStanceChange={(stance, currentReason) => {
                            setFeedbackDraft((prev) => ({
                              ...prev,
                              [issueId]: { ...prev[issueId], stance, reason: currentReason ?? prev[issueId]?.reason ?? null },
                            }));
                            upsertIssueFeedback.mutate({
                              auditId: audit.id,
                              engineId: engine.id,
                              issueIndex: idx,
                              stance,
                              reason: currentReason ?? undefined,
                            });
                          }}
                          onReasonChange={(reason) =>
                            setFeedbackDraft((prev) => ({
                              ...prev,
                              [issueId]: {
                                ...prev[issueId],
                                stance: prev[issueId]?.stance ?? null,
                                reason: reason || null,
                              },
                            }))
                          }
                          onReasonBlur={(trimmedReason) => {
                            const stance =
                              feedbackDraft[issueId]?.stance ?? issueFeedbackByKey.get(issueId)?.stance ?? null;
                            if (stance) {
                              upsertIssueFeedback.mutate({
                                auditId: audit.id,
                                engineId: engine.id,
                                issueIndex: idx,
                                stance,
                                reason: trimmedReason ?? undefined,
                              });
                            }
                          }}
                          t={t}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {expandedEngine === engine.id && engine.findings.length === 0 && (
                <div className="px-5 pb-5 border-t border-border/50 pt-4">
                  <p className="text-sm text-green-400 text-center py-4">
                    ✓ No issues found in this category
                  </p>
                </div>
              )}
            </div>
          );
        })}



        {/* Session Insights — auto-crawl only */}
        {/* Prototype Completeness — prototype mode only */}
        {isPrototypeMode && aiReport.prototype_completeness?.dead_ends && !aiReport.prototype_completeness.findings?.length && (() => {
          const pc = aiReport.prototype_completeness!;
          const fields = [
            { label: "Dead Ends", value: pc.dead_ends },
            { label: "Orphan Screens", value: pc.orphan_screens },
            { label: "Missing Flows", value: pc.missing_flows },
            { label: "Coverage", value: pc.coverage_assessment },
          ];
          return (
            <div className="glass rounded-xl border border-border overflow-hidden">
              {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: full-width px-5 py-4 collapsible Prototype Completeness section with icon+heading+desc; Button primitive (h-10 rounded-md) would conflict */}
              <button
                type="button"
                onClick={() => toggleEngine("prototype_completeness")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-1/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Workflow className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Prototype Completeness</p>
                    <p className="text-xs text-muted-foreground">Flow coverage, dead ends, and missing journeys</p>
                  </div>
                </div>
                {expandedEngine === "prototype_completeness" ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {expandedEngine === "prototype_completeness" && (
                <div className="border-t border-border/50 divide-y divide-border/30">
                  {fields.map(({ label, value }) => (
                    <div key={label} className="px-5 py-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
                      <p className="text-sm text-foreground/90 leading-relaxed">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Frame Coherence — prototype mode only */}
        {isPrototypeMode && (aiReport.cross_frame?.transitions ?? aiReport.cross_session) && !aiReport.cross_frame?.findings?.length && (() => {
          const cf = (aiReport.cross_frame ?? aiReport.cross_session)!;
          const fields = [
            { label: "Transitions", value: cf.transitions },
            { label: "Consistency", value: cf.consistency },
            { label: "Missing Flows", value: cf.missing_states },
            { label: "Peak & End", value: cf.peak_end },
          ];
          return (
            <div className="glass rounded-xl border border-border overflow-hidden">
              {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: full-width px-5 py-4 collapsible Frame Coherence section with icon+heading+desc; Button primitive (h-10 rounded-md) would conflict */}
              <button
                type="button"
                onClick={() => toggleEngine("cross_frame")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-1/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Workflow className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Frame Coherence</p>
                    <p className="text-xs text-muted-foreground">Cross-frame patterns and consistency evaluation</p>
                  </div>
                </div>
                {expandedEngine === "cross_frame" ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {expandedEngine === "cross_frame" && (
                <div className="border-t border-border/50 divide-y divide-border/30">
                  {fields.map(({ label, value }) => (
                    <div key={label} className="px-5 py-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
                      <p className="text-sm text-foreground/90 leading-relaxed">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Session Insights — auto mode only */}
        {isAutoMode && aiReport.cross_session && (() => {
          const cs = aiReport.cross_session;
          const fields = [
            { label: "Transitions", value: cs.transitions },
            { label: "Consistency", value: cs.consistency },
            { label: "Missing States", value: cs.missing_states },
            { label: "Peak & End", value: cs.peak_end },
          ];
          return (
            <div className="glass rounded-xl border border-border overflow-hidden">
              {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: full-width px-5 py-4 collapsible Session Insights section with icon+heading+desc; Button primitive (h-10 rounded-md) would conflict */}
              <button
                type="button"
                onClick={() => toggleEngine("cross_session")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-1/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Workflow className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Session Insights</p>
                    <p className="text-xs text-muted-foreground">Cross-screen patterns and flow evaluation</p>
                  </div>
                </div>
                {expandedEngine === "cross_session" ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {expandedEngine === "cross_session" && (
                <div className="border-t border-border/50 divide-y divide-border/30">
                  {fields.map(({ label, value }) => (
                    <div key={label} className="px-5 py-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
                      <p className="text-sm text-foreground/90 leading-relaxed">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {aiReport.accessibility ? (
          <AccessibilityCard
            accessibility={aiReport.accessibility}
            expanded={expandedEngine === "accessibility"}
            onToggle={() => toggleEngine("accessibility")}
            registerIssueRef={(id, el) => {
              if (el) issueRefs.current.set(id, el);
              else issueRefs.current.delete(id);
            }}
            onViolationClick={handleIssueCardClick}
            violationMarkers={new Map(
              allIssues
                .filter(i => i.id.startsWith("accessibility-") && i.markerIndex !== null)
                .map(i => [i.id, i.markerIndex as number])
            )}
          />
        ) : (
          <div
            className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 flex items-center gap-4"
            style={{ borderLeftWidth: 4, borderLeftColor: "hsl(var(--muted-foreground))" }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[hsl(var(--surface-2))]">
              <ShieldCheck className="h-5 w-5 text-[hsl(var(--muted-foreground))]" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">Accessibility</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                No data for this audit. Run a new audit to see WCAG 2.1 AA results.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  return (
    <>
      {/* Happy path bridge */}
      <TourBridge
        bridgeName="after_results"
        targetSelector='[data-tour="export-button"]'
        label="Export your findings to share with your team"
        position="bottom"
      />
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <LogoIcon className="h-6 w-6" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold">
                    {isAutoMode ? "Auto-Audit Report" : isPrototypeMode ? "Prototype Report" : isFlowMode ? "Flow Analysis Report" : "Audit Report"}
                  </h1>
                  {aiReport?.deep_figma_ui && (
                    // q-disable-next-line DS-COLOR-001 (intentional brand violet for premium "Deep Figma UI Analysis" badge — distinguishes paid feature, not a semantic state)
                    // eslint-disable-next-line qualia-compliance/ds-color-001-no-raw-palette -- intentional premium badge: violet distinguishes paid Deep Figma UI Analysis feature
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-violet-500/10 border border-violet-500/30 text-violet-200">
                      Deep Figma UI Analysis
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(audit.created_at)}
                  {isAutoMode && ` • ${audit.flow_images?.length ?? 0} screens`}
                  {isPrototypeMode && ` • ${audit.flow_images?.length ?? 0} frames`}
                  {isFlowMode && ` • ${audit.flow_images?.length} steps`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={exportingPdf}
                    data-tour="export-button"
                  >
                    {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Export
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setExportModalOpen(true)}>
                    <Download className="h-4 w-4 mr-2 opacity-60" />
                    Export PPTX
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportAi}>
                    <Download className="h-4 w-4 mr-2 opacity-60" />
                    Export Markdown
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setClaudeDialogOpen(true)}>
                    <span className="mr-2 text-sm leading-none">✨</span>
                    Export to Claude
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Dialog open={claudeDialogOpen} onOpenChange={setClaudeDialogOpen}>
                <DialogContent className="w-80 p-4 flex flex-col gap-3">
                  <DialogHeader className="gap-0.5">
                    <DialogTitle className="text-sm font-medium">Export to Claude</DialogTitle>
                    <DialogDescription className="text-xs">
                      Copy the prompt below and paste it in Claude. It will use the Qualia MCP to fetch your audit data automatically.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="relative bg-muted rounded-lg p-3 pr-8">
                    <p className="text-xs italic text-foreground leading-relaxed">"{exportPrompt}"</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1.5 right-1.5 h-6 w-6"
                      onClick={copyExportPrompt}
                      aria-label={promptCopied ? "Copied" : "Copy prompt"}
                    >
                      {promptCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" size="sm" onClick={copyExportPrompt}>
                      {promptCopied ? "Copied!" : "Copy prompt"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => window.open("https://claude.ai", "_blank")}
                    >
                      Open Claude
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                  {!mcpConnected && (
                    <div className="flex items-start gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg p-2.5 text-xs">
                      <span className="shrink-0 mt-0.5">⚠️</span>
                      <span>
                        Qualia MCP not set up in Claude yet.{" "}
                        <button className="underline font-medium" onClick={() => setMcpSetupOpen(true)}>
                          See how →
                        </button>
                      </span>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <McpSetupModal open={mcpSetupOpen} onOpenChange={setMcpSetupOpen} />
              {onReAuditRequest && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onReAuditRequest();
                      onClose();
                    }}
                    className="gap-2"
                    data-tour="reaudit-button"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t("reAuditButton")}
                  </Button>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-surface-2"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="mb-6">
            <AuditProvenanceRow auditId={audit.id} />
          </div>

          {/* CTA C: one-time nudge after auditing via Figma URL from web app */}
          {showPluginCTA && (
            <PluginCTABanner
              variant="inline"
              storageKey="plugin_cta_audit_result_dismissed"
              className="mb-4"
            />
          )}

          {/* Layout depends on mode */}
          {(isAutoMode || isPrototypeMode) ? (
            /* AUTO-CRAWL / PROTOTYPE MODE: 2-Column — Thumbnail strip left, tabbed analysis right */
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Left — Thumbnail strip + context */}
              <div className="lg:col-span-2">
                <div className="lg:sticky lg:top-8 space-y-4 h-fit">
                  <AutoCrawlThumbnailStrip
                    images={audit.flow_images ?? []}
                    issues={flowIssues}
                    selectedIndex={selectedThumbnailIndex}
                    onSelectImage={setSelectedThumbnailIndex}
                    hoveredIssueId={hoveredIssueId}
                    highlightedIssueId={highlightedIssueId}
                    onMarkerClick={handleMarkerClick}
                    isExpired={isScreenshotExpired(audit.created_at)}
                    expiredTitle={t("screenshotExpiredTitle")}
                    expiredTooltip={t("screenshotExpiredTooltip")}
                  />
                  <AuditContextCard
                    screenGoal={audit.screen_context || null}
                    isFlowAudit={!isPrototypeMode}
                    isPrototypeMode={isPrototypeMode}
                    userData={audit.user_data ?? null}
                    mission={projectContext.mission}
                    personas={personas}
                    selectedPersonaNames={audit.selected_personas?.map(p => p.name)}
                    constraints={projectContext.constraints}
                    contextImages={null}
                  />
                </div>
              </div>

              {/* Right — Tabs: UX Analysis | Design System */}
              <div className="lg:col-span-3 space-y-6" data-tour="feedback-sidebar">
                {/* Add Synth Card — shown only when synth not yet run/pending */}
                {isPrototypeMode && !aiReport.synth_users && !isSynthPending && onRunSynth && (
                  <AddSynthCard
                    onRun={async (personaIds) => {
                      setSynthRetryIds(personaIds);
                      setActiveTab("synth");
                      await onRunSynth(personaIds);
                    }}
                    isRetry={synthRetryIds !== null}
                    initialPersonaIds={synthRetryIds ?? []}
                  />
                )}

                {/* Tab bar: 2 tabs (UX | DS) by default, 3 tabs when synth in play */}
                <div className="flex gap-1 p-1 rounded-lg bg-surface-1 border border-border w-full">
                  <button
                    onClick={() => setActiveTab("ux")}
                    className={cn(
                      "flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors text-center",
                      activeTab === "ux"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    UX Analysis
                  </button>
                  <button
                    onClick={() => setActiveTab("design_system")}
                    className={cn(
                      "flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors text-center",
                      activeTab === "design_system"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Design System
                  </button>
                  {(aiReport.synth_users || isSynthPending) && (
                    <button
                      onClick={() => setActiveTab("synth")}
                      className={cn(
                        "flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors text-center relative",
                        activeTab === "synth"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t("synthUserSectionTitle")}
                      {isSynthPending && !aiReport.synth_users && (
                        <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </button>
                  )}
                </div>

                {aiReport.synth_inherited && activeTab === "synth" && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-1 border border-border/50 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    {t("synthInheritedChip")}
                  </div>
                )}

                {activeTab === "ux" && analysisContent}

                {activeTab === "design_system" && aiReport.design_system && (
                  <AutoCrawlDesignSystem designSystem={aiReport.design_system} />
                )}
                {activeTab === "design_system" && !aiReport.design_system && (
                  <div className="glass rounded-xl border border-border px-6 py-10 text-center text-sm text-muted-foreground">
                    Design system analysis not available for this report.
                  </div>
                )}

                {activeTab === "synth" && isSynthPending && !aiReport.synth_users && (
                  <div className="glass rounded-xl overflow-hidden">
                    <div className="h-1 w-full bg-surface-1 overflow-hidden">
                      <div className="h-full w-2/3 bg-primary animate-pulse rounded-full" />
                    </div>
                    <div role="status" aria-live="polite" aria-busy="true" className="px-6 py-8 flex flex-col items-center gap-4 text-center">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-primary animate-spin" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Simulating user archetypes…</p>
                        <p className="text-xs text-muted-foreground">Synth User Research is being generated in the background. This usually takes 20–40 seconds.</p>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === "synth" && aiReport.synth_users && (
                  <SynthUserSection synthUsers={aiReport.synth_users} />
                )}

                {activeTab === "ux" && (
                  <FeedbackCard
                    auditId={audit.id}
                    feedbackRating={feedbackRating}
                    setFeedbackRating={setFeedbackRating}
                    feedbackComment={feedbackComment}
                    setFeedbackComment={setFeedbackComment}
                    feedbackSubmitted={feedbackSubmitted}
                    setFeedbackSubmitted={setFeedbackSubmitted}
                    updateFeedback={updateFeedback}
                  />
                )}
              </div>
            </div>
          ) : isFlowMode ? (
            /* FLOW MODE: 2-Column Layout with Carousel */
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Left Column - Carousel & Context (Sticky Wrapper) */}
              <div className="lg:col-span-2">
                <div className="lg:sticky lg:top-8 space-y-6 h-fit">
                  {/* Flow Image Carousel with Markers */}
                  <div data-tour="analyzed-image">
                    <FlowImageCarousel
                      images={audit.flow_images!}
                      projectName={projectContext.name}
                      issues={flowIssues}
                      currentSlideIndex={currentFlowSlideIndex}
                      onSlideChange={setCurrentFlowSlideIndex}
                      hoveredIssueId={hoveredIssueId}
                      onMarkerHover={setHoveredIssueId}
                      onMarkerClick={handleMarkerClick}
                      highlightedIssueId={highlightedIssueId}
                      isExpired={isScreenshotExpired(audit.created_at)}
                      expiredTitle={t("screenshotExpiredTitle")}
                      expiredTooltip={t("screenshotExpiredTooltip")}
                    />
                  </div>
                  
                  {/* Context Card */}
                  <AuditContextCard
                    screenGoal={audit.screen_context || null}
                    isFlowAudit={isFlowMode}
                    userData={audit.user_data ?? null}
                    mission={projectContext.mission}
                    personas={personas}
                    selectedPersonaNames={audit.selected_personas?.map(p => p.name)}
                    constraints={projectContext.constraints}
                    contextImages={audit.context_images}
                  />
                </div>
              </div>
              
              {/* Right Column - Analysis */}
              <div className="lg:col-span-3 space-y-6" data-tour="feedback-sidebar">
                {/* Tab bar — shown when synth results are available or pending */}
                {(aiReport.synth_users || isSynthPending) && (
                  <div className="flex gap-1 p-1 rounded-lg bg-surface-1 border border-border w-full">
                    <button
                      onClick={() => setActiveTab("ux")}
                      className={cn(
                        "flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors text-center",
                        activeTab === "ux"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      UX Analysis
                    </button>
                    <button
                      onClick={() => setActiveTab("synth")}
                      className={cn(
                        "flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors text-center relative",
                        activeTab === "synth"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Synth User Research
                      {isSynthPending && !aiReport.synth_users && (
                        <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </button>
                  </div>
                )}
                {aiReport.synth_inherited && activeTab === "synth" && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-1 border border-border/50 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    {t("synthInheritedChip")}
                  </div>
                )}
                {((!aiReport.synth_users && !isSynthPending) || activeTab === "ux") && analysisContent}
                {isSynthPending && !aiReport.synth_users && activeTab === "synth" && (
                  <div className="glass rounded-xl overflow-hidden">
                    <div className="h-1 w-full bg-surface-1 overflow-hidden">
                      <div className="h-full w-2/3 bg-primary animate-pulse rounded-full" />
                    </div>
                    <div role="status" aria-live="polite" aria-busy="true" className="px-6 py-8 flex flex-col items-center gap-4 text-center">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-primary animate-spin" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Simulating user archetypes…</p>
                        <p className="text-xs text-muted-foreground">Synth User Research is being generated in the background. This usually takes 20–40 seconds.</p>
                      </div>
                    </div>
                  </div>
                )}
                {aiReport.synth_users && activeTab === "synth" && (
                  <SynthUserSection synthUsers={aiReport.synth_users} />
                )}
                {((!aiReport.synth_users && !isSynthPending) || activeTab === "ux") && (
                  <FeedbackCard
                    auditId={audit.id}
                    feedbackRating={feedbackRating}
                    setFeedbackRating={setFeedbackRating}
                    feedbackComment={feedbackComment}
                    setFeedbackComment={setFeedbackComment}
                    feedbackSubmitted={feedbackSubmitted}
                    setFeedbackSubmitted={setFeedbackSubmitted}
                    updateFeedback={updateFeedback}
                  />
                )}
              </div>
            </div>
          ) : (
            /* SINGLE SCREEN MODE: 2-Column Layout */
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Left Column - Visual & Context (Sticky Wrapper) */}
              <div className="lg:col-span-2">
                <div className="lg:sticky lg:top-8 space-y-6 h-fit">
                  {/* Screenshot Preview with Markers */}
                  <div data-tour="analyzed-image">
                    {isPinProvider && (
                      <ImageAnnotator
                        imageUrl={audit.screenshot_url}
                        issues={localizedIssues}
                        hoveredIssueId={hoveredIssueId}
                        onMarkerHover={setHoveredIssueId}
                        onMarkerClick={handleMarkerClick}
                        projectName={projectContext.name}
                        loadErrorLabel={t("screenshotLoadError")}
                        isExpired={isScreenshotExpired(audit.created_at)}
                        expiredTitle={t("screenshotExpiredTitle")}
                        expiredTooltip={t("screenshotExpiredTooltip")}
                        // T-079: precise pin rectangles when the plugin shipped node maps.
                        // Empty array (default) means the audit predates T-079 or came
                        // from the webapp — center markers fall back to box_2d.
                        rectOverlays={singleScreenRectOverlays}
                      />
                    )}
                    {!isPinProvider && (
                      <ImageAnnotator
                        imageUrl={audit.screenshot_url}
                        issues={[]}
                        hoveredIssueId={null}
                        onMarkerHover={() => undefined}
                        onMarkerClick={() => undefined}
                        projectName={projectContext.name}
                        loadErrorLabel={t("screenshotLoadError")}
                        isExpired={isScreenshotExpired(audit.created_at)}
                        expiredTitle={t("screenshotExpiredTitle")}
                        expiredTooltip={t("screenshotExpiredTooltip")}
                        // T-079: even non-pin providers benefit from layer-id-based
                        // overlays when the plugin shipped node maps.
                        rectOverlays={singleScreenRectOverlays}
                      />
                    )}
                  </div>

                  {/* Context Card */}
                  <AuditContextCard
                    screenGoal={audit.screen_context || null}
                    isFlowAudit={false}
                    userData={audit.user_data ?? null}
                    mission={projectContext.mission}
                    personas={personas}
                    selectedPersonaNames={audit.selected_personas?.map(p => p.name)}
                    constraints={projectContext.constraints}
                    contextImages={audit.context_images}
                  />
                </div>
              </div>

              {/* Right Column - Analysis */}
              <div className="lg:col-span-3 space-y-6" data-tour="feedback-sidebar">
                {/* Tab bar — shown when synth results are available or pending */}
                {(aiReport.synth_users || isSynthPending) && (
                  <div className="flex gap-1 p-1 rounded-lg bg-surface-1 border border-border w-full">
                    <button
                      onClick={() => setActiveTab("ux")}
                      className={cn(
                        "flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors text-center",
                        activeTab === "ux"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      UX Analysis
                    </button>
                    <button
                      onClick={() => setActiveTab("synth")}
                      className={cn(
                        "flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors text-center relative",
                        activeTab === "synth"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Synth User Research
                      {isSynthPending && !aiReport.synth_users && (
                        <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </button>
                  </div>
                )}
                {aiReport.synth_inherited && activeTab === "synth" && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-1 border border-border/50 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    {t("synthInheritedChip")}
                  </div>
                )}
                {((!aiReport.synth_users && !isSynthPending) || activeTab === "ux") && analysisContent}
                {isSynthPending && !aiReport.synth_users && activeTab === "synth" && (
                  <div className="glass rounded-xl overflow-hidden">
                    <div className="h-1 w-full bg-surface-1 overflow-hidden">
                      <div className="h-full w-2/3 bg-primary animate-pulse rounded-full" />
                    </div>
                    <div role="status" aria-live="polite" aria-busy="true" className="px-6 py-8 flex flex-col items-center gap-4 text-center">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-primary animate-spin" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Simulating user archetypes…</p>
                        <p className="text-xs text-muted-foreground">Synth User Research is being generated in the background. This usually takes 20–40 seconds.</p>
                      </div>
                    </div>
                  </div>
                )}
                {aiReport.synth_users && activeTab === "synth" && (
                  <SynthUserSection synthUsers={aiReport.synth_users} />
                )}
                {((!aiReport.synth_users && !isSynthPending) || activeTab === "ux") && (
                  <FeedbackCard
                    auditId={audit.id}
                    feedbackRating={feedbackRating}
                    setFeedbackRating={setFeedbackRating}
                    feedbackComment={feedbackComment}
                    setFeedbackComment={setFeedbackComment}
                    feedbackSubmitted={feedbackSubmitted}
                    setFeedbackSubmitted={setFeedbackSubmitted}
                    updateFeedback={updateFeedback}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    <ExportPresetModal
      open={exportModalOpen}
      onOpenChange={setExportModalOpen}
      onExport={handleExportPptx}
      loading={exportingPdf}
    />
    </>
  );
};

interface FeedbackCardProps {
  auditId: string;
  feedbackRating: number | null;
  setFeedbackRating: (v: number | null) => void;
  feedbackComment: string;
  setFeedbackComment: (v: string) => void;
  feedbackSubmitted: boolean;
  setFeedbackSubmitted: (v: boolean) => void;
  updateFeedback: ReturnType<typeof useUpdateAuditFeedback>;
}

function FeedbackCard({
  auditId,
  feedbackRating,
  setFeedbackRating,
  feedbackComment,
  setFeedbackComment,
  feedbackSubmitted,
  setFeedbackSubmitted,
  updateFeedback,
}: FeedbackCardProps) {
  const { t } = useLanguage();

  const handleSubmit = () => {
    if (feedbackRating === null) return;
    updateFeedback.mutate(
      { auditId, feedback_rating: feedbackRating, feedback_comment: feedbackComment || undefined },
      { onSuccess: () => setFeedbackSubmitted(true) }
    );
  };

  if (feedbackSubmitted) {
    return (
      <div className="glass rounded-xl p-5 border border-border space-y-4">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Star className="h-4 w-4 text-primary fill-primary" />
          {t("feedbackThanks")}
        </p>
        {feedbackRating !== null && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">{t("feedbackRating")}:</span>
            <div className="flex gap-0.5" aria-label={`${feedbackRating} out of 5`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn("h-4 w-4", feedbackRating >= star ? "fill-primary text-primary" : "text-muted-foreground/40")}
                />
              ))}
            </div>
            <span className="text-muted-foreground">({feedbackRating}/5)</span>
          </div>
        )}
        {feedbackComment.trim() ? (
          <div className="rounded-lg bg-muted/50 border border-border px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">{t("feedbackCommentLabel")}</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{feedbackComment}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-5 border border-border" data-tour="feedback-card">
      <p className="text-sm font-medium mb-3">{t("feedbackQuestion")}</p>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          // eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: star rating button with conditional fill class on icon (feedbackRating >= star); bespoke per-star active styling necessary
          <button
            key={star}
            type="button"
            onClick={() => setFeedbackRating(star)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              feedbackRating === star
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-label={t("feedbackRating") + " " + star}
          >
            <Star className={cn("h-5 w-5", feedbackRating !== null && feedbackRating >= star && "fill-primary text-primary")} />
          </button>
        ))}
      </div>
      <textarea
        aria-label={t("feedbackCommentPlaceholder")}
        className="w-full min-h-[72px] px-3 py-2 rounded-lg bg-background border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        placeholder={t("feedbackCommentPlaceholder")}
        value={feedbackComment}
        onChange={(e) => setFeedbackComment(e.target.value)}
        maxLength={500}
      />
      <Button
        size="sm"
        className="mt-3"
        onClick={handleSubmit}
        disabled={feedbackRating === null || updateFeedback.isPending}
      >
        <Send className="h-4 w-4 mr-2" />
        {updateFeedback.isPending ? t("sending") : t("sendFeedback")}
      </Button>
    </div>
  );
}

export default AuditDetail;
