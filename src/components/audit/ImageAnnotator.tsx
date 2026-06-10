import { useState, useRef, useEffect, useMemo } from "react";
import type { KeyboardEvent } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMarkerColor } from "@/lib/markerColors";
import { clickableProps } from "@/lib/a11y";
import { ExpiredScreenshot } from "./ExpiredScreenshot";
import { BoundingBoxOverlay } from "./BoundingBoxOverlay";

// Marker position computed from bounding box center (0-100 percentage)
interface MarkerPosition {
  x: number;
  y: number;
}

interface AnnotatedIssue {
  id: string;
  markerIndex: number | null;
  issue: string;
  location: MarkerPosition | null; // Computed center position for rendering
  isGeneral: boolean;
  engineId: string;
}

/**
 * T-079: optional per-issue rectangle overlay computed by the caller from
 * `resolveLayerIds(...)`. When present, the caller has already decided this
 * issue should render as a rectangle instead of (or in addition to) the
 * default center marker — typically because the LLM emitted a `layer_ids`
 * array that resolved to a precise pixel box via the Figma node map.
 */
export interface IssueRectOverlay {
  issueId: string;
  /** Rectangle in pixel coordinates of the original image. */
  rect: { x: number; y: number; w: number; h: number };
  color?: string;
  label?: string;
}

interface ImageAnnotatorProps {
  imageUrl: string;
  issues: AnnotatedIssue[];
  hoveredIssueId: string | null;
  onMarkerHover: (issueId: string | null) => void;
  onMarkerClick?: (issueId: string) => void;
  projectName?: string;
  /** Shown when the image fails to load (e.g. expired or missing) */
  loadErrorLabel?: string;
  /** When true, renders the retention-expired placeholder instead of attempting to load the image */
  isExpired?: boolean;
  expiredTitle?: string;
  expiredTooltip?: string;
  /**
   * T-079: optional per-issue rectangle overlays drawn on top of the image.
   * Rendered in addition to the existing center markers — the markers stay
   * so behavior is unchanged for callers that don't pass overlays.
   */
  rectOverlays?: IssueRectOverlay[];
}

interface MarkerOverlayProps {
  annotatedIssues: AnnotatedIssue[];
  hoveredIssueId: string | null;
  inLightbox: boolean;
  onMarkerHover: (issueId: string | null) => void;
  onMarkerActivate: (issueId: string) => void;
}

