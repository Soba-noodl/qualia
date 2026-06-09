import { ChevronDown, ChevronUp, ShieldAlert, ShieldCheck, CheckCircle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { stripCoordinateFromReportText } from "@/lib/stripReportCoordinateText";
import { getMarkerColor } from "@/lib/markerColors";

export interface AccessibilityResult {
  wcag_level: string;
  contrast_failures: Array<{
    element: string;
    ratio: number;
    required: number;
    box_2d: [number, number, number, number] | null;
    image_index?: number | null;
  }>;
  other_violations: Array<{
    issue: string;
    wcag_criterion: string;
    severity: "critical" | "warning";
    suggestion: string;
    box_2d: [number, number, number, number] | null;
    image_index?: number | null;
  }>;
  passed: boolean;
}

interface AccessibilityCardProps {
  accessibility: AccessibilityResult;
  expanded: boolean;
  onToggle: () => void;
  /** Register ref for a violation id so pin click can scroll to it */
  registerIssueRef?: (id: string, el: HTMLDivElement | null) => void;
  /** When user clicks a violation card (e.g. in flow mode) — navigate carousel and highlight marker */
  onViolationClick?: (id: string) => void;
  /** Map of violation id → markerIndex for violations that have a visual pin */
  violationMarkers?: Map<string, number>;
}

export function AccessibilityCard({
  accessibility,
  expanded,
  onToggle,
  registerIssueRef,
  onViolationClick,
  violationMarkers,
}: AccessibilityCardProps) {


  const { wcag_level, other_violations } = accessibility;
  const ov = other_violations ?? [];

  // Normalize contrast_failures — prototype mode outputs {fg, bg, element_description, wcag_criterion}
  // while single/flow outputs {element, ratio, required}. Unify both shapes here.
  const cf = (accessibility.contrast_failures ?? []).map((row) => {
    const rawRow = row as Record<string, unknown>;
    const element = (rawRow.element as string | undefined)
      || (rawRow.element_description as string | undefined)
      || (rawRow.fg && rawRow.bg ? `${rawRow.fg} on ${rawRow.bg}` : "Unknown element");
    const ratio = typeof rawRow.ratio === "number" ? rawRow.ratio : 0;
    // Derive required from wcag_criterion if not explicitly provided
    const required = typeof rawRow.required === "number" && rawRow.required > 0
      ? rawRow.required
      : (typeof rawRow.wcag_criterion === "string" && rawRow.wcag_criterion.includes("1.4.11") ? 3.0 : 4.5);
    return { element, ratio, required, box_2d: rawRow.box_2d as [number, number, number, number] | null };
  });
  const totalViolations = cf.length + ov.length;

  // 3-way state: FAIL requires hard computed contrast data; AI-only findings = REVIEW
  const a11yState: "pass" | "fail" | "review" =
    cf.length > 0 ? "fail" : ov.length > 0 ? "review" : "pass";

  // Border colors mirror the score-color allow-list (REWORK-002b):
  // green-500 (#22c55e) for pass, destructive token for fail (button-style — fine on this surface), amber-500 for review.
  const leftBorderColor =
    a11yState === "pass" ? "rgb(34 197 94)" :
    a11yState === "fail" ? "hsl(var(--destructive))" :
    "rgb(245 158 11)";

  return (
    <div
      className={cn(
        // eslint-disable-next-line no-restricted-syntax -- DS-RADIUS-003: foundational card wrapper must track the global --radius token exactly
        "rounded-[var(--radius)] border overflow-hidden transition-all",
        "bg-[hsl(var(--card))] border-[hsl(var(--border))]"
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: leftBorderColor }}
    >
      {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: full-width p-5 collapsible card header with icon+heading+description nested children; Button primitive (h-10 rounded-md) would conflict with layout */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-5 flex items-center gap-4 text-left hover:bg-[hsl(var(--surface-1))]/50 transition-colors"
      >
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            a11yState === "pass" ? "bg-green-500/20" :
            a11yState === "fail" ? "bg-[hsl(var(--destructive))]/20" :
            "bg-amber-500/20"
          )}
        >
          {a11yState === "pass" ? (
            <ShieldCheck className="h-5 w-5 text-green-400" aria-hidden />
          ) : a11yState === "fail" ? (
            <ShieldAlert className="h-5 w-5 text-[hsl(var(--destructive))]" aria-hidden />
          ) : (
            <Eye className="h-5 w-5 text-amber-500" aria-hidden />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Accessibility</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            WCAG 2.1 {wcag_level} · Contrast, touch targets, labels
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span
            className={cn(
              "text-xs font-medium px-2.5 py-1 rounded-full text-white",
              a11yState === "pass" ? "bg-green-500" :
              a11yState === "fail" ? "bg-[hsl(var(--destructive))]" :
              "bg-amber-500"
            )}
          >
            {wcag_level} {a11yState === "pass" ? "PASS" : a11yState === "fail" ? "FAIL" : "REVIEW"}
          </span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {totalViolations === 0 ? "No violations" : `${totalViolations} violation${totalViolations !== 1 ? "s" : ""}`}
          </span>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-[hsl(var(--muted-foreground))]" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 text-[hsl(var(--muted-foreground))]" aria-hidden />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-[hsl(var(--border))]/50 pt-4">
          {cf.length === 0 && ov.length === 0 && (
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-sm font-medium">All accessibility checks passed.</span>
            </div>
          )}

          {a11yState === "review" && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
              <Eye className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                These issues were flagged by AI from a static screenshot — they cannot be mathematically verified. Check them manually before treating them as confirmed failures.
              </p>
            </div>
          )}

          {cf.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
                Contrast failures
                <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-[hsl(var(--surface-3))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]">Computed</span>
              </h4>
              <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(var(--surface-2))] text-[hsl(var(--muted-foreground))] text-left">
                      <th scope="col" className="px-3 py-2 font-medium w-12">Where</th>
                      <th scope="col" className="px-3 py-2 font-medium">Element</th>
                      <th scope="col" className="px-3 py-2 font-medium">Ratio</th>
                      <th scope="col" className="px-3 py-2 font-medium">Required</th>
                      <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cf.map((row, idx) => {
                      const id = `accessibility-contrast-${idx}`;
                      const isPass = row.ratio >= row.required;
                      const pinIndex = violationMarkers?.get(id);
                      return (
                        <tr
                          key={id}
                          ref={(el) => registerIssueRef?.(id, el)}
                          className={cn(
                            "bg-[hsl(var(--surface-2))]/50 border-t border-[hsl(var(--border))]",
                            onViolationClick && pinIndex !== undefined && "cursor-pointer hover:bg-[hsl(var(--surface-2))]"
                          )}
                          role={onViolationClick && pinIndex !== undefined ? "button" : undefined}
                          tabIndex={onViolationClick && pinIndex !== undefined ? 0 : undefined}
                          onClick={() => onViolationClick && pinIndex !== undefined && onViolationClick(id)}
                          onKeyDown={(e) => onViolationClick && pinIndex !== undefined && (e.key === "Enter" || e.key === " ") && onViolationClick(id)}
                        >
                          <td className="px-3 py-2">
                            {pinIndex !== undefined ? (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                style={{ backgroundColor: getMarkerColor(pinIndex) }}
                              >
                                {pinIndex + 1}
                              </div>
                            ) : (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--surface-3))] text-[hsl(var(--muted-foreground))]">Global</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[hsl(var(--foreground))]">
                            {stripCoordinateFromReportText(row.element)}
                          </td>
                          <td className="px-3 py-2 text-[hsl(var(--foreground))]">
                            {Number(row.ratio).toFixed(2)}:1
                          </td>
                          <td className="px-3 py-2 text-[hsl(var(--foreground))]">
                            {row.required}:1
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded-full",
                                isPass
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-[hsl(var(--destructive))]/20 text-red-400"
                              )}
                            >
                              {isPass ? "✓ Pass" : "✕ Fail"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ov.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
                Other potential issues
                <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">AI assessment</span>
              </h4>
              <div className="space-y-3">
                {ov.map((row, idx) => {
                  const id = `accessibility-other-${idx}`;
                  const isCritical = row.severity === "critical";
                  const pinIndex = violationMarkers?.get(id);
                  const isLocalized = pinIndex !== undefined;
                  const interactive = !!onViolationClick && isLocalized;
                  const interactiveProps = interactive
                    ? {
                        role: "button" as const,
                        tabIndex: 0,
                        onClick: () => onViolationClick?.(id),
                        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onViolationClick?.(id);
                          }
                        },
                      }
                    : {};
                  return (
                    <div
                      key={id}
                      ref={(el) => registerIssueRef?.(id, el)}
                      className={cn(
                        "p-4 rounded-lg bg-[hsl(var(--surface-1))]/50 border border-[hsl(var(--border))]",
                        interactive && "cursor-pointer hover:bg-[hsl(var(--surface-1))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      )}
                      {...interactiveProps}
                    >
                      {/* Location indicator */}
                      <div className="flex items-center gap-2 mb-2">
                        {isLocalized ? (
                          <>
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ backgroundColor: getMarkerColor(pinIndex!) }}
                            >
                              {pinIndex! + 1}
                            </div>
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">Click to view on screen</span>
                          </>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--surface-2))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]">Global</span>
                        )}
                      </div>
                      <p className="font-semibold text-sm text-[hsl(var(--foreground))] mb-2 leading-relaxed">
                        {stripCoordinateFromReportText(row.issue)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--surface-3))] text-[hsl(var(--muted-foreground))] font-mono">
                          {row.wcag_criterion}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded",
                            isCritical
                              ? "bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))]"
                              : "bg-amber-500/20 text-amber-400"
                          )}
                        >
                          {row.severity}
                        </span>
                      </div>
                      <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                        {stripCoordinateFromReportText(row.suggestion)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
