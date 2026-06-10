/**
 * T-079: Pure presentational rectangle overlay.
 *
 * Renders a translucent border-box on top of an image. The parent MUST be
 * `position: relative` and the image must be the one this rectangle was
 * computed against (same intrinsic pixel dimensions OR the parent uses
 * `position: relative` with the image as the only / dominant child so
 * percentage-based positioning resolves consistently).
 *
 * `rect` is in PIXEL coordinates relative to the image's natural size; this
 * component normalises into percentages internally via the `imagePixelWidth` /
 * `imagePixelHeight` props so the overlay stays anchored as the image is
 * responsively scaled by CSS.
 *
 * This primitive is intentionally minimal: no marker dot, no number badge,
 * no hover handling. Compose it inside a richer overlay component (e.g. the
 * future grid-based overlay for T-078) when you need richer affordances.
 */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BoundingBoxOverlayProps {
  /** Rectangle in pixel coordinates of the original image. */
  rect: Rect;
  /** Intrinsic image width in pixels — used to convert `rect.x/w` to %. */
  imagePixelWidth: number;
  /** Intrinsic image height in pixels — used to convert `rect.y/h` to %. */
  imagePixelHeight: number;
  /** Border / fill color. Defaults to a primary-ish accent. */
  color?: string;
  /** Optional label rendered above the box. Kept short — long labels break layout. */
  label?: string;
  /** Optional class applied to the outer wrapper. */
  className?: string;
}

export function BoundingBoxOverlay({
  rect,
  imagePixelWidth,
  imagePixelHeight,
  color = "rgb(124, 58, 237)", // violet-600 — matches the existing marker palette
  label,
  className,
}: BoundingBoxOverlayProps) {
  if (
    !Number.isFinite(rect.x) || !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.w) || !Number.isFinite(rect.h) ||
    rect.w <= 0 || rect.h <= 0 ||
    imagePixelWidth <= 0 || imagePixelHeight <= 0
  ) {
    return null;
  }

  const leftPct = (rect.x / imagePixelWidth) * 100;
  const topPct = (rect.y / imagePixelHeight) * 100;
  const widthPct = (rect.w / imagePixelWidth) * 100;
  const heightPct = (rect.h / imagePixelHeight) * 100;

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        border: `2px solid ${color}`,
        backgroundColor: `${color}1F`, // ~12% alpha fill
        borderRadius: 4,
        boxSizing: "border-box",
        pointerEvents: "none",
      }}
    >
      {label && (
        <span
          style={{
            position: "absolute",
            top: -22,
            left: 0,
            padding: "2px 6px",
            fontSize: 11,
            lineHeight: 1.2,
            color: "white",
            backgroundColor: color,
            borderRadius: 4,
            whiteSpace: "nowrap",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export default BoundingBoxOverlay;
