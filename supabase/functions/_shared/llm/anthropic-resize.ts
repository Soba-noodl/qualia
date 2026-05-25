// supabase/functions/_shared/llm/anthropic-resize.ts
//
// T-080: server-side image resize for multi-image Anthropic audits.
//
// Anthropic's API caps multi-image requests at 2000px per image (single-image
// requests go to 8000px). Figma plugin exports frames at 2x (~2880x1800), so
// every flow/prototype/auto audit on Anthropic with >1 image used to 400 with
// `image dimensions exceed max allowed size for many-image requests`.
//
// T-080.1: Supabase Storage's `transform` option is a Pro+ feature; on Free
// it returns HTTP 403 (FeatureNotEnabled). This module therefore uses
// `imagescript` (pure-TS, Deno-native) to resize in-process: download the
// untransformed source bytes from the `screenshots` bucket, decode + resize +
// re-encode JPEG in the worker, cache the resized JPEG in the `audit-resized`
// bucket, then return a fresh signed URL pointing at the cached object.
//
// Cache key: `<audit_id>/<frame_index>.jpg` so re-audits skip the round-trip.
//
// Risks handled here:
//   - SOF assertion still runs on the resized bytes as a belt-and-braces
//     check that the encoder produced a JPEG ≤ 2000px on the long side.
//   - Concurrent writers racing on the same path: upload uses `upsert: false`;
//     "already exists" failures are swallowed and we fall through to sign.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const SCREENSHOTS_BUCKET = "screenshots";
const RESIZED_BUCKET = "audit-resized";
const TRANSFORM_LONG_SIDE = 2000;
const TRANSFORM_QUALITY = 85;
const SIGNED_URL_TTL_SEC = 60 * 60; // 1 hour — comfortably covers retries + Anthropic call.

export interface ResizeForAnthropicArgs {
  supabase: SupabaseClient;
  auditId: string;
  frameIndex: number;
  sourcePath: string;
}

/**
 * Returns a signed URL pointing at a resized cache entry in `audit-resized`.
 * Idempotent: a second call with the same `(auditId, frameIndex)` returns the
 * cached object without re-fetching from the source bucket.
 */
