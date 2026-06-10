import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMarkerColor } from "@/lib/markerColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { mergeShowcaseTranslations } from "@/lib/translations/mergeShowcaseTranslations";
import { showcaseScreenUrl, type ShowcaseRow } from "@/hooks/use-showcase";
import BrandLogo from "@/components/showcase/BrandLogo";
import type { AiReport, FlowIssueData } from "@/services/audit.service";

type Engine = "cognitive" | "heuristic" | "interaction" | "system_logic";
const ENGINES: Engine[] = ["cognitive", "heuristic", "interaction", "system_logic"];

interface Props {
  row: ShowcaseRow;
}

type Pin = {
  id: string;
  cx: number; // center x in %
  cy: number; // center y in %
  index: number; // 0-based ordering for color
  engine: Engine;
  finding: FlowIssueData;
};

/**
 * Convert box_2d [ymin, xmin, ymax, xmax] (0-1000 scale) → center % {cx, cy}.
 * Mirrors boxToMarkerPosition in AuditDetail.tsx so coords land identically.
 */
function boxToCenter(box: FlowIssueData["box_2d"]): { cx: number; cy: number } | null {
  if (!box || box.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = box;
  if (!box.every((v) => Number.isFinite(v))) return null;
  if (ymin >= ymax || xmin >= xmax) return null;
  if (ymin < -50 || ymax > 1050 || xmin < -50 || xmax > 1050) return null;
  const cy = (ymin + ymax) / 20; // /2 then /10
  const cx = (xmin + xmax) / 20;
  const clamp = (n: number) => Math.max(5, Math.min(95, n));
  return { cx: clamp(cx), cy: clamp(cy) };
}

const ShowcaseCard = ({ row }: Props) => {
  const { language, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [tipPlacement, setTipPlacement] = useState<"above" | "below" | "left" | "right">("above");

  // Merge translations once per row+locale.
  const aiReport: AiReport = useMemo(
    () => mergeShowcaseTranslations(row.ai_report, row.translations, language),
    [row.ai_report, row.translations, language],
  );

  // Collect pins on image_index === 0 (the card thumbnail = first screen).
  const pins: Pin[] = useMemo(() => {
    const out: Pin[] = [];
    let i = 0;
    for (const engine of ENGINES) {
      const findings = aiReport.engines[engine] ?? [];
      for (let j = 0; j < findings.length; j++) {
        const f = findings[j];
        const idx = f.image_index ?? 0;
        if (idx !== 0) {
          i += 1;
          continue;
        }
        const c = boxToCenter(f.box_2d ?? null);
        if (!c) {
          i += 1;
          continue;
        }
        out.push({
          id: `${row.slug}-${engine}-${j}`,
          cx: c.cx,
          cy: c.cy,
          index: i,
          engine,
          finding: f,
        });
        i += 1;
      }
    }
    return out;
  }, [aiReport, row.slug]);

  // Card summary: ~3-line distilled version of OBT, stored per-locale on
  // translations. Falls back to English summary, then to the long OBT.
  const localePayload = row.translations?.[language] as
    | { card_summary?: string; card_summary_principle?: string; card_subtitle?: string }
    | undefined;
  const enPayload = row.translations?.en as
    | { card_summary?: string; card_summary_principle?: string; card_subtitle?: string }
    | undefined;
  const cardSummary =
    localePayload?.card_summary ?? enPayload?.card_summary ?? aiReport.one_big_thing;
  const cardSummaryPrinciple =
    localePayload?.card_summary_principle ?? enPayload?.card_summary_principle;
  // Short one-line tagline under the project name. Falls back to the long
  // project mission, but that's expected to fit on one line for the four
  // showcased products.
  const cardSubtitle =
    localePayload?.card_subtitle ?? enPayload?.card_subtitle ?? row.project_mission;

  const findingsCount = ENGINES.reduce((n, e) => n + (aiReport.engines[e]?.length ?? 0), 0);
  const screensCount = row.public_flow_images.length;

  const subScores = aiReport.sub_scores;
  const score = aiReport.score;

  const firstScreenUrl = showcaseScreenUrl(row.public_flow_images[0]);

  // Edge-aware tooltip placement
  const onPinEnter = (pinId: string, pinEl: HTMLElement) => {
    const container = containerRef.current;
    if (!container) {
      setHoveredPinId(pinId);
      return;
    }
    const p = pinEl.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    const HALF = 110;
    const GAP = 8;
    const TIP_H = 60;
    let placement: typeof tipPlacement = "above";
    if (p.left - c.left < HALF + GAP) placement = "right";
    else if (c.right - p.right < HALF + GAP) placement = "left";
    else if (p.top - c.top < TIP_H + GAP) placement = "below";
    setTipPlacement(placement);
    setHoveredPinId(pinId);
  };

  return (
    <Link
      to={`/showcase/${row.slug}`}
      className={cn(
        "group flex flex-col h-full rounded-2xl border border-border bg-card p-5 transition-colors duration-150",
        "hover:border-primary/50 hover:bg-card/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <BrandLogo slug={row.slug} size={18} />
            <h3 className="text-base font-semibold text-foreground">{row.project_name}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">{cardSubtitle}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-baseline gap-0.5 justify-end">
            <span className="text-4xl font-bold text-foreground leading-none">{score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>
      </div>

      {/* Screen preview with pins */}
      <div
        ref={containerRef}
        className="relative aspect-[16/7] rounded-lg overflow-hidden bg-surface-1 mb-4"
      >
        <img
          src={firstScreenUrl}
          alt={`${row.project_name} screenshot`}
          className="w-full h-full object-cover object-top"
          loading="lazy"
        />
        {pins.map((pin) => {
          const isHovered = hoveredPinId === pin.id;
          const color = getMarkerColor(pin.index);
          return (
            <div
              key={pin.id}
              className={cn(
                "absolute transition-transform duration-200",
                "-translate-x-1/2 -translate-y-1/2",
                "z-30",
                isHovered && "z-40",
              )}
              style={{ left: `${pin.cx}%`, top: `${pin.cy}%` }}
              onMouseEnter={(e) => onPinEnter(pin.id, e.currentTarget as HTMLElement)}
              onMouseLeave={() => setHoveredPinId(null)}
            >
              {isHovered && (
                <div
                  className="absolute inset-0 rounded-full animate-ping opacity-75"
                  style={{ backgroundColor: color, animationDuration: "1s" }}
                  aria-hidden="true"
                />
              )}
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center font-bold text-white border-2 shadow-lg transition-transform text-xs",
                  isHovered && "scale-125",
                )}
                style={{ backgroundColor: color, borderColor: `${color}80` }}
                aria-hidden="true"
              >
                {pin.index + 1}
              </div>
              {isHovered && (
                <div
                  className={cn(
                    "absolute w-56 pointer-events-none z-50",
                    tipPlacement === "above" && "left-1/2 -translate-x-1/2 bottom-full mb-2",
                    tipPlacement === "below" && "left-1/2 -translate-x-1/2 top-full mt-2",
                    tipPlacement === "right" && "left-full ml-2 top-1/2 -translate-y-1/2",
                    tipPlacement === "left" && "right-full mr-2 top-1/2 -translate-y-1/2",
                  )}
                >
                  <div className="rounded-md border border-border bg-background/95 backdrop-blur-sm p-2 shadow-xl">
                    <p className="text-[11px] leading-snug text-foreground line-clamp-3">
                      {pin.finding.issue}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* OBT — visual centerpiece. Summary is a short distillation, no clamp needed. */}
      <div className="border-l-[3px] border-primary pl-3.5 py-1.5 mb-3.5 rounded-r-md">
        <p className="text-[10px] uppercase tracking-wider font-bold text-primary/80 mb-1.5">
          {t("showcaseOneBigThing")}
          {cardSummaryPrinciple ? ` · ${cardSummaryPrinciple}` : ""}
        </p>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {cardSummary}
        </p>
      </div>

      {/* mt-auto pushes the footer + CTA to the bottom of the card so they
          align across the 2×2 grid regardless of summary length. */}
      <div className="mt-auto">
        {/* Footer — sub-scores left, counts right */}
        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground pt-3 border-t border-border mb-3.5">
          {subScores ? (
            <span className="tracking-tight text-muted-foreground/80">
              cog {subScores.cognitive_score} · heur {subScores.heuristic_score} · int {subScores.interaction_score} · logic {subScores.system_logic_score}
            </span>
          ) : (
            <span />
          )}
          <span className="shrink-0">
            {findingsCount} {t("showcaseFindingsCount")} · {screensCount} {t("showcaseScreensCount")}
          </span>
        </div>

        {/* Primary CTA */}
        <div
          className={cn(
            "flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg text-sm font-semibold",
            "border border-primary/40 bg-primary/15 text-primary",
            "transition-colors duration-150",
            "group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground",
          )}
        >
          {t("showcaseReadAuditCta")}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
};

export default ShowcaseCard;
