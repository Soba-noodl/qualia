import { useState, useEffect, useRef } from "react";
import { storagePathsKey } from "@/lib/storage-paths";
import { ZoomIn, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createScreenshotSignedUrls } from "@/services/storage.service";
import { getMarkerColor } from "@/lib/markerColors";
import { cn } from "@/lib/utils";
import { ExpiredScreenshot } from "./ExpiredScreenshot";

interface MarkerPosition {
  x: number;
  y: number;
}

interface StripIssue {
  id: string;
  markerIndex: number | null;
  location: MarkerPosition | null;
  imageIndex: number | null;
  isGeneral: boolean;
}

interface AutoCrawlThumbnailStripProps {
  images: string[];
  issues: StripIssue[];
  selectedIndex: number | null;
  onSelectImage: (index: number) => void;
  hoveredIssueId: string | null;
  highlightedIssueId: string | null;
  onMarkerClick?: (issueId: string) => void;
  isExpired?: boolean;
  expiredTitle?: string;
  expiredTooltip?: string;
}

const AutoCrawlThumbnailStrip = ({
  images,
  issues,
  selectedIndex,
  onSelectImage,
  hoveredIssueId,
  highlightedIssueId,
  onMarkerClick,
  isExpired = false,
  expiredTitle = "Screenshot expired",
  expiredTooltip = "Screenshots are automatically deleted after 90 days to keep Qualia free for everyone. Your audit score and findings are still available.",
}: AutoCrawlThumbnailStripProps) => {
  const [signedUrls, setSignedUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Set to true if ANY image fails to load — covers manual purges that happen
  // before the client-side retention age threshold kicks in.
  const [loadFailedFallback, setLoadFailedFallback] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const pathsKey = storagePathsKey(images);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Reset the load-error fallback whenever the image set changes.
  useEffect(() => {
    setLoadFailedFallback(false);
  }, [pathsKey]);

  const showExpired = isExpired || loadFailedFallback;

  useEffect(() => {
    if (isExpired) {
      setSignedUrls([]);
      setLoading(false);
      return;
    }
    const imgs = imagesRef.current;
    if (!imgs?.length) {
      setSignedUrls([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void createScreenshotSignedUrls(imgs, 3600).then((urls) => {
      setSignedUrls(urls);
      // When the underlying files have been purged, createSignedUrl fails and
      // the service substitutes "/placeholder.svg" — img onError never fires.
      // Detect that substitution explicitly so we still show the expired card.
      if (urls.some((u) => u === "/placeholder.svg" || !u)) {
        setLoadFailedFallback(true);
      }
      setLoading(false);
    });
  }, [pathsKey, isExpired]);

  // Scroll selected thumbnail into view
  useEffect(() => {
    if (selectedIndex === null || !stripRef.current) return;
    const el = stripRef.current.querySelector(`[data-thumb="${selectedIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ inline: "nearest", behavior: "smooth", block: "nearest" });
  }, [selectedIndex]);

  const issuesForImage = (idx: number) =>
    issues.filter((i) => i.imageIndex === idx && !i.isGeneral && i.markerIndex !== null);

  const markersForImage = (idx: number) =>
    issues.filter((i) => i.imageIndex === idx && !i.isGeneral && i.location);

  if (showExpired) {
    return (
      <div className="rounded-xl border border-border bg-surface-1/50 overflow-hidden">
        <div className="px-3 pt-3 pb-1">
          <span className="text-xs font-medium text-muted-foreground">
            {images.length} screens captured
          </span>
        </div>
        <div className="relative aspect-video">
          <ExpiredScreenshot
            title={expiredTitle}
            tooltip={expiredTooltip}
            className="absolute inset-0"
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface-1/50 p-4">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: Math.min(images.length, 8) }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[120px] aspect-[9/16] rounded-lg bg-surface-1 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const lightboxUrl = lightboxIndex !== null ? signedUrls[lightboxIndex] : null;
  const lightboxMarkers = lightboxIndex !== null ? markersForImage(lightboxIndex) : [];

  return (
    <>
      {/* Thumbnail strip */}
      <div className="rounded-xl border border-border bg-surface-1/50 overflow-hidden">
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {images.length} screens captured
          </span>
          {lightboxIndex !== null && (
            <span className="text-xs text-muted-foreground">
              Screen {lightboxIndex + 1} of {images.length}
            </span>
          )}
        </div>
        <div
          ref={stripRef}
          className="flex gap-2 overflow-x-auto px-3 pb-3 pt-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border"
        >
          {signedUrls.map((url, idx) => {
            const screenIssues = issuesForImage(idx);
            const isSelected = selectedIndex === idx || lightboxIndex === idx;
            const visiblePills = screenIssues.slice(0, 3);
            const overflow = screenIssues.length - 3;
            return (
              // eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: thumbnail selector with border-2 conditional shadow ring and style width prop (120px); image child; Button primitive fixed dimensions and overflow:hidden conflict with thumbnail layout
              <button
                key={idx}
                data-thumb={idx}
                type="button"
                onClick={() => {
                  onSelectImage(idx);
                  setLightboxIndex(idx);
                }}
                className={cn(
                  "relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all group aspect-[9/16] bg-white",
                  isSelected
                    ? "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.2)]"
                    : "border-border hover:border-primary/50"
                )}
                style={{ width: 120 }}
              >
                <img
                  src={url}
                  alt={`Screen ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover object-top block"
                  onError={() => setLoadFailedFallback(true)}
                />
                {/* Screen number */}
                <span className="absolute bottom-1 left-1 text-[10px] font-medium bg-black/60 text-white px-1 rounded">
                  {idx + 1}
                </span>
                {/* Issue number pills */}
                {screenIssues.length > 0 && (
                  <div className="absolute top-1 right-1 flex gap-0.5">
                    {visiblePills.map((issue) => (
                      <span
                        key={issue.id}
                        className="min-w-[14px] h-3.5 px-0.5 rounded-sm text-white text-[9px] font-bold flex items-center justify-center shadow"
                        style={{ backgroundColor: getMarkerColor(issue.markerIndex!) }}
                      >
                        {issue.markerIndex! + 1}
                      </span>
                    ))}
                    {overflow > 0 && (
                      <span className="min-w-[14px] h-3.5 px-0.5 rounded-sm bg-black/60 text-white text-[9px] font-bold flex items-center justify-center shadow">
                        +{overflow}
                      </span>
                    )}
                  </div>
                )}
                {/* Zoom hint on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => { if (!open) setLightboxIndex(null); }}>
        <DialogContent className="max-w-5xl w-full p-0 overflow-hidden bg-background border-border">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                Screen {lightboxIndex !== null ? lightboxIndex + 1 : "—"} of {images.length}
              </span>
              {lightboxIndex !== null && issuesForImage(lightboxIndex).length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-red-400 font-medium">
                  {issuesForImage(lightboxIndex).length} issue{issuesForImage(lightboxIndex).length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mr-9">
              <button
                type="button"
                disabled={lightboxIndex === null || lightboxIndex === 0}
                onClick={() => setLightboxIndex((i) => (i !== null ? i - 1 : null))}
                className="text-xs px-2.5 py-1 rounded border border-border hover:bg-surface-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <button
                type="button"
                disabled={lightboxIndex === null || lightboxIndex === images.length - 1}
                onClick={() => setLightboxIndex((i) => (i !== null ? i + 1 : null))}
                className="text-xs px-2.5 py-1 rounded border border-border hover:bg-surface-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Image with markers — scaled to fit viewport, centered */}
          {lightboxUrl && (
            <div className="relative bg-black/5 flex items-center justify-center p-4 min-h-[60vh] max-h-[75vh]">
              <div className="relative inline-block bg-white">
                <img
                  src={lightboxUrl}
                  alt={`Screen ${lightboxIndex !== null ? lightboxIndex + 1 : ""}`}
                  className="block max-w-full max-h-[70vh] w-auto h-auto"
                  onError={() => setLoadFailedFallback(true)}
                />
                {/* Bounding box markers */}
                {lightboxMarkers.map((issue) => {
                  if (!issue.location || issue.markerIndex === null) return null;
                  const color = getMarkerColor(issue.markerIndex);
                  const activateMarker = () => {
                    setLightboxIndex(null);
                    onMarkerClick?.(issue.id);
                  };
                  const interactiveProps = onMarkerClick
                    ? {
                        role: "button" as const,
                        tabIndex: 0,
                        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
                          e.stopPropagation();
                          activateMarker();
                        },
                        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            activateMarker();
                          }
                        },
                      }
                    : {};
                  return (
                    <div
                      key={issue.id}
                      aria-label={`Go to issue #${issue.markerIndex + 1}`}
                      className={cn(
                        "absolute w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-lg -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                        onMarkerClick ? "cursor-pointer" : "pointer-events-none"
                      )}
                      style={{
                        left: `${issue.location.x}%`,
                        top: `${issue.location.y}%`,
                        backgroundColor: color,
                      }}
                      title={`Go to issue #${issue.markerIndex + 1}`}
                      {...interactiveProps}
                    >
                      {issue.markerIndex + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thumbnail filmstrip at bottom */}
          <div className="flex gap-1.5 overflow-x-auto px-4 py-2 border-t border-border bg-surface-1/50">
            {signedUrls.map((url, idx) => (
              // eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: lightbox filmstrip dot with style width (56px) and image child; conditional opacity-60; Button primitive fixed dimensions would break filmstrip strip layout
              <button
                key={idx}
                type="button"
                onClick={() => setLightboxIndex(idx)}
                className={cn(
                  "flex-shrink-0 rounded overflow-hidden border transition-all aspect-[9/16] bg-white",
                  lightboxIndex === idx ? "border-primary" : "border-border/50 opacity-60 hover:opacity-100"
                )}
                style={{ width: 56 }}
              >
                <img
                  src={url}
                  alt={`Screen ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover object-top block"
                  onError={() => setLoadFailedFallback(true)}
                />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AutoCrawlThumbnailStrip;
