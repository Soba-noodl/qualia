import { useState, useEffect, useCallback, useRef } from "react";
import type { KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { createScreenshotSignedUrls } from "@/services/storage.service";
import { storagePathsKey } from "@/lib/storage-paths";
import { cn } from "@/lib/utils";
import { getMarkerColor } from "@/lib/markerColors";
import { clickableProps } from "@/lib/a11y";
import { ExpiredScreenshot } from "./ExpiredScreenshot";

interface FlowMarkerOverlayProps {
  currentSlideIssues: FlowIssue[];
  hoveredIssueId: string | null;
  highlightedIssueId: string | null;
  inLightbox: boolean;
  onMarkerHover: (issueId: string | null) => void;
  onMarkerActivate: (issueId: string) => void;
}

function MarkerOverlay({
  currentSlideIssues,
  hoveredIssueId,
  highlightedIssueId,
  inLightbox,
  onMarkerHover,
  onMarkerActivate,
}: FlowMarkerOverlayProps) {
  return (
    <>
      {currentSlideIssues.map((issue) => {
        const isHovered = hoveredIssueId === issue.id;
        const isHighlighted = highlightedIssueId === issue.id;
        const markerSize = inLightbox ? "w-7 h-7 text-sm" : "w-6 h-6 text-xs";
        const color = getMarkerColor(issue.markerIndex!);
        const label = `Issue #${issue.markerIndex! + 1}: ${issue.issue}`;

        return (
          <div
            key={issue.id}
            role="button"
            tabIndex={0}
            aria-label={label}
            className={cn(
              "absolute transform -translate-x-1/2 -translate-y-1/2 z-30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full",
              (isHovered || isHighlighted) && "z-40"
            )}
            style={{
              left: `${issue.location!.x}%`,
              top: `${issue.location!.y}%`,
            }}
            onMouseEnter={() => onMarkerHover(issue.id)}
            onMouseLeave={() => onMarkerHover(null)}
            onFocus={() => onMarkerHover(issue.id)}
            onBlur={() => onMarkerHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              onMarkerActivate(issue.id);
            }}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onMarkerActivate(issue.id);
              }
            }}
          >
            {/* Pulse ring for hovered/highlighted state */}
            {(isHovered || isHighlighted) && (
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-75"
                style={{ backgroundColor: color, animationDuration: "1s" }}
                aria-hidden="true"
              />
            )}

            {/* Main marker */}
            <div
              className={cn(
                "rounded-full flex items-center justify-center font-bold text-white border-2 cursor-pointer shadow-lg transition-transform",
                markerSize,
                (isHovered || isHighlighted) && "scale-125"
              )}
              style={{ backgroundColor: color, borderColor: color + "80" }}
              aria-hidden="true"
            >
              {issue.markerIndex! + 1}
            </div>

            {/* Tooltip on hover/focus */}
            {isHovered && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 pointer-events-none" aria-hidden="true">
                <div className="glass rounded-lg p-2 text-xs shadow-xl border border-border">
                  <p className="font-medium text-foreground line-clamp-2">{issue.issue}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// Marker position computed from bounding box center (0-100 percentage)
interface MarkerPosition {
  x: number;
  y: number;
}

interface FlowIssue {
  id: string;
  markerIndex: number | null;
  issue: string;
  location: MarkerPosition | null;
  isGeneral: boolean;
  engineId: string;
  imageIndex: number | null; // Which step/image this issue belongs to
}

interface FlowImageCarouselProps {
  images: string[]; // Can be storage paths or full URLs
  projectName: string;
  issues: FlowIssue[];
  currentSlideIndex: number;
  onSlideChange: (index: number) => void;
  hoveredIssueId: string | null;
  onMarkerHover: (issueId: string | null) => void;
  onMarkerClick?: (issueId: string) => void;
  highlightedIssueId: string | null;
  isExpired?: boolean;
  expiredTitle?: string;
  expiredTooltip?: string;
}

const FlowImageCarousel = ({
  images,
  projectName,
  issues,
  currentSlideIndex,
  onSlideChange,
  hoveredIssueId,
  onMarkerHover,
  onMarkerClick,
  highlightedIssueId,
  isExpired = false,
  expiredTitle = "Screenshot expired",
  expiredTooltip = "Screenshots are automatically deleted after 90 days to keep Qualia free for everyone. Your audit score and findings are still available.",
}: FlowImageCarouselProps) => {
  const { t } = useLanguage();
  const [signedUrls, setSignedUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Set to true if ANY slide fails to load — covers manual purges that happen
  // before the client-side retention age threshold kicks in.
  const [loadFailedFallback, setLoadFailedFallback] = useState(false);
  const pathsKey = storagePathsKey(images);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  useEffect(() => {
    setLoadFailedFallback(false);
  }, [pathsKey]);

  const showExpired = isExpired || loadFailedFallback;

  // Generate signed URLs for storage paths (key by path contents, not array identity — avoids reloads on audit poll).
  // Skip the network call entirely when the audit's screenshots have expired.
  useEffect(() => {
    if (isExpired) {
      setSignedUrls([]);
      setLoading(false);
      return;
    }
    const imgs = imagesRef.current;
    const generateSignedUrls = async () => {
      if (!imgs || imgs.length === 0) {
        setSignedUrls([]);
        setLoading(false);
        return;
      }

      const urls = await createScreenshotSignedUrls(imgs, 3600);
      setSignedUrls(urls);
      // createScreenshotSignedUrls substitutes "/placeholder.svg" on failure
      // (e.g. file was purged) — onError won't fire on a successful placeholder
      // load, so we detect the substitution here to trigger the expired card.
      if (urls.some((u) => u === "/placeholder.svg" || !u)) {
        setLoadFailedFallback(true);
      }
      setLoading(false);
    };

    void generateSignedUrls();
  }, [pathsKey, isExpired]);

  // Filter issues that belong to the current slide
  const currentSlideIssues = issues.filter(
    (issue) => 
      !issue.isGeneral && 
      issue.location !== null && 
      issue.imageIndex === currentSlideIndex
  );

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    const newIndex = currentSlideIndex > 0 ? currentSlideIndex - 1 : signedUrls.length - 1;
    onSlideChange(newIndex);
  }, [currentSlideIndex, signedUrls.length, onSlideChange]);

  const goToNext = useCallback(() => {
    const newIndex = currentSlideIndex < signedUrls.length - 1 ? currentSlideIndex + 1 : 0;
    onSlideChange(newIndex);
  }, [currentSlideIndex, signedUrls.length, onSlideChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrevious();
      if (e.key === "ArrowRight") goToNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevious, goToNext]);

  const handleMarkerActivate = (issueId: string) => {
    if (lightboxOpen) setLightboxOpen(false);
    onMarkerClick?.(issueId);
  };

  if (!images || images.length === 0) return null;

  if (showExpired) {
    return (
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <Badge variant="secondary" className="bg-primary/20 text-foreground border-primary/30">
            {t("flowAnalysis")}
          </Badge>
          <span className="ml-2 text-sm text-muted-foreground">
            {images.length} {images.length === 1 ? t("step") : t("steps")}
          </span>
        </div>
        <div className="relative aspect-video">
          <ExpiredScreenshot
            title={expiredTitle}
            tooltip={expiredTooltip}
            className="absolute inset-0"
          />
        </div>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">{t("project")}</p>
          <p className="text-sm font-medium">{projectName}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <div className="animate-pulse text-muted-foreground">Loading flow images...</div>
      </div>
    );
  }

  return (
    <>
      {/* Main Carousel Container */}
      <div className="glass rounded-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/20 text-foreground border-primary/30">
              {t("flowAnalysis")}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t("step")} {currentSlideIndex + 1} / {signedUrls.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("clickToZoom")}</span>
            <button
              onClick={() => setLightboxOpen(true)}
              className="p-1.5 rounded-lg hover:bg-surface-1 transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
        
        {/* Carousel Viewport */}
        <div className="relative">
          {/* Navigation Buttons */}
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
            aria-label="Previous step"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
            aria-label="Next step"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          {/* Image Container with Markers */}
          <div 
            className="relative cursor-zoom-in group"
            {...clickableProps(() => setLightboxOpen(true))}
            aria-label="Zoom image"
          >
            {/* Step Badge */}
            <Badge 
              className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-primary text-primary-foreground"
            >
              {t("step")} {currentSlideIndex + 1}
            </Badge>

            {/* Main Image */}
            <div className="flex justify-center p-4 bg-surface-1/50">
              <div className="relative">
                <img
                  src={signedUrls[currentSlideIndex]}
                  alt={`Step ${currentSlideIndex + 1}`}
                  className="max-h-[500px] w-auto object-contain rounded-lg border border-border"
                  onError={() => setLoadFailedFallback(true)}
                />
                <MarkerOverlay
                  currentSlideIssues={currentSlideIssues}
                  hoveredIssueId={hoveredIssueId}
                  highlightedIssueId={highlightedIssueId}
                  inLightbox={false}
                  onMarkerHover={onMarkerHover}
                  onMarkerActivate={handleMarkerActivate}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Step Navigation Dots */}
        <div className="p-4 border-t border-border flex items-center justify-center gap-2">
          {signedUrls.map((_, idx) => {
            const hasIssues = issues.some(
              (issue) => !issue.isGeneral && issue.imageIndex === idx
            );
            
            return (
              // eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: carousel dot with conditional width expansion (w-2 → w-6) and issue-indicator span child; Button primitive fixed dimensions break the dot animation
              <button
                key={idx}
                onClick={() => onSlideChange(idx)}
                className={cn(
                  "relative w-2 h-2 rounded-full transition-all",
                  idx === currentSlideIndex
                    ? "bg-primary w-6"
                    : "bg-muted-foreground/50 hover:bg-muted-foreground"
                )}
                aria-label={`Go to step ${idx + 1}`}
                aria-current={idx === currentSlideIndex ? "true" : undefined}
              >
                {/* Issue indicator dot */}
                {hasIssues && idx !== currentSlideIndex && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
        
        {/* Project Info Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">{t("project")}</p>
          <p className="text-sm font-medium">{projectName}</p>
        </div>
      </div>

      {/* Lightbox Modal */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-md border-border overflow-hidden flex flex-col">
          {/* Close button */}
          {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: lightbox close button absolute top-4 right-4 z-50 rounded-full bg-background/80; no aria-label; Button primitive clears absolute positioning context needed here */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-background/80 hover:bg-background transition-colors flex-shrink-0"
            aria-label="Close lightbox"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Image container with navigation - scrollable on short viewports */}
          <div className="relative w-full flex-1 min-h-0 flex items-center justify-center p-4 overflow-auto">
            {/* Navigation in lightbox */}
            <Button
              variant="outline"
              size="icon"
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full"
              aria-label="Previous step"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full"
              aria-label="Next step"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>

            <div className="relative max-w-full max-h-full min-h-0">
              <Badge 
                className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 bg-primary text-primary-foreground"
              >
                {t("step")} {currentSlideIndex + 1} / {signedUrls.length}
              </Badge>
              <img
                src={signedUrls[currentSlideIndex]}
                alt={`Step ${currentSlideIndex + 1} - Full View`}
                className="max-w-full max-h-full object-contain rounded-lg"
                onError={() => setLoadFailedFallback(true)}
              />
              <MarkerOverlay
                currentSlideIssues={currentSlideIssues}
                hoveredIssueId={hoveredIssueId}
                highlightedIssueId={highlightedIssueId}
                inLightbox
                onMarkerHover={onMarkerHover}
                onMarkerActivate={handleMarkerActivate}
              />
            </div>
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
};

export default FlowImageCarousel;
