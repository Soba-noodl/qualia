import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseUrl, getPublishableKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

/* ── sRGB → linear (WCAG 2.1) ────────────────────────────── */
function sRGBToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function getLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBToLinear(r) + 0.7152 * sRGBToLinear(g) + 0.0722 * sRGBToLinear(b);
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function wcagLevel(ratio: number): string {
  if (ratio >= 7) return "AAA Pass";
  if (ratio >= 4.5) return "AA Pass";
  if (ratio >= 3) return "AA Large Text Only";
  return "AA Fail";
}

type RGB = [number, number, number];

/* ── Minimal PNG IDAT decoder (no WASM, low memory) ──────── */
function inflateRaw(compressed: Uint8Array): Uint8Array {
  // Use DecompressionStream (built-in in Deno) for zlib inflate
  const ds = new DecompressionStream("deflate");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];

  // We'll do this synchronously-ish via a promise
  writer.write(compressed.slice());
  writer.close();

  return new Uint8Array(0); // placeholder – we use the async version below
}

async function inflatePngData(compressed: Uint8Array): Promise<Uint8Array> {
  // PNG uses zlib (deflate with 2-byte header). Strip the zlib header for raw deflate.
  // Actually DecompressionStream("deflate") expects raw deflate, but zlib has a 2-byte header + 4-byte checksum.
  // Use "deflate" which in the web spec actually means zlib-wrapped deflate (confusingly).
  const ds = new DecompressionStream("deflate");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(compressed.slice());
  writer.close();

  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

function parsePng(bytes: Uint8Array): { width: number; height: number; pixels: Uint8Array } {
  // Validate PNG signature
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) throw new Error("Not a PNG");

  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset < bytes.length) {
    const len = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const data = bytes.subarray(offset + 8, offset + 8 + len);

    if (type === "IHDR") {
      width = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
      height = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + len;
  }

  // Storage SDK doesn't type .metadata
  return { width, height, pixels: new Uint8Array(0), _idatChunks: idatChunks, _colorType: colorType, _bitDepth: bitDepth } as unknown as { width: number; height: number; pixels: Uint8Array };
}

async function decodePngFull(bytes: Uint8Array): Promise<{ width: number; height: number; pixels: Uint8Array }> {
  // Storage SDK doesn't type .metadata
  const info = parsePng(bytes) as unknown as { width: number; height: number; pixels: Uint8Array; _idatChunks: Uint8Array[]; _colorType: number; _bitDepth: number };
  const { width, height, _idatChunks, _colorType, _bitDepth } = info;

  // Concatenate IDAT chunks
  let totalLen = 0;
  for (const c of _idatChunks) totalLen += c.length;
  const compressed = new Uint8Array(totalLen);
  let off = 0;
  for (const c of _idatChunks) { compressed.set(c, off); off += c.length; }

  // Decompress
  const raw = await inflatePngData(compressed);

  // Determine bytes per pixel
  const channels = _colorType === 6 ? 4 : _colorType === 2 ? 3 : _colorType === 4 ? 2 : 1;
  const bpp = channels * (_bitDepth / 8);
  const stride = Math.ceil(width * bpp) + 1; // +1 for filter byte

  // Unfilter and convert to RGBA
  const pixels = new Uint8Array(width * height * 4);
  const prevRow = new Uint8Array(width * channels);
  const curRow = new Uint8Array(width * channels);

  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    if (rowStart >= raw.length) break;
    const filter = raw[rowStart];
    const rowData = raw.subarray(rowStart + 1, rowStart + 1 + width * channels);

    // Copy to curRow
    for (let i = 0; i < rowData.length && i < curRow.length; i++) {
      curRow[i] = rowData[i];
    }

    // Apply filter
    for (let i = 0; i < width * channels; i++) {
      const a = i >= channels ? curRow[i - channels] : 0;
      const b = prevRow[i];
      const c_ = i >= channels ? prevRow[i - channels] : 0;

      switch (filter) {
        case 1: curRow[i] = (curRow[i] + a) & 0xff; break;
        case 2: curRow[i] = (curRow[i] + b) & 0xff; break;
        case 3: curRow[i] = (curRow[i] + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c_;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c_);
          curRow[i] = (curRow[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c_)) & 0xff;
          break;
        }
      }
    }

    // Write RGBA
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4;
      if (channels === 4) {
        pixels[di] = curRow[x * 4];
        pixels[di + 1] = curRow[x * 4 + 1];
        pixels[di + 2] = curRow[x * 4 + 2];
        pixels[di + 3] = curRow[x * 4 + 3];
      } else if (channels === 3) {
        pixels[di] = curRow[x * 3];
        pixels[di + 1] = curRow[x * 3 + 1];
        pixels[di + 2] = curRow[x * 3 + 2];
        pixels[di + 3] = 255;
      } else if (channels === 2) {
        pixels[di] = pixels[di + 1] = pixels[di + 2] = curRow[x * 2];
        pixels[di + 3] = curRow[x * 2 + 1];
      } else {
        pixels[di] = pixels[di + 1] = pixels[di + 2] = curRow[x];
        pixels[di + 3] = 255;
      }
    }

    prevRow.set(curRow);
  }

  return { width, height, pixels };
}

/* ── Decode JPEG via jpeg-js ─────────────────────────────── */
async function decodeJpeg(bytes: Uint8Array) {
  const jpegJs = await import("https://esm.sh/jpeg-js@0.4.4");
  const raw = jpegJs.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { pixels: raw.data as Uint8Array, width: raw.width, height: raw.height };
}

