import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { scoreToTailwindColor } from "@/lib/score-colors";
import {
  Calendar,
  FileSearch,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Loader2,
  RefreshCw,
  Globe,
} from "lucide-react";
import type { Audit } from "@/hooks/use-audits";
import { stripCoordinateFromReportText } from "@/lib/stripReportCoordinateText";
import { formatDateTime } from "@/lib/dateFormat";
import { clickableProps } from "@/lib/a11y";
import { isScreenshotExpired } from "@/lib/screenshot-retention";
import { ExpiredScreenshot } from "@/components/audit/ExpiredScreenshot";
import { ProviderChipMini } from "@/components/audit/ProviderChipMini";
import type { LLMProvider } from "@/services/llm-key.service";

type TFunction = (key: string) => string;

interface AuditCardProps {
  audit: Audit;
  imageUrl: string;
  isAnalyzing: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRetry: (e: React.MouseEvent) => void;
  t: TFunction;
  /** Delta compared to the previous audit (for re-audit badge) */
  reAuditDelta?: number | null;
}

export function AuditCard({
  audit,
  imageUrl,
  isAnalyzing,
  onSelect,
  onDelete,
  onRetry,
  t,
  reAuditDelta,
}: AuditCardProps) {
  const isPending =
    audit.status === "pending" ||
    audit.status === "processing" ||
    isAnalyzing;
  const isFailed = audit.status === "failed" && !isAnalyzing;
  const isCompleted = audit.status === "completed" && !!audit.ai_report;
  const isAutoCrawl = audit.source === "auto-crawl";
  const isPrototypeCrawl = audit.source === "prototype-crawl";
  const [imageLoadError, setImageLoadError] = useState(false);
  // useProjectSignedUrls returns "/placeholder.svg" both for cache misses
  // (transient) and for files that can't be signed because they were deleted
  // (permanent). Wait for the URL to stay on the placeholder for ~1.5s before
  // treating it as a permanent miss — otherwise every card flashes expired
  // on first mount.
  const [missingSignedUrl, setMissingSignedUrl] = useState(false);
  useEffect(() => {
    if (imageUrl && imageUrl !== "/placeholder.svg") {
      setMissingSignedUrl(false);
      return;
    }
    const t = setTimeout(() => setMissingSignedUrl(true), 1500);
    return () => clearTimeout(t);
  }, [imageUrl]);
  const isExpired =
    isCompleted &&
    (isScreenshotExpired(audit.created_at) || imageLoadError || missingSignedUrl);

  // For prototype audits, show the file name extracted during crawl (stored in ai_report)
  // rather than the raw Figma URL stored in screen_context.
  const rawReport = audit.ai_report as Record<string, unknown> | null;
  const prototypeName: string | null =
    (rawReport?.prototype_meta as Record<string, unknown> | undefined)?.figma_file_name as string ??
    (rawReport?.debug as Record<string, unknown> | undefined)?.figma_file_name as string ??
    null;

  return (
    <div
      {...(isCompleted
        ? clickableProps(onSelect)
        : { onClick: () => {} })}
      aria-disabled={!isCompleted}
      className={`glass rounded-xl overflow-hidden group transition-all text-left relative ${
        isCompleted ? "hover:glow-border cursor-pointer" : "cursor-default opacity-80"
      }`}
    >
      {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: absolute top-2 left-2 delete badge p-2 rounded-lg bg-destructive/80 with group-hover:opacity-100; Button primitive min-width and reset would displace the overlay badge position */}
      <button
        onClick={onDelete}
        className="absolute top-2 left-2 z-10 p-2 rounded-lg bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100"
        title={t("deleteAudit")}
        aria-label={t("deleteAudit") ?? "Delete audit"}
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <div className="aspect-video bg-surface-1 relative overflow-hidden">
        {isExpired ? (
          <ExpiredScreenshot
            title={t("screenshotExpiredTitle")}
            tooltip={t("screenshotExpiredTooltip")}
            compact
          />
        ) : (
          <img
            src={imageUrl}
            alt="Screenshot"
            onError={() => setImageLoadError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 ${
              isCompleted ? "group-hover:scale-105" : ""
            } ${isPending ? "opacity-50" : ""} ${isFailed ? "opacity-40 grayscale" : ""}`}
          />
        )}
        {isPending && isAutoCrawl && (
          <div className="absolute inset-0 bg-background/90 flex items-center justify-center p-4">
            <div className="text-center space-y-2">
              <div role="status" aria-live="polite" aria-busy="true" className="flex items-center justify-center gap-2">
                <Globe className="h-5 w-5 text-primary animate-pulse" aria-hidden="true" />
                <Loader2 className="h-5 w-5 text-primary animate-spin" aria-hidden="true" />
                <span className="sr-only">Loading…</span>
              </div>
              <p className="text-sm text-primary font-semibold">Crawling your product…</p>
              <p className="text-xs text-muted-foreground leading-snug">
                Usually 2–4 min. You can close this page — the audit will be here when you're back.
              </p>
              {audit.screen_context && (
                <p className="text-[10px] text-muted-foreground/60 truncate max-w-[160px] mx-auto">
                  {audit.screen_context}
                </p>
              )}
            </div>
          </div>
        )}
        {isPending && !isAutoCrawl && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div role="status" aria-live="polite" aria-busy="true" className="text-center">
              <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" aria-hidden="true" />
              <p className="text-sm text-primary font-medium">{t("analyzing")}</p>
            </div>
          </div>
        )}
        {isFailed && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-400" />
              <p className="text-sm text-red-400 font-medium">
                {t("analysisFailed")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={onRetry}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                {t("retryAnalysis")}
              </Button>
            </div>
          </div>
        )}
        {isCompleted && !isPending && (
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
            <span className="flex items-center gap-2 text-sm font-medium text-primary">
              <FileSearch className="h-4 w-4" />
              {t("viewReport")}
            </span>
          </div>
        )}
        {isCompleted && audit.ai_report && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            {reAuditDelta !== undefined && reAuditDelta !== null && (
              <div className={`bg-background/90 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1 ${
                reAuditDelta >= 0 ? "text-green-400" : "text-red-400"
              }`}>
                <RefreshCw className="h-3 w-3" />
                <span className="text-xs font-bold">
                  {reAuditDelta > 0 ? "+" : ""}{reAuditDelta}
                </span>
              </div>
            )}
            <div className="bg-background/90 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
              <span
                className={`text-sm font-bold ${scoreToTailwindColor(audit.ai_report.score)}`}
              >
                {audit.ai_report.score}
              </span>
            </div>
          </div>
        )}
        {audit.selected_personas && audit.selected_personas.length > 0 && (
          <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-lg px-2 py-1">
            <span className="text-xs text-muted-foreground">
              {audit.selected_personas.map((p) => p.name).join(", ")}
            </span>
          </div>
        )}
        {audit.ai_provider && audit.status === "completed" && (
          <div className="absolute bottom-2 right-2">
            <ProviderChipMini
              provider={audit.ai_provider as LLMProvider}
              variant={audit.paid_by === "platform" ? "trial" : "byok"}
            />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDateTime(audit.created_at)}
          </div>
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : isPending ? (
            <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
          ) : isFailed ? (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          ) : null}
        </div>
        {(audit.screen_context || prototypeName) && (
          <p className="text-xs mt-1 text-muted-foreground/70 line-clamp-1 italic">
            {isPrototypeCrawl
              ? (prototypeName ?? audit.screen_context)
              : `"${audit.screen_context}"`}
          </p>
        )}
        {isCompleted && audit.ai_report && (
          <p className="text-sm mt-2 text-muted-foreground line-clamp-2">
            {stripCoordinateFromReportText(audit.ai_report.one_big_thing)}
          </p>
        )}
        {isFailed && (
          <p className="text-xs mt-2 text-red-400/80 line-clamp-3">
            {audit.error_message || t("analysisError")}
          </p>
        )}
      </div>
    </div>
  );
}
