// src/lib/imageUtils.ts

export const IMAGE_MAX_SIDE = 1200;
export const IMAGE_JPEG_QUALITY = 0.85;
export const CROP_MAX_SIDE = 400;

/**
 * Resize blob to IMAGE_MAX_SIDE on longest dimension, re-encode as JPEG.
 * Pass custom maxSide/quality to override defaults (used by crop helper).
 */
export function compressImageBlob(
  blob: Blob,
  maxSide = IMAGE_MAX_SIDE,
  quality = IMAGE_JPEG_QUALITY
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > maxSide || h > maxSide) {
        if (w >= h) { h = Math.round(h * (maxSide / w)); w = maxSide; }
        else { w = Math.round(w * (maxSide / h)); h = maxSide; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("toBlob failed"))),
        "image/jpeg", quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

/** Convert blob to `data:image/...;base64,...` string (full data URI). */
export function blobToBase64DataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Alias — kept for compatibility with exportAuditPdf.ts. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return blobToBase64DataUrl(blob);
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/** Maps box_2d [ymin, xmin, ymax, xmax] (0-1000 scale) to pixel rect on an image. */
export function box2dToPixelRect(
  box2d: [number, number, number, number],
  imgWidth: number,
  imgHeight: number
): { x: number; y: number; w: number; h: number } {
  const [ymin, xmin, ymax, xmax] = box2d;
  const x = Math.round((xmin / 1000) * imgWidth);
  const y = Math.round((ymin / 1000) * imgHeight);
  const w = Math.min(Math.round(((xmax - xmin) / 1000) * imgWidth), imgWidth - x);
  const h = Math.min(Math.round(((ymax - ymin) / 1000) * imgHeight), imgHeight - y);
  return { x, y, w, h };
}

/**
 * Crop the region described by box_2d from the original (un-annotated) blob.
 * Returns a compressed JPEG blob capped at CROP_MAX_SIDE.
 * Returns null if box_2d is null or the crop area is zero.
 */
export function cropIssueRegion(
  blob: Blob,
  box2d: [number, number, number, number] | null
): Promise<Blob | null> {
  if (!box2d) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { x, y, w, h } = box2dToPixelRect(box2d, img.width, img.height);
      if (w <= 0 || h <= 0) { resolve(null); return; }
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = w; cropCanvas.height = h;
      cropCanvas.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, w, h);
      cropCanvas.toBlob((cropped) => {
        if (!cropped) { reject(new Error("crop toBlob failed")); return; }
        compressImageBlob(cropped, CROP_MAX_SIDE, IMAGE_JPEG_QUALITY).then(resolve).catch(reject);
      }, "image/jpeg", 1.0);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

// ─── Annotation helpers ───────────────────────────────────────────────────────

const BADGE_RADIUS = 12;
const OUTLINE_WIDTH = 2.5;

export interface AnnotationIssue {
  box_2d: [number, number, number, number] | null; // [ymin, xmin, ymax, xmax] 0-1000
  markerIndex: number;
}

/** Returns the center coordinates for the badge placed outside the top-left corner. */
export function badgePosition(
  rect: { x: number; y: number; w: number; h: number },
  radius: number
): { cx: number; cy: number } {
  return {
    cx: Math.max(radius, rect.x - radius),
    cy: Math.max(radius, rect.y - radius),
  };
}

/**
 * Draw outline rectangles + numbered badges on the image for each issue.
 * Badge is placed OUTSIDE the bounding box so the element remains unobstructed.
 * Issues with box_2d = null are skipped.
 */
export function annotateImageWithOutlines(
  blob: Blob,
  issues: AnnotationIssue[]
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      // Import inline to avoid circular deps — getMarkerColor is pure
      const palette = [
        "#3b82f6", "#f59e0b", "#a855f7", "#f43f5e", "#10b981",
        "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
        "#14b8a6", "#ef4444", "#8b5cf6", "#0ea5e9", "#d946ef",
      ];
      const getColor = (i: number) => palette[i % palette.length];

      issues.forEach((issue) => {
        if (!issue.box_2d) return;
        const rect = box2dToPixelRect(issue.box_2d, img.width, img.height);
        if (rect.w <= 0 || rect.h <= 0) return;
        const color = getColor(issue.markerIndex);

        // Outline rectangle
        ctx.strokeStyle = color;
        ctx.lineWidth = OUTLINE_WIDTH;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

        // Badge circle outside top-left
        const { cx, cy } = badgePosition(rect, BADGE_RADIUS);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, BADGE_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Badge number
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${BADGE_RADIUS}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(issue.markerIndex + 1), cx, cy);
      });

      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("annotate toBlob failed"))),
        "image/jpeg", IMAGE_JPEG_QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}
