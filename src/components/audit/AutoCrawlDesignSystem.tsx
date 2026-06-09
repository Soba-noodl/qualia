// q-disable DS-COLOR-001 (intentional violet for "outstanding" audit rating — violet is the canonical outstanding-tier color in the design system rating scale, not a semantic state token)
/* eslint-disable qualia-compliance/ds-color-001-no-raw-palette -- intentional: violet is the canonical "outstanding" tier color in the audit rating scale, not a semantic state */
import { useState } from "react";
import { ChevronDown, ChevronUp, Layers, Palette, Type, LayoutGrid, MousePointer2, Shapes, MessageSquare, CheckCircle2, AlertCircle, Puzzle, Package } from "lucide-react";
import { cn } from "@/lib/utils";

// Per-dimension value can be a plain string (old auto-crawl) or a scored object (prototype)
type Rating = "outstanding" | "good" | "partial" | "poor";
type DimensionValue = string | { rating: Rating; verdict: string; action: string } | undefined;

interface DesignSystemData {
  components: DimensionValue;
  color: DimensionValue;
  typography: DimensionValue;
  spacing_layout: DimensionValue;
  interactive_states: DimensionValue;
  iconography: DimensionValue;
  microcopy_voice: DimensionValue;
  verdict: string;
  // Prototype-only fields
  token_consistency?: DimensionValue;
  component_library?: DimensionValue;
}

interface AutoCrawlDesignSystemProps {
  designSystem: DesignSystemData;
}

const DIMENSIONS = [
  {
    key: "components" as const,
    label: "Components",
    icon: Layers,
    hint: "Buttons, inputs, cards, modals",
  },
  {
    key: "color" as const,
    label: "Color",
    icon: Palette,
    hint: "Semantic palette consistency",
  },
  {
    key: "typography" as const,
    label: "Typography",
    icon: Type,
    hint: "Heading hierarchy and text styles",
  },
  {
    key: "spacing_layout" as const,
    label: "Spacing & Layout",
    icon: LayoutGrid,
    hint: "Grid, margins, gaps",
  },
  {
    key: "interactive_states" as const,
    label: "Interactive States",
    icon: MousePointer2,
    hint: "Hover, focus, disabled conventions",
  },
  {
    key: "iconography" as const,
    label: "Iconography",
    icon: Shapes,
    hint: "Library consistency and sizing",
  },
  {
    key: "microcopy_voice" as const,
    label: "Microcopy & Voice",
    icon: MessageSquare,
    hint: "Tone, capitalization, one author?",
  },
  {
    key: "token_consistency" as const,
    label: "Token Consistency",
    icon: Puzzle,
    hint: "Spacing grid, palette, type scale",
  },
  {
    key: "component_library" as const,
    label: "Component Library",
    icon: Package,
    hint: "Recognized library or custom system",
  },
];

const RATING_DOT: Record<Rating, string> = {
  outstanding: "bg-violet-400",
  good: "bg-green-500",
  partial: "bg-amber-500",
  poor: "bg-red-500",
};

const RATING_LABEL: Record<Rating, string> = {
  outstanding: "Outstanding",
  good: "Good",
  partial: "Partial",
  poor: "Poor",
};

function getRating(value: DimensionValue): Rating | null {
  if (!value || typeof value === "string") return null;
  return value.rating ?? null;
}

function getVerdictText(value: DimensionValue): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.verdict ?? "";
}

function getActionText(value: DimensionValue): string | null {
  if (!value || typeof value === "string") return null;
  return value.action ?? null;
}

function isDimensionPresent(value: DimensionValue): boolean {
  if (!value) return false;
  if (typeof value === "string") return true;
  return !!(value.verdict || value.action);
}

/** Derive overall summary rating from all rated dimensions */
function summaryRating(ds: DesignSystemData): Rating {
  const keys: (keyof DesignSystemData)[] = [
    "components", "color", "typography", "spacing_layout",
    "interactive_states", "iconography", "microcopy_voice",
    "token_consistency", "component_library",
  ];
  const ratings = keys
    .map(k => getRating(ds[k] as DimensionValue))
    .filter((r): r is Rating => r !== null);

  if (ratings.length === 0) return "partial"; // no ratings = old format, fall back to verdict-based

  const poor = ratings.filter(r => r === "poor").length;
  const partial = ratings.filter(r => r === "partial").length;
  const outstanding = ratings.filter(r => r === "outstanding").length;
  const total = ratings.length;

  if (poor / total >= 0.4) return "poor";
  if ((poor + partial) / total >= 0.5) return "partial";
  // Outstanding overall: majority are outstanding and none are poor
  if (poor === 0 && outstanding / total >= 0.6) return "outstanding";
  return "good";
}