/* ── Fetch + decode any image ────────────────────────────── */
async function getImagePixels(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  if (isPng) return decodePngFull(bytes);
  if (isJpeg) return decodeJpeg(bytes);

  throw new Error("Unsupported image format (not PNG/JPEG)");
}

/* ── Downsample for speed ────────────────────────────────── */
const TARGET_W = 400; // reduced from 600 to save memory

function downsample(
  pixels: Uint8Array, w: number, h: number
): { px: Uint8Array; w: number; h: number } {
  if (w <= TARGET_W) return { px: pixels, w, h };
  const scale = TARGET_W / w;
  const nw = Math.floor(w * scale);
  const nh = Math.floor(h * scale);
  const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const si = (Math.floor(y / scale) * w + Math.floor(x / scale)) * 4;
      const di = (y * nw + x) * 4;
      out[di] = pixels[si];
      out[di + 1] = pixels[si + 1];
      out[di + 2] = pixels[si + 2];
      out[di + 3] = pixels[si + 3];
    }
  }
  return { px: out, w: nw, h: nh };
}

/* ── Extract dominant foreground & background colours ────── */
function extractColors(px: Uint8Array, w: number, h: number) {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const step = 4; // sample every 4th pixel (was 3)
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 128) continue;
      const qr = (px[i] >> 5) << 5;
      const qg = (px[i + 1] >> 5) << 5;
      const qb = (px[i + 2] >> 5) << 5;
      const key = `${qr},${qg},${qb}`;
      const e = buckets.get(key);
      if (e) { e.count++; e.r = (e.r + px[i]) / 2; e.g = (e.g + px[i + 1]) / 2; e.b = (e.b + px[i + 2]) / 2; }
      else buckets.set(key, { count: 1, r: px[i], g: px[i + 1], b: px[i + 2] });
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  if (!sorted.length) return { fg: [0, 0, 0] as RGB, bg: [255, 255, 255] as RGB };

  const bg = sorted[0];
  const bgL = getLuminance(bg.r, bg.g, bg.b);
  let bestFg = sorted[1] || sorted[0];
  let bestC = 0;
  for (let i = 1; i < Math.min(sorted.length, 20); i++) {
    const c = sorted[i];
    const cr = contrastRatio(bgL, getLuminance(c.r, c.g, c.b));
    if (cr > bestC) { bestC = cr; bestFg = c; }
  }
  return {
    fg: [Math.round(bestFg.r), Math.round(bestFg.g), Math.round(bestFg.b)] as RGB,
    bg: [Math.round(bg.r), Math.round(bg.g), Math.round(bg.b)] as RGB,
  };
}

/* ── Main handler ────────────────────────────────────────── */
serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getPublishableKey();
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const { image_url } = await req.json();
    if (!image_url) {
      return new Response(JSON.stringify({ error: "image_url is required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // SSRF guard: user can submit any URL; without validation an authenticated
    // user could probe `169.254.169.254` (cloud metadata) or other internal
    // hosts via this fetch. Restrict to signed URLs on our own Supabase host.
    // Same pattern as supabase/functions/analyze-ui/index.ts → validateScreenshotUrl().
    try {
      const parsed = new URL(image_url);
      if (parsed.protocol !== "https:") throw new Error("Only HTTPS URLs allowed");
      const supabaseHost = new URL(supabaseUrl).host;
      if (parsed.host !== supabaseHost) throw new Error("Only URLs from project storage allowed");
      if (!parsed.searchParams.has("token")) throw new Error("Only signed storage URLs allowed");
    } catch (validationError) {
      const msg = validationError instanceof Error ? validationError.message : "Invalid URL";
      return new Response(JSON.stringify({ error: "INVALID_IMAGE_URL", message: msg }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let fg: RGB, bg: RGB, note = "";

    try {
      const t0 = Date.now();
      const raw = await getImagePixels(image_url);
      const ds = downsample(raw.pixels, raw.width, raw.height);
      const colors = extractColors(ds.px, ds.w, ds.h);
      fg = colors.fg;
      bg = colors.bg;
      console.log(`Contrast: ${raw.width}x${raw.height} → ${ds.w}x${ds.h} in ${Date.now() - t0}ms`);
    } catch (err) {
      console.error("Image decode error:", err);
      fg = [51, 51, 51];
      bg = [255, 255, 255];
      note = "Image format not directly decodable. Using common UI defaults. Manual verification recommended.";
    }

    const fgL = getLuminance(...fg);
    const bgL = getLuminance(...bg);
    let ratio = contrastRatio(fgL, bgL);
    const validRatio = Number.isFinite(ratio) && ratio >= 1 && ratio <= 21;
    if (!validRatio) {
      ratio = NaN;
      if (!note) note = "Contrast could not be computed from image pixels. AI will estimate.";
    }

    return new Response(JSON.stringify({
      ratio: validRatio ? Math.round(ratio * 100) / 100 : null,
      level: validRatio ? wcagLevel(ratio) : "Unknown",
      foreground_hex: rgbToHex(...fg),
      background_hex: rgbToHex(...bg),
      foreground_luminance: Number.isFinite(fgL) ? Math.round(fgL * 1000) / 1000 : null,
      background_luminance: Number.isFinite(bgL) ? Math.round(bgL * 1000) / 1000 : null,
      ...(note && { note }),
    }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Contrast check error:", error);
    return new Response(JSON.stringify({
      error: "Failed to analyze contrast",
      ratio: null,
      level: "Unknown",
      note: "Could not process image. AI will estimate contrast.",
    }), { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