export async function resizeForAnthropic(args: ResizeForAnthropicArgs): Promise<string> {
  const { supabase, auditId, frameIndex, sourcePath } = args;
  if (!auditId) throw new Error("resizeForAnthropic: auditId required");
  if (!sourcePath) throw new Error("resizeForAnthropic: sourcePath required");

  const destPath = `${auditId}/${frameIndex}.jpg`;

  // ── 1. Cache check ────────────────────────────────────────────────────────
  // If the resized object already exists, signing succeeds and we skip the
  // transform round-trip entirely. (createSignedUrl on a missing object
  // returns an error rather than throwing.)
  {
    const { data: signed } = await supabase.storage
      .from(RESIZED_BUCKET)
      .createSignedUrl(destPath, SIGNED_URL_TTL_SEC);
    if (signed?.signedUrl) {
      return signed.signedUrl;
    }
  }

  // ── 2. Miss path: download original + resize in-process ──────────────────
  // T-080.1: Supabase's `transform` option is Pro+ only and returns 403 on
  // Free. We download untransformed bytes and resize with imagescript.
  const { data: source, error: dlError } = await supabase.storage
    .from(SCREENSHOTS_BUCKET)
    .download(sourcePath);
  if (dlError || !source) {
    throw new Error(`resize: download failed for ${sourcePath}: ${dlError?.message ?? "no data"}`);
  }

  const sourceBuf = await source.arrayBuffer();
  const sourceBytes = new Uint8Array(sourceBuf);

  // ── 2a. Fast-path: source already within Anthropic's 2000 px cap ─────────
  // T-080.2: Figma 1× exports of typical mobile frames are ~393-1440 px on the
  // long side — well under the cap. Decoding + resizing + re-encoding +
  // uploading + signing burns ~1-2 s per frame for nothing. Read the PNG
  // header (24 bytes) cheaply and if both dimensions ≤ 2000 px, sign the
  // ORIGINAL path in `screenshots` and return that URL. Saves ~10-15 s on
  // an 11-frame Claude audit — the difference between fitting in the 150 s
  // Free-tier wall-clock and getting killed by it.
  const pngDims = readPngDimensions(sourceBytes);
  if (pngDims && pngDims.width <= TRANSFORM_LONG_SIDE && pngDims.height <= TRANSFORM_LONG_SIDE) {
    const { data: signed } = await supabase.storage
      .from(SCREENSHOTS_BUCKET)
      .createSignedUrl(sourcePath, SIGNED_URL_TTL_SEC);
    if (signed?.signedUrl) {
      return signed.signedUrl;
    }
    // If signing the original fails for any reason, fall through to the
    // resize+cache path so we still produce a usable URL.
  }

  const bytes = await resizeImageBytes(sourceBytes);

  // ── 3. Belt-and-braces: verify long side ≤ 2000px ────────────────────────
  // imagescript should always produce JPEG within bounds, but a corrupt
  // encode would still bust the Anthropic cap. Parse the JPEG SOF marker
  // (FFC0..FFCF except FFC4/FFC8/FFCC which are tables) to read dimensions
  // cheaply without a full decode.
  const dims = readJpegDimensions(bytes);
  if (!dims) {
    throw new Error(`resize: encoder did not return JPEG bytes for ${sourcePath}`);
  }
  const longSide = Math.max(dims.width, dims.height);
  if (longSide > TRANSFORM_LONG_SIDE) {
    throw new Error(
      `resize: post-resize long side ${longSide}px exceeds ${TRANSFORM_LONG_SIDE}px`,
    );
  }

  // ── 4. Upload to cache bucket ─────────────────────────────────────────────
  const { error: upError } = await supabase.storage
    .from(RESIZED_BUCKET)
    .upload(destPath, bytes, {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (upError) {
    // If a concurrent writer beat us to it, sign the existing object and move on.
    const msg = upError.message ?? "";
    const isAlreadyExists =
      msg.toLowerCase().includes("already exists") ||
      msg.toLowerCase().includes("duplicate") ||
      msg.toLowerCase().includes("the resource already exists");
    if (!isAlreadyExists) {
      throw new Error(`resize: upload failed for ${destPath}: ${msg}`);
    }
  }

  // ── 5. Sign and return ────────────────────────────────────────────────────
  const { data: signed, error: signError } = await supabase.storage
    .from(RESIZED_BUCKET)
    .createSignedUrl(destPath, SIGNED_URL_TTL_SEC);
  if (signError || !signed?.signedUrl) {
    throw new Error(`resize: sign failed for ${destPath}: ${signError?.message ?? "no signedUrl"}`);
  }
  return signed.signedUrl;
}

/**
 * Decode → (optionally) scale long side to TRANSFORM_LONG_SIDE → encode JPEG.
 *
 * imagescript@1.3.0 API (verified against deno.land/x/imagescript@1.3.0):
 *   - `Image.decode(bytes)` is async, returns `Promise<Image>`, accepts PNG/JPEG/TIFF.
 *   - `.resize(width, height, mode?)` returns a new `Image`. Either dimension
 *     may be `Image.RESIZE_AUTO` (= -1) to preserve aspect ratio. Default mode
 *     is `RESIZE_NEAREST_NEIGHBOR` — the only mode shipped in 1.3.0.
 *   - `.encodeJPEG(quality)` is async, returns `Promise<Uint8Array>`.
 *
 * Images already within bounds are still re-encoded as JPEG. This is
 * intentional: Figma exports are PNG, Anthropic charges by image size, and a
 * quality-85 JPEG is materially smaller than the source PNG even when no
 * resize happens.
 */
async function resizeImageBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const image = await Image.decode(bytes);
  const longSide = Math.max(image.width, image.height);

  let processed = image;
  if (longSide > TRANSFORM_LONG_SIDE) {
    if (image.width >= image.height) {
      processed = image.resize(TRANSFORM_LONG_SIDE, Image.RESIZE_AUTO);
    } else {
      processed = image.resize(Image.RESIZE_AUTO, TRANSFORM_LONG_SIDE);
    }
  }

  return await processed.encodeJPEG(TRANSFORM_QUALITY);
}

/**
 * Read the dimensions of a JPEG byte array by scanning for the SOF (Start Of
 * Frame) marker. Cheap (~tens of bytes scanned for a normal image), no decode.
 * Returns null when the bytes aren't a recognizable JPEG.
 */
/**
 * Read PNG image dimensions from the IHDR chunk (always at bytes 16-23 in a
 * valid PNG). Validates the 8-byte signature first so we don't misread JPEG
 * or other formats as PNG. Cheap — only 24 bytes inspected.
 *
 * PNG file structure (relevant prefix):
 *   bytes 0-7   : signature 89 50 4E 47 0D 0A 1A 0A
 *   bytes 8-11  : IHDR chunk length (always 13 for valid PNG)
 *   bytes 12-15 : "IHDR" (49 48 44 52)
 *   bytes 16-19 : width  (big-endian uint32)
 *   bytes 20-23 : height (big-endian uint32)
 *
 * Returns null when the bytes aren't a recognizable PNG.
 */
function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return null;
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) return null;
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4) return null;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null; // SOI

  let offset = 2;
  while (offset + 9 < bytes.length) {
    // Each segment marker starts with 0xFF; skip any fill bytes.
    if (bytes[offset] !== 0xff) return null;
    let marker = bytes[offset + 1];
    while (marker === 0xff && offset + 2 < bytes.length) {
      offset++;
      marker = bytes[offset + 1];
    }
    offset += 2;

    // Standalone markers (no length): SOI/EOI/RSTn. SOI already consumed.
    if (marker === 0xd8 || marker === 0xd9) return null;
    if (marker >= 0xd0 && marker <= 0xd7) continue;

    if (offset + 1 >= bytes.length) return null;
    const segLen = (bytes[offset] << 8) | bytes[offset + 1];
    if (segLen < 2) return null;

    // SOF0..SOF15, skipping DHT(C4), JPG(C8), DAC(CC).
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      // Segment layout: [len:2][precision:1][height:2][width:2][...]
      if (offset + 7 >= bytes.length) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return { width, height };
    }

    offset += segLen;
  }
  return null;
}