function MarkerOverlay({
  annotatedIssues,
  hoveredIssueId,
  inLightbox,
  onMarkerHover,
  onMarkerActivate,
}: MarkerOverlayProps) {
  return (
    <>
      {annotatedIssues.map((issue) => {
        const isHovered = hoveredIssueId === issue.id;
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
              isHovered && "z-40"
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
            {/* Pulse ring for hovered state */}
            {isHovered && (
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
                isHovered && "scale-125"
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

/**
 * T-079: render any caller-provided rectangle overlays. Each rect is in
 * PIXEL coordinates of the original image, so we need the image's natural
 * dimensions to normalise. Tracks via `naturalWidth/Height` on the rendered
 * <img>. Renders nothing until the image's natural size is known.
 */
function RectOverlayLayer({
  overlays,
  natural,
  hoveredIssueId,
}: {
  overlays: IssueRectOverlay[] | undefined;
  natural: { width: number; height: number } | null;
  hoveredIssueId: string | null;
}) {
  if (!overlays || overlays.length === 0 || !natural) return null;
  return (
    <>
      {overlays.map((o) => (
        <BoundingBoxOverlay
          key={`overlay-${o.issueId}`}
          rect={o.rect}
          imagePixelWidth={natural.width}
          imagePixelHeight={natural.height}
          color={hoveredIssueId === o.issueId ? "rgb(220, 38, 38)" /* red-600 emphasis */ : o.color}
          label={o.label}
        />
      ))}
    </>
  );
}

const ImageAnnotator = ({
  imageUrl,
  issues,
  hoveredIssueId,
  onMarkerHover,
  onMarkerClick,
  projectName,
  loadErrorLabel = "Screenshot couldn't be loaded. It may have expired or been removed.",
  isExpired = false,
  expiredTitle = "Screenshot expired",
  expiredTooltip = "Screenshots are automatically deleted after 90 days to keep Qualia free for everyone. Your audit score and findings are still available.",
  rectOverlays,
}: ImageAnnotatorProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // T-079: track the image's natural pixel dimensions for rect overlay math.
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadError(false);
    setNatural(null);
  }, [imageUrl]);

  // Filter to only show localized issues (non-general with valid location).
  // T-079: when an issue has a resolved layer-ids rectangle, override the
  // pin's position to the rect center (in image-natural pixels → percentages).
  // This gives pixel-perfect dot placement on the actual referenced element
  // instead of the LLM's drifting box_2d center. Boxes are NOT rendered —
  // the rect is used purely as a positioning override for the dot.
  const annotatedIssues = useMemo(() => {
    const base = issues.filter(
      (issue) => !issue.isGeneral && issue.location && issue.markerIndex !== null
    );
    if (!natural || !rectOverlays || rectOverlays.length === 0) return base;
    const byId = new Map(rectOverlays.map((o) => [o.issueId, o.rect]));
    return base.map((issue) => {
      const rect = byId.get(issue.id);
      if (!rect) return issue;
      return {
        ...issue,
        location: {
          x: ((rect.x + rect.w / 2) / natural.width) * 100,
          y: ((rect.y + rect.h / 2) / natural.height) * 100,
        },
      };
    });
  }, [issues, rectOverlays, natural]);

  const handleMarkerActivate = (issueId: string) => {
    if (lightboxOpen) setLightboxOpen(false);
    onMarkerClick?.(issueId);
  };

  // Project.tsx substitutes "/placeholder.svg" into the audit's screenshot_url
  // when createSignedUrl fails (file deleted). The <img> would load that
  // placeholder successfully, so onError never fires — detect it here.
  const showExpired = isExpired || imageUrl === "/placeholder.svg" || !imageUrl;

  if (showExpired) {
    return (
      <div className="glass rounded-xl overflow-hidden">
        <div className="relative aspect-video">
          <ExpiredScreenshot
            title={expiredTitle}
            tooltip={expiredTooltip}
            className="absolute inset-0"
          />
        </div>
        {projectName && (
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Project</p>
            <p className="text-sm font-medium">{projectName}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Main Image with Markers */}
      <div
        ref={containerRef}
        className="glass rounded-xl cursor-zoom-in group relative overflow-visible"
        {...clickableProps(() => setLightboxOpen(true))}
        aria-label="Zoom image"
      >
        {/* Zoom indicator */}
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-background/80 backdrop-blur-sm rounded-lg p-2">
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Image container with relative positioning for markers */}
        <div className="relative overflow-visible">
          {loadError ? (
            <div className="relative aspect-video">
              <ExpiredScreenshot
                title={expiredTitle}
                tooltip={loadErrorLabel}
                className="absolute inset-0 rounded-xl"
              />
            </div>
          ) : (
            <>
              <img
                src={imageUrl}
                alt="Audited Screenshot"
                className="w-full h-auto rounded-xl"
                onError={() => setLoadError(true)}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
                  }
                }}
              />
              <MarkerOverlay
                annotatedIssues={annotatedIssues}
                hoveredIssueId={hoveredIssueId}
                inLightbox={false}
                onMarkerHover={onMarkerHover}
                onMarkerActivate={handleMarkerActivate}
              />
            </>
          )}
        </div>

        {/* Project name footer */}
        {projectName && (
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Project</p>
            <p className="text-sm font-medium">{projectName}</p>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-md border-border overflow-hidden flex flex-col">
          {/* Close button */}
          {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: lightbox close button absolute top-4 right-4 z-50 rounded-full bg-background/80; no aria-label; Button primitive clears absolute positioning context needed for lightbox overlay */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-background/80 hover:bg-background transition-colors flex-shrink-0"
            aria-label="Close lightbox"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Image container - fits entirely within viewport, no scroll */}
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <div className="relative" style={{ maxWidth: '100%', maxHeight: 'calc(95vh - 2rem)' }}>
              {loadError ? (
                <div className="relative w-[min(60vw,500px)] aspect-video">
                  <ExpiredScreenshot
                    title={expiredTitle}
                    tooltip={loadErrorLabel}
                    className="absolute inset-0 rounded-xl"
                  />
                </div>
              ) : (
                <>
                  <img
                    src={imageUrl}
                    alt="Audited Screenshot - Full View"
                    className="block max-w-full max-h-[calc(95vh-2rem)] object-contain rounded-lg"
                    onError={() => setLoadError(true)}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        setNatural({ width: img.naturalWidth, height: img.naturalHeight });
                      }
                    }}
                  />
                  <MarkerOverlay
                    annotatedIssues={annotatedIssues}
                    hoveredIssueId={hoveredIssueId}
                    inLightbox
                    onMarkerHover={onMarkerHover}
                    onMarkerActivate={handleMarkerActivate}
                  />
                </>
              )}
            </div>
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageAnnotator;