function isPositiveVerdict(verdict: string): boolean {
  const lower = verdict.toLowerCase();
  return (
    lower.includes("coherent") ||
    lower.includes("consistent") ||
    lower.includes("well-enforced") ||
    lower.includes("strong")
  );
}

const AutoCrawlDesignSystem = ({ designSystem }: AutoCrawlDesignSystemProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Decide if dimensions have ratings (prototype mode) or are plain strings (auto-crawl)
  const hasScoredDimensions = DIMENSIONS.some(d =>
    isDimensionPresent(designSystem[d.key]) && typeof designSystem[d.key] !== "string"
  );

  const overallRating = hasScoredDimensions ? summaryRating(designSystem) : null;
  const isPositive = overallRating === "good" || overallRating === "outstanding" || (!overallRating && isPositiveVerdict(designSystem.verdict));

  return (
    <div className="space-y-5">
      {/* Verdict headline */}
      <div
        className={cn(
          "rounded-xl border p-5 flex items-start gap-4",
          overallRating === "outstanding"
            ? "border-violet-500/50 bg-violet-500/10"
            : overallRating === "good" || isPositive
            ? "border-green-500/50 bg-green-500/25"
            : overallRating === "poor"
            ? "border-red-500/50 bg-red-500/25"
            : "border-amber-500/50 bg-amber-500/25"
        )}
      >
        <div
          className={cn(
            "p-2.5 rounded-lg flex-shrink-0",
            overallRating === "outstanding" ? "bg-violet-500/20" :
            isPositive ? "bg-green-500/20" :
            overallRating === "poor" ? "bg-red-500/20" : "bg-amber-500/20"
          )}
        >
          {overallRating === "outstanding" ? (
            <CheckCircle2 className="h-5 w-5 text-violet-400" />
          ) : isPositive ? (
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          ) : (
            <AlertCircle className={cn("h-5 w-5", overallRating === "poor" ? "text-red-400" : "text-amber-400")} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground">Design System Verdict</h3>
            {hasScoredDimensions && overallRating && (
              <span className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
                overallRating === "outstanding" ? "bg-violet-500/15 text-violet-400" :
                overallRating === "good" ? "bg-green-500/15 text-green-400" :
                overallRating === "poor" ? "bg-red-500/15 text-red-400" :
                "bg-amber-500/15 text-amber-400"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", RATING_DOT[overallRating])} />
                {RATING_LABEL[overallRating]}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground leading-relaxed">{designSystem.verdict}</p>
        </div>
      </div>

      {/* Per-dimension accordion */}
      <div className="space-y-2">
        {DIMENSIONS.filter(({ key }) => isDimensionPresent(designSystem[key])).map(({ key, label, icon: Icon, hint }) => {
          const value = designSystem[key];
          const rating = getRating(value);
          const verdictText = getVerdictText(value);
          const actionText = getActionText(value);
          const isOpen = expanded === key;

          return (
            <div
              key={key}
              className="rounded-xl border border-border bg-surface-1 overflow-hidden"
            >
              {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: full-width px-4 py-3.5 collapsible DS section with icon+label nested; Button primitive (h-10 rounded-md) would conflict with full-width layout */}
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : key)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2 transition-colors"
              >
                <div className="p-1.5 rounded-md bg-primary/10 flex-shrink-0">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  {!isOpen && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{hint}</p>
                  )}
                </div>
                {/* Rating dot */}
                {rating && (
                  <span className={cn(
                    "flex-shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                    rating === "outstanding" ? "bg-violet-500/10 text-violet-400" :
                    rating === "good" ? "bg-green-500/10 text-green-400" :
                    rating === "poor" ? "bg-red-500/10 text-red-400" :
                    "bg-amber-500/10 text-amber-400"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", RATING_DOT[rating])} />
                    {RATING_LABEL[rating]}
                  </span>
                )}
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-0 border-t border-border/50 space-y-3">
                  <p className="text-sm text-foreground/90 leading-relaxed pt-3">{verdictText}</p>
                  {actionText && (
                    <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                      <p className="text-xs font-medium text-primary mb-0.5">Next step</p>
                      <p className="text-sm text-foreground/80 leading-relaxed">{actionText}</p>
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

export default AutoCrawlDesignSystem;
