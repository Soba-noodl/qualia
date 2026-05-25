import type PptxGenJS from "pptxgenjs";
import { stripCoordinateFromReportText } from "./stripReportCoordinateText";
import { exportEngineeringPptx } from "./exportEngPptx";
import { exportExecutivePptx } from "./exportExecPptx";
import type { AiReport, FlowIssueData } from "@/services/audit.service";
import { getMarkerColor } from "./markerColors";

// ─── Exported types ───────────────────────────────────────────────────────────

export type ExportPreset = "executive" | "engineering_lead";

export interface LocalizedIssue {
  markerIndex: number;
  x: number;
  y: number;
  imageIndex: number | null;
  issue: string;
  engineId: string;
}

export interface ExecutiveReframedContent {
  risk_level: "High" | "Medium" | "Low";
  summary: string;
  top3_risks: Array<{ title: string; business_impact: string }>;
  recommendation: string;
}

// Re-export FlowIssueData as FindingItem alias so existing usages in this file compile.
type FindingItem = FlowIssueData;

export interface ExportAuditPptxParams {
  aiReport: AiReport;
  projectContext: { name: string; mission: string; constraints?: string | null };
  date: string;
  isFlow: boolean;
  isPrototype?: boolean;
  preset: ExportPreset;
  uiLang?: "en" | "it";
  screenGoal?: string | null;
  reauditScoreDelta?: number | null;
  reauditExplanation?: string | null;
  screenshotBlob?: Blob | null;
  flowImageBlobs?: (Blob | null)[];
  contextImageBlobs?: (Blob | null)[];
  localizedIssues?: LocalizedIssue[];
  executiveContent?: ExecutiveReframedContent | null;
}

// ─── Color palette ────────────────────────────────────────────────────────────
// Tech-professional theme: deep navy dominant, violet accent, clean whites

const C = {
  // Dark backgrounds
  coverBg:      "0D1B2A",   // very dark navy — cover slides
  navyBand:     "1B3A5C",   // header band on content slides
  navyDark:     "122840",   // darker navy for accents

  // Light backgrounds
  slideBg:      "F7F8FA",   // near-white — content slides
  cardBg:       "FFFFFF",   // pure white cards
  surfaceBg:    "EEF1F5",   // subtle card tint

  // Accent
  violet:       "6D28D9",   // Qualia violet
  violetLight:  "C4B5FD",   // light violet (on dark bg)
  violetXLight: "F0EBFF",   // very light (tinted boxes on white bg)

  // Text
  white:        "FFFFFF",
  textPrimary:  "0D1B2A",
  textBody:     "374151",
  textMuted:    "6B7280",
  textLight:    "9CA3AF",

  // Risk
  riskHigh:     "DC2626",
  riskHighBg:   "FEF2F2",
  riskMed:      "D97706",
  riskMedBg:    "FFFBEB",
  riskLow:      "059669",
  riskLowBg:    "ECFDF5",

  // Misc
  ruleLine:     "E2E6ED",
};

// ─── Dark theme constants (Engineering) ──────────────────────────────────────

const CD = {
  bg:          "000000",   // pure black
  card:        "1F2937",   // dark card / callout background
  badgeBg:     "1E3A8A",   // deep blue badge
  cyan:        "7DD3FC",   // light cyan heading
  cyanBright:  "22D3EE",   // bright cyan
  cyanBorder:  "06B6D4",   // medium cyan (callout left border)
  white:       "FFFFFF",
  textLight:   "E5E7EB",   // light gray body
  textMuted:   "9CA3AF",   // muted text
  textDim:     "6B7280",   // dim footer text
  green:       "10B981",   // PASS
  red:         "EF4444",   // FAIL
  amber:       "F59E0B",   // warning
  // Mesh gradient blobs (cover left panel)
  meshPurple:  "7C3AED",
  meshCyan:    "06B6D4",
  meshPink:    "EC4899",
  meshOrange:  "F97316",
};

// ─── Engineering slide chrome (dark, minimal) ─────────────────────────────────

function engChrome(slide: PptxGenJS.Slide, label: string) {
  slide.background = { color: CD.bg };
  slide.addText(`Qualia  ·  ${label}`, {
    x: ML, y: FOOTER_Y, w: CW, h: 0.28,
    fontFace: F.body, fontSize: 7,
    color: CD.textDim,
  });
}

// ─── Typography ───────────────────────────────────────────────────────────────

const F = {
  heading: "Trebuchet MS",
  body:    "Calibri",
};

// ─── Layout constants ─────────────────────────────────────────────────────────

const SW = 10;    // slide width (in)
const SH = 7.5;   // slide height (in)
const ML = 0.5;   // left margin
const MR = 0.5;   // right margin
const CW = SW - ML - MR;   // content width = 9.0"

const BAND_H   = 0.62;  // nav band height
const CONT_TOP = 0.78;  // content area starts
const FOOTER_Y = 7.18;  // footer text Y

// ─── Image helpers ────────────────────────────────────────────────────────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getAspectRatio(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = () => resolve(16 / 9);
    img.src = dataUrl;
  });
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function px(hex: string): string { return hex.replace(/^#/, ""); }
function tr(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + "\u2026" : s; }

function engineLabel(id: string): string {
  return ({ system_logic: "Logic", heuristic: "Heuristic", cognitive: "Cognitive", interaction: "Interaction", accessibility: "Accessibility" } as Record<string, string>)[id] ?? id;
}

function riskFg(level: string): string {
  return level === "High" ? C.riskHigh : level === "Medium" ? C.riskMed : C.riskLow;
}

function riskBg(level: string): string {
  return level === "High" ? C.riskHighBg : level === "Medium" ? C.riskMedBg : C.riskLowBg;
}

function verdictFg(v: string): string {
  return v === "BLOCKER" ? C.riskHigh : v === "FRICTION" ? C.riskMed : C.riskLow;
}

// ─── Slide chrome ─────────────────────────────────────────────────────────────

/** Navy header band + footer text. Used on all non-cover slides. NO accent lines. */
function chrome(pres: PptxGenJS, slide: PptxGenJS.Slide, title: string, label: string) {
  // Navy band
  slide.background = { color: C.slideBg };
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SW, h: BAND_H,
    fill: { color: C.navyBand },
    line: { type: "none" },
  });

  // Title in band
  slide.addText(title, {
    x: ML, y: 0, w: 7.5, h: BAND_H,
    fontFace: F.heading, fontSize: 19, bold: true,
    color: C.white, valign: "middle",
  });

  // Preset label — top right of band, leave 1.5" gap for any overlay badges
  slide.addText(label, {
    x: 0, y: 0, w: 7.2, h: BAND_H,
    fontFace: F.heading, fontSize: 8, bold: true,
    color: C.violetLight, align: "right", valign: "middle",
    charSpacing: 1.5,
  });

  // Footer
  slide.addText("Qualia Audit", {
    x: ML, y: FOOTER_Y, w: CW, h: 0.28,
    fontFace: F.body, fontSize: 7,
    color: C.textLight,
  });
}

// ─── Number badge (shared visual motif) ──────────────────────────────────────

function numBadge(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  num: number | string,
  x: number,
  y: number,
  size: number,
  bgColor: string,
  fontSize = 9
) {
  slide.addText(String(num), {
    shape: pres.ShapeType.ellipse,
    x, y, w: size, h: size,
    fill: { color: bgColor },
    line: { type: "none" },
    color: C.white,
    fontFace: F.heading, fontSize, bold: true,
    align: "center", valign: "middle",
  });
}

// ─── Pin overlay on image ─────────────────────────────────────────────────────

function drawPins(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  pins: LocalizedIssue[],
  imgX: number, imgY: number, imgW: number, imgH: number
) {
  const r = 0.12;
  for (const pin of pins) {
    const cx = imgX + (imgW * pin.x) / 100;
    const cy = imgY + (imgH * pin.y) / 100;
    slide.addText(String(pin.markerIndex + 1), {
      shape: pres.ShapeType.ellipse,
      x: cx - r, y: cy - r, w: r * 2, h: r * 2,
      fill: { color: px(getMarkerColor(pin.markerIndex)) },
      line: { color: C.white, width: 0.6 },
      color: C.white,
      fontFace: F.heading, fontSize: 6.5, bold: true,
      align: "center", valign: "middle",
    });
  }
}

// ─── Screenshot + legend slide ────────────────────────────────────────────────

async function addScreenSlide(
  pres: PptxGenJS,
  blob: Blob,
  pins: LocalizedIssue[],
  title: string,
  label: string
): Promise<PptxGenJS.Slide> {
  const slide = pres.addSlide();
  chrome(pres, slide, title, label);

  const dataUrl = await blobToDataUrl(blob);
  const ar = await getAspectRatio(dataUrl);

  const hasLegend = pins.length > 0;
  const imgW = hasLegend ? 5.4 : CW;
  const maxH = FOOTER_Y - CONT_TOP - 0.1;
  const imgH = Math.min(imgW / ar, maxH);
  const imgX = ML;
  const imgY = CONT_TOP;

  // Drop shadow illusion using a slightly offset dark rect
  slide.addShape(pres.ShapeType.rect, {
    x: imgX + 0.06, y: imgY + 0.06, w: imgW, h: imgH,
    fill: { color: "C8D0DC" },
    line: { type: "none" },
  });

  slide.addImage({ data: dataUrl, x: imgX, y: imgY, w: imgW, h: imgH });

  if (hasLegend) drawPins(pres, slide, pins, imgX, imgY, imgW, imgH);

  // Legend column
  if (hasLegend) {
    const legX = ML + imgW + 0.22;
    const legW = SW - legX - MR;
    let ly = imgY;

    // Column header
    slide.addText("ISSUES", {
      x: legX, y: ly, w: legW, h: 0.26,
      fontFace: F.heading, fontSize: 8, bold: true,
      color: C.textMuted, charSpacing: 1.5,
    });
    ly += 0.3;

    const dotD = 0.22;
    const ITEM_GAP = 0.1;

    for (const pin of pins) {
      const textH = 0.38;
      const itemH = textH + ITEM_GAP;
      if (ly + itemH > FOOTER_Y - 0.05) break;

      // Colored dot with number
      numBadge(pres, slide, pin.markerIndex + 1, legX, ly + 0.08, dotD, px(getMarkerColor(pin.markerIndex)), 7);

      // Issue title + engine
      slide.addText([
        {
          text: tr(stripCoordinateFromReportText(pin.issue), 52) + "\n",
          options: { bold: true, fontSize: 8, color: C.textPrimary, breakLine: false },
        },
        {
          text: engineLabel(pin.engineId).toUpperCase(),
          options: { fontSize: 6.5, color: C.textLight, bold: true, charSpacing: 0.5 },
        },
      ], {
        x: legX + dotD + 0.1, y: ly, w: legW - dotD - 0.12, h: textH,
        fontFace: F.body,
        valign: "top",
      });

      ly += itemH;
    }
  }

  return slide;
}

// ─── EXECUTIVE slides ─────────────────────────────────────────────────────────

function addExecCover(pres: PptxGenJS, p: ExportAuditPptxParams) {
  const slide = pres.addSlide();
  slide.background = { color: C.coverBg };

  const { executiveContent, projectContext, date } = p;

  // Top-left violet accent bar
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.08, h: SH,
    fill: { color: C.violet },
    line: { type: "none" },
  });

  // "EXECUTIVE BRIEF" label
  slide.addText("EXECUTIVE BRIEF", {
    x: 0.35, y: 1.4, w: CW + MR, h: 0.35,
    fontFace: F.heading, fontSize: 9, bold: true,
    color: C.violetLight, charSpacing: 3,
  });

  // Project name — hero
  slide.addText(projectContext.name, {
    x: 0.35, y: 1.82, w: 8.8, h: 2.0,
    fontFace: F.heading, fontSize: 44, bold: true,
    color: C.white,
    shrinkText: true,
  });

  // Date
  slide.addText(date, {
    x: 0.35, y: 3.9, w: 5, h: 0.32,
    fontFace: F.body, fontSize: 12,
    color: C.textLight,
  });

  // Risk badge — colored pill
  if (executiveContent) {
    const fg = riskFg(executiveContent.risk_level);
    slide.addText(`${executiveContent.risk_level.toUpperCase()} RISK`, {
      shape: pres.ShapeType.roundRect,
      x: 0.35, y: 4.35, w: 1.9, h: 0.52,
      fill: { color: fg },
      line: { type: "none" },
      color: C.white,
      fontFace: F.heading, fontSize: 13, bold: true,
      align: "center", valign: "middle",
    });
  } else {
    // Fallback: score badge
    slide.addText(`Score: ${p.aiReport.score}/100`, {
      shape: pres.ShapeType.roundRect,
      x: 0.35, y: 4.35, w: 2.2, h: 0.52,
      fill: { color: C.violet },
      line: { type: "none" },
      color: C.white,
      fontFace: F.heading, fontSize: 13, bold: true,
      align: "center", valign: "middle",
    });
  }

  // Bottom credit
  slide.addText("Generated by Qualia", {
    x: 0.35, y: SH - 0.5, w: CW, h: 0.28,
    fontFace: F.body, fontSize: 8,
    color: C.textLight,
  });
}

function addExecOverview(pres: PptxGenJS, p: ExportAuditPptxParams) {
  if (!p.executiveContent) return;
  const { executiveContent, projectContext } = p;

  const slide = pres.addSlide();
  chrome(pres, slide, "Overview", "Executive Brief");

  // Left violet accent strip
  slide.addShape(pres.ShapeType.rect, {
    x: ML, y: CONT_TOP, w: 0.06, h: 3.6,
    fill: { color: C.violet },
    line: { type: "none" },
  });

  // Summary text — large, readable
  slide.addText(executiveContent.summary, {
    x: ML + 0.24, y: CONT_TOP, w: CW - 0.26, h: 3.6,
    fontFace: F.body, fontSize: 15,
    color: C.textBody, lineSpacingMultiple: 1.55,
    valign: "middle",
  });

  // Context block at bottom — tinted surface
  slide.addShape(pres.ShapeType.rect, {
    x: ML, y: CONT_TOP + 3.8, w: CW, h: 0.78,
    fill: { color: C.surfaceBg },
    line: { color: C.ruleLine, width: 0.5 },
  });
  slide.addText([
    { text: "Product:  ", options: { bold: true, color: C.textMuted, fontSize: 9 } },
    { text: projectContext.mission, options: { color: C.textBody, fontSize: 9 } },
  ], {
    x: ML + 0.2, y: CONT_TOP + 3.88, w: CW - 0.4, h: 0.62,
    fontFace: F.body, valign: "middle",
  });
}

function addExecRisks(pres: PptxGenJS, p: ExportAuditPptxParams) {
  if (!p.executiveContent) return;
  const { executiveContent } = p;
  const risks = executiveContent.top3_risks.slice(0, 3);
  const fg = riskFg(executiveContent.risk_level);
  const bg = riskBg(executiveContent.risk_level);

  const slide = pres.addSlide();
  chrome(pres, slide, "Key Business Risks", "Executive Brief");

  const CARD_H = 1.72;
  const CARD_GAP = 0.2;
  const total = risks.length * CARD_H + (risks.length - 1) * CARD_GAP;
  const startY = CONT_TOP + ((FOOTER_Y - CONT_TOP - total) / 2);

  risks.forEach((risk, i) => {
    const cardY = startY + i * (CARD_H + CARD_GAP);

    // Card background
    slide.addShape(pres.ShapeType.rect, {
      x: ML, y: cardY, w: CW, h: CARD_H,
      fill: { color: C.cardBg },
      line: { color: C.ruleLine, width: 0.5 },
    });

    // Thick left border
    slide.addShape(pres.ShapeType.rect, {
      x: ML, y: cardY, w: 0.07, h: CARD_H,
      fill: { color: fg },
      line: { type: "none" },
    });

    // Big number — visual anchor
    slide.addText(String(i + 1), {
      x: ML + 0.18, y: cardY, w: 1.0, h: CARD_H,
      fontFace: F.heading, fontSize: 52, bold: true,
      color: bg,
      align: "center", valign: "middle",
    });
    // Number foreground on top (layered)
    slide.addText(String(i + 1), {
      x: ML + 0.18, y: cardY, w: 1.0, h: CARD_H,
      fontFace: F.heading, fontSize: 44, bold: true,
      color: fg,
      align: "center", valign: "middle",
    });

    // Title
    slide.addText(risk.title, {
      x: ML + 1.3, y: cardY + 0.18, w: CW - 1.45, h: 0.45,
      fontFace: F.heading, fontSize: 13, bold: true,
      color: C.textPrimary, valign: "bottom",
    });

    // Impact
    slide.addText(risk.business_impact, {
      x: ML + 1.3, y: cardY + 0.65, w: CW - 1.45, h: 0.9,
      fontFace: F.body, fontSize: 11,
      color: C.textBody, lineSpacingMultiple: 1.3, valign: "top",
    });
  });
}

function addExecRecommendation(pres: PptxGenJS, p: ExportAuditPptxParams) {
  if (!p.executiveContent) return;
  const { executiveContent } = p;

  const slide = pres.addSlide();
  chrome(pres, slide, "Recommendation", "Executive Brief");

  // Full-width tinted recommendation box
  slide.addShape(pres.ShapeType.rect, {
    x: ML, y: CONT_TOP, w: CW, h: 4.4,
    fill: { color: C.violetXLight },
    line: { color: C.violet, width: 0.5 },
  });

  // Large open quote mark — visual element
  slide.addText("\u201C", {
    x: ML + 0.2, y: CONT_TOP + 0.05, w: 0.8, h: 0.9,
    fontFace: "Georgia", fontSize: 60, bold: true,
    color: C.violetLight,
    valign: "top",
  });

  // Recommendation text
  slide.addText(executiveContent.recommendation, {
    x: ML + 0.35, y: CONT_TOP + 0.7, w: CW - 0.6, h: 3.4,
    fontFace: F.body, fontSize: 16, italic: true,
    color: C.violet,
    lineSpacingMultiple: 1.7, valign: "top",
  });

  // One Big Thing as supporting note
  slide.addText([
    { text: "Core finding:  ", options: { bold: true, color: C.textMuted, fontSize: 9 } },
    { text: tr(p.aiReport.one_big_thing, 120), options: { color: C.textBody, fontSize: 9 } },
  ], {
    x: ML, y: CONT_TOP + 4.6, w: CW, h: 0.4,
    fontFace: F.body,
  });
}

async function addExecVisual(pres: PptxGenJS, p: ExportAuditPptxParams) {
  const blob = (p.flowImageBlobs && p.flowImageBlobs[0]) ?? p.screenshotBlob;
  if (!blob) return;
  const pins = (p.localizedIssues ?? []).filter(pin => pin.imageIndex === null || pin.imageIndex === 0);
  await addScreenSlide(pres, blob, pins, "Visual Overview", "Executive Brief");
}

// ─── ENGINEERING LEAD slides ──────────────────────────────────────────────────

/**
 * Cover: gradient mesh left panel + content right panel.
 * LEFT (~44%): organic colored ellipses approximate a gradient mesh.
 * RIGHT (~56%): black — QUALIA wordmark, score, sub-score cards.
 */
function addEngCover(pres: PptxGenJS, p: ExportAuditPptxParams) {
  const slide = pres.addSlide();
  slide.background = { color: CD.bg };

  const { aiReport, projectContext, date, isFlow } = p;
  const SPLIT = 4.4;  // left panel ends here

  // ── Left panel: gradient mesh (overlapping colored ellipses) ──
  const blobs = [
    { x: -0.6, y: -0.8, w: 3.4, h: 3.4, color: CD.meshPurple, t: 52 },
    { x:  0.8, y:  2.0, w: 3.2, h: 3.2, color: CD.meshCyan,   t: 58 },
    { x: -0.4, y:  3.8, w: 3.0, h: 3.0, color: CD.meshPink,   t: 54 },
    { x:  1.8, y:  0.4, w: 2.6, h: 2.6, color: CD.meshOrange, t: 62 },
    { x:  0.5, y:  4.8, w: 2.6, h: 2.6, color: CD.meshPurple, t: 68 },
    { x:  2.4, y:  2.4, w: 2.0, h: 2.0, color: CD.meshCyan,   t: 70 },
  ];
  for (const b of blobs) {
    slide.addShape(pres.ShapeType.ellipse, {
      x: b.x, y: b.y, w: b.w, h: b.h,
      fill: { color: b.color, transparency: b.t },
      line: { type: "none" },
    });
  }

  // Left panel footer
  slide.addText("Powered by Qualia", {
    x: 0.38, y: SH - 0.46, w: SPLIT - 0.5, h: 0.26,
    fontFace: F.body, fontSize: 8.5, bold: true,
    color: CD.white,
  });

  // ── Right panel content ──
  const RX = SPLIT + 0.35;
  const RW = SW - RX - 0.3;

  // "QUALIA" large cyan wordmark
  slide.addText("QUALIA", {
    x: RX, y: 0.5, w: RW, h: 0.58,
    fontFace: F.heading, fontSize: 38, bold: true,
    color: CD.cyan,
  });

  // Audit type badge
  slide.addText(isFlow ? "ENGINEERING  ·  FLOW" : "ENGINEERING REPORT", {
    shape: pres.ShapeType.roundRect,
    x: RX, y: 1.22, w: RW, h: 0.36,
    fill: { color: CD.badgeBg },
    line: { type: "none" },
    color: CD.cyan,
    fontFace: F.heading, fontSize: 7.5, bold: true,
    align: "center", valign: "middle", charSpacing: 1,
  });

  // Project name
  slide.addText(projectContext.name, {
    x: RX, y: 1.74, w: RW, h: 1.5,
    fontFace: F.heading, fontSize: 26, bold: true,
    color: CD.white, lineSpacingMultiple: 1.1,
    valign: "middle", shrinkText: true,
  });

  // Date
  slide.addText(date, {
    x: RX, y: 3.38, w: RW, h: 0.3,
    fontFace: F.body, fontSize: 9.5, color: CD.textMuted,
  });

  // Score — large number
  slide.addText(String(aiReport.score), {
    x: RX, y: 3.85, w: 1.5, h: 1.1,
    fontFace: F.heading, fontSize: 64, bold: true,
    color: CD.white, align: "left",
  });
  slide.addText("/100", {
    x: RX + 1.25, y: 4.42, w: 1.0, h: 0.38,
    fontFace: F.body, fontSize: 13,
    color: CD.textMuted, valign: "bottom",
  });
  slide.addText("OVERALL SCORE", {
    x: RX, y: 4.95, w: RW, h: 0.24,
    fontFace: F.heading, fontSize: 7, bold: true,
    color: CD.textMuted, charSpacing: 2,
  });

  // Sub-score cards (2×2 grid)
  const ss = aiReport.sub_scores;
  if (ss) {
    const items = [
      { label: "Logic",       value: ss.system_logic_score },
      { label: "Heuristic",   value: ss.heuristic_score },
      { label: "Cognitive",   value: ss.cognitive_score },
      { label: "Interaction", value: ss.interaction_score },
    ].filter(s => s.value != null);

    const cardW = (RW - 0.12) / 2;
    const cardH = 0.6;
    items.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = RX + col * (cardW + 0.12);
      const cy = 5.32 + row * (cardH + 0.1);
      if (cy + cardH > SH - 0.05) return;
      slide.addShape(pres.ShapeType.rect, {
        x: cx, y: cy, w: cardW, h: cardH,
        fill: { color: CD.card },
        line: { type: "none" },
      });
      // Cyan top border
      slide.addShape(pres.ShapeType.rect, {
        x: cx, y: cy, w: cardW, h: 0.04,
        fill: { color: CD.cyanBorder },
        line: { type: "none" },
      });
      slide.addText(String(s.value), {
        x: cx, y: cy + 0.06, w: cardW, h: 0.34,
        fontFace: F.heading, fontSize: 18, bold: true,
        color: CD.white, align: "center",
      });
      slide.addText(s.label.toUpperCase(), {
        x: cx, y: cy + 0.38, w: cardW, h: 0.18,
        fontFace: F.heading, fontSize: 6.5, bold: true,
        color: CD.cyan, align: "center", charSpacing: 0.5,
      });
    });
  }
}

/**
 * Key Findings: left OBT text + right context box + bottom score metrics.
 */
function addEngOBT(pres: PptxGenJS, p: ExportAuditPptxParams) {
  const slide = pres.addSlide();
  engChrome(slide, "Engineering Report");

  const LCOL_W = CW * 0.70;
  const RCOL_X = ML + LCOL_W + 0.22;
  const RCOL_W = CW - LCOL_W - 0.22;

  // Heading
  slide.addText("KEY FINDINGS", {
    x: ML, y: 0.32, w: LCOL_W, h: 0.4,
    fontFace: F.heading, fontSize: 10, bold: true,
    color: CD.cyan, charSpacing: 3,
  });

  // CORE ISSUE badge
  slide.addText("CORE ISSUE", {
    shape: pres.ShapeType.roundRect,
    x: ML, y: 0.85, w: 1.52, h: 0.33,
    fill: { color: CD.badgeBg },
    line: { type: "none" },
    color: CD.cyan,
    fontFace: F.heading, fontSize: 7.5, bold: true,
    align: "center", valign: "middle",
  });

  // OBT text — large, readable
  slide.addText(p.aiReport.one_big_thing, {
    x: ML, y: 1.3, w: LCOL_W, h: 3.2,
    fontFace: F.body, fontSize: 14,
    color: CD.textLight, lineSpacingMultiple: 1.65,
    valign: "top",
  });

  // Bottom score metrics row
  const ss = p.aiReport.sub_scores;
  const METRIC_Y = FOOTER_Y - 1.05;
  const items = [
    { label: "Logic",       value: ss?.system_logic_score },
    { label: "Heuristic",   value: ss?.heuristic_score },
    { label: "Cognitive",   value: ss?.cognitive_score },
    { label: "Interaction", value: ss?.interaction_score },
  ].filter(s => s.value != null);

  if (items.length > 0) {
    const metricW = (CW - 0.3 * (items.length - 1)) / items.length;
    items.slice(0, 4).forEach((s, i) => {
      const mx = ML + i * (metricW + 0.3);
      slide.addShape(pres.ShapeType.rect, {
        x: mx, y: METRIC_Y, w: metricW, h: 0.88,
        fill: { color: CD.card },
        line: { type: "none" },
      });
      slide.addShape(pres.ShapeType.rect, {
        x: mx, y: METRIC_Y, w: metricW, h: 0.05,
        fill: { color: CD.cyanBorder },
        line: { type: "none" },
      });
      slide.addText(String(s.value), {
        x: mx, y: METRIC_Y + 0.08, w: metricW, h: 0.42,
        fontFace: F.heading, fontSize: 22, bold: true,
        color: CD.white, align: "center",
      });
      slide.addText(s.label.toUpperCase(), {
        x: mx, y: METRIC_Y + 0.52, w: metricW, h: 0.24,
        fontFace: F.heading, fontSize: 7, bold: true,
        color: CD.cyan, align: "center", charSpacing: 0.5,
      });
    });
  }

  // Right context box
  const ctxY = 0.32;
  const ctxH = METRIC_Y - ctxY - 0.15;
  slide.addShape(pres.ShapeType.rect, {
    x: RCOL_X, y: ctxY, w: RCOL_W, h: ctxH,
    fill: { color: CD.card },
    line: { type: "none" },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: RCOL_X, y: ctxY, w: 0.05, h: ctxH,
    fill: { color: CD.cyanBorder },
    line: { type: "none" },
  });

  let ctxTextY = ctxY + 0.2;
  const addCtxItem = (label: string, value: string) => {
    slide.addText(label.toUpperCase(), {
      x: RCOL_X + 0.18, y: ctxTextY, w: RCOL_W - 0.26, h: 0.22,
      fontFace: F.heading, fontSize: 7, bold: true,
      color: CD.cyan, charSpacing: 0.5,
    });
    ctxTextY += 0.24;
    slide.addText(tr(value, 120), {
      x: RCOL_X + 0.18, y: ctxTextY, w: RCOL_W - 0.26, h: 0.9,
      fontFace: F.body, fontSize: 9, color: CD.textLight,
      lineSpacingMultiple: 1.35, valign: "top",
    });
    ctxTextY += 1.0;
  };

  if (p.screenGoal) addCtxItem("Goal", p.screenGoal);
  addCtxItem("Product", p.projectContext.mission);
}

async function addEngScreenshots(pres: PptxGenJS, p: ExportAuditPptxParams) {
  const pins = p.localizedIssues ?? [];

  if (p.isFlow && p.flowImageBlobs && p.flowImageBlobs.length > 0) {
    for (let i = 0; i < p.flowImageBlobs.length; i++) {
      const blob = p.flowImageBlobs[i];
      if (!blob) continue;
      await addEngScreenSlide(pres, blob, pins.filter(pin => pin.imageIndex === i), `Step ${i + 1}`, "Engineering Report");
    }
  } else if (p.screenshotBlob) {
    await addEngScreenSlide(pres, p.screenshotBlob, pins.filter(pin => pin.imageIndex === null), "Screenshot", "Engineering Report");
  }
}

/**
 * Screenshot slide: dark theme, two-column layout.
 * LEFT: step badge + heading + screenshot + "Issues Flagged" callout.
 * RIGHT: engine badge + issue cards with colored number circles.
 */
async function addEngScreenSlide(
  pres: PptxGenJS,
  blob: Blob,
  pins: LocalizedIssue[],
  title: string,
  label: string
): Promise<void> {
  const slide = pres.addSlide();
  engChrome(slide, label);

  const LCOL_W = 5.7;
  const RCOL_X = ML + LCOL_W + 0.22;
  const RCOL_W = SW - RCOL_X - MR;

  // Step badge — outlined pill
  slide.addText(title.toUpperCase(), {
    shape: pres.ShapeType.roundRect,
    x: ML, y: 0.3, w: 1.7, h: 0.33,
    fill: { color: CD.bg },
    line: { color: CD.cyan, width: 1 },
    color: CD.cyan,
    fontFace: F.heading, fontSize: 8, bold: true,
    align: "center", valign: "middle",
  });

  // Heading — issue count summary
  const headingText = pins.length > 0
    ? `${pins.length} issue${pins.length !== 1 ? "s" : ""} flagged on this screen`
    : "No issues flagged";
  slide.addText(headingText, {
    x: ML, y: 0.75, w: LCOL_W, h: 0.4,
    fontFace: F.heading, fontSize: 12, bold: true,
    color: CD.white, valign: "middle",
  });

  // Screenshot
  const dataUrl = await blobToDataUrl(blob);
  const ar = await getAspectRatio(dataUrl);
  const maxH = 4.85;
  let imgW = LCOL_W;
  let imgH = imgW / ar;
  if (imgH > maxH) { imgH = maxH; imgW = imgH * ar; }
  const imgX = ML + (LCOL_W - imgW) / 2;
  const imgY = 1.25;

  // Subtle shadow
  slide.addShape(pres.ShapeType.rect, {
    x: imgX + 0.06, y: imgY + 0.06, w: imgW, h: imgH,
    fill: { color: "111827" },
    line: { type: "none" },
  });
  slide.addImage({ data: dataUrl, x: imgX, y: imgY, w: imgW, h: imgH });
  if (pins.length > 0) drawPins(pres, slide, pins, imgX, imgY, imgW, imgH);

  // Issues Flagged callout (dark card + cyan left border)
  const calloutY = imgY + imgH + 0.12;
  const calloutH = Math.min(0.7, FOOTER_Y - 0.12 - calloutY);
  if (calloutH > 0.2) {
    slide.addShape(pres.ShapeType.rect, {
      x: ML, y: calloutY, w: LCOL_W, h: calloutH,
      fill: { color: CD.card },
      line: { type: "none" },
    });
    slide.addShape(pres.ShapeType.rect, {
      x: ML, y: calloutY, w: 0.06, h: calloutH,
      fill: { color: CD.cyanBorder },
      line: { type: "none" },
    });
    slide.addText(`${pins.length} issues flagged on this screen`, {
      x: ML + 0.2, y: calloutY, w: LCOL_W - 0.3, h: calloutH,
      fontFace: F.body, fontSize: 9, bold: true,
      color: CD.cyan, valign: "middle",
    });
  }

  // ── Right column ──
  if (pins.length === 0) return;

  // Engine badge (most common engine among pins)
  const engineCounts: Record<string, number> = {};
  pins.forEach(p => { engineCounts[p.engineId] = (engineCounts[p.engineId] ?? 0) + 1; });
  const topEngine = Object.entries(engineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  slide.addText(engineLabel(topEngine).toUpperCase(), {
    shape: pres.ShapeType.roundRect,
    x: RCOL_X, y: 0.3, w: RCOL_W, h: 0.33,
    fill: { color: CD.badgeBg },
    line: { type: "none" },
    color: CD.cyan,
    fontFace: F.heading, fontSize: 7.5, bold: true,
    align: "center", valign: "middle",
  });

  // Issue cards
  const MAX_ITEMS = 8;
  const shown = pins.slice(0, MAX_ITEMS);
  const availH = FOOTER_Y - 0.73 - 0.1;
  const itemH = Math.min(availH / shown.length, 0.76);
  const startY = 0.73;

  shown.forEach((pin, idx) => {
    const iy = startY + idx * itemH;
    const dotD = 0.24;
    slide.addShape(pres.ShapeType.rect, {
      x: RCOL_X, y: iy, w: RCOL_W, h: itemH - 0.04,
      fill: { color: CD.card },
      line: { type: "none" },
    });
    slide.addText(String(pin.markerIndex + 1), {
      shape: pres.ShapeType.ellipse,
      x: RCOL_X + 0.1, y: iy + (itemH - 0.04 - dotD) / 2, w: dotD, h: dotD,
      fill: { color: px(getMarkerColor(pin.markerIndex)) },
      line: { type: "none" },
      color: CD.white,
      fontFace: F.heading, fontSize: 7, bold: true,
      align: "center", valign: "middle",
    });
    slide.addText(tr(stripCoordinateFromReportText(pin.issue), 55), {
      x: RCOL_X + 0.44, y: iy + 0.04, w: RCOL_W - 0.54, h: itemH - 0.12,
      fontFace: F.body, fontSize: 8.5,
      color: CD.textLight, valign: "middle", lineSpacingMultiple: 1.2,
    });
  });

  if (pins.length > MAX_ITEMS) {
    slide.addText(`+ ${pins.length - MAX_ITEMS} more`, {
      x: RCOL_X, y: startY + MAX_ITEMS * itemH + 0.06, w: RCOL_W, h: 0.22,
      fontFace: F.body, fontSize: 7.5, italic: true, color: CD.textDim,
    });
  }
}

/**
 * Accessibility: dark theme, two-column.
 * LEFT: large PASS/FAIL result block.
 * RIGHT: contrast failures + other violations as dark cards.
 */
function addEngAccessibility(pres: PptxGenJS, p: ExportAuditPptxParams) {
  const acc = p.aiReport.accessibility;
  if (!acc) return;

  const slide = pres.addSlide();
  engChrome(slide, "Engineering Report");

  const status = acc.passed ? "PASS" : "FAIL";
  const statusColor = acc.passed ? CD.green : CD.red;

  // Heading
  slide.addText("ACCESSIBILITY", {
    x: ML, y: 0.32, w: CW, h: 0.4,
    fontFace: F.heading, fontSize: 10, bold: true,
    color: CD.cyan, charSpacing: 3,
  });

  // WCAG badge
  slide.addText(`WCAG 2.1 ${acc.wcag_level}`, {
    shape: pres.ShapeType.roundRect,
    x: ML, y: 0.84, w: 1.65, h: 0.33,
    fill: { color: CD.badgeBg },
    line: { type: "none" },
    color: CD.cyan,
    fontFace: F.heading, fontSize: 7.5, bold: true,
    align: "center", valign: "middle",
  });

  // Left result block
  const resW = 2.7;
  const resY = 1.3;
  const resH = FOOTER_Y - resY - 0.08;
  slide.addShape(pres.ShapeType.rect, {
    x: ML, y: resY, w: resW, h: resH,
    fill: { color: CD.card },
    line: { type: "none" },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: ML, y: resY, w: resW, h: 0.06,
    fill: { color: statusColor },
    line: { type: "none" },
  });
  slide.addText(status, {
    x: ML, y: resY + 0.3, w: resW, h: 2.0,
    fontFace: F.heading, fontSize: 80, bold: true,
    color: statusColor, align: "center", valign: "middle",
  });
  slide.addText("RESULT", {
    x: ML, y: resY + 2.4, w: resW, h: 0.26,
    fontFace: F.heading, fontSize: 8, bold: true,
    color: CD.textMuted, align: "center", charSpacing: 2,
  });
  const totalViolations = acc.contrast_failures.length + acc.other_violations.length;
  if (totalViolations > 0) {
    slide.addText(`${totalViolations} violation${totalViolations !== 1 ? "s" : ""} found`, {
      x: ML + 0.2, y: resY + 2.75, w: resW - 0.4, h: 0.28,
      fontFace: F.body, fontSize: 9.5, color: CD.textMuted, align: "center",
    });
  }

  // Right column: violation details
  const RCOL_X = ML + resW + 0.28;
  const RCOL_W = CW - resW - 0.28;
  let y = resY;

  if (acc.contrast_failures.length > 0) {
    slide.addText("CONTRAST FAILURES", {
      x: RCOL_X, y, w: RCOL_W, h: 0.28,
      fontFace: F.heading, fontSize: 8, bold: true,
      color: CD.cyan, charSpacing: 1.5,
    });
    y += 0.32;

    for (const cf of acc.contrast_failures.slice(0, 3)) {
      if (y + 0.58 > FOOTER_Y - 0.1) break;
      slide.addShape(pres.ShapeType.rect, {
        x: RCOL_X, y, w: RCOL_W, h: 0.54,
        fill: { color: CD.card },
        line: { type: "none" },
      });
      slide.addShape(pres.ShapeType.rect, {
        x: RCOL_X, y, w: 0.05, h: 0.54,
        fill: { color: CD.red },
        line: { type: "none" },
      });
      slide.addText(tr(stripCoordinateFromReportText(cf.element), 48), {
        x: RCOL_X + 0.16, y: y + 0.05, w: RCOL_W - 0.26, h: 0.24,
        fontFace: F.body, fontSize: 9, bold: true, color: CD.textLight,
      });
      slide.addText(`Ratio ${Number(cf.ratio).toFixed(2)}:1  ·  Required ${cf.required}:1`, {
        x: RCOL_X + 0.16, y: y + 0.28, w: RCOL_W - 0.26, h: 0.2,
        fontFace: F.body, fontSize: 8, color: CD.textMuted,
      });
      y += 0.62;
    }
  }

  if (acc.other_violations.length > 0 && y < FOOTER_Y - 0.8) {
    if (acc.contrast_failures.length > 0) y += 0.1;
    slide.addText("OTHER VIOLATIONS", {
      x: RCOL_X, y, w: RCOL_W, h: 0.28,
      fontFace: F.heading, fontSize: 8, bold: true,
      color: CD.cyan, charSpacing: 1.5,
    });
    y += 0.32;

    for (const v of acc.other_violations.slice(0, 5)) {
      if (y + 0.56 > FOOTER_Y - 0.1) break;
      const sevColor = v.severity === "critical" ? CD.red : CD.amber;
      slide.addShape(pres.ShapeType.rect, {
        x: RCOL_X, y, w: RCOL_W, h: 0.52,
        fill: { color: CD.card },
        line: { type: "none" },
      });
      slide.addShape(pres.ShapeType.rect, {
        x: RCOL_X, y, w: 0.05, h: 0.52,
        fill: { color: sevColor },
        line: { type: "none" },
      });
      slide.addText([
        { text: tr(stripCoordinateFromReportText(v.issue), 48) + "\n", options: { bold: true, fontSize: 9, color: CD.textLight } },
        { text: `${v.wcag_criterion}  ·  ${v.severity}`, options: { fontSize: 7.5, color: CD.textMuted } },
      ], {
        x: RCOL_X + 0.16, y: y + 0.05, w: RCOL_W - 0.26, h: 0.44,
        fontFace: F.body, valign: "top",
      });
      y += 0.58;
    }
  }
}

/**
 * Synth user research: dark theme.
 * Critical finding callout at top, three persona cards below.
 */
function addEngSynth(pres: PptxGenJS, p: ExportAuditPptxParams) {
  const synth = p.aiReport.synth_users;
  if (!synth) return;

  const slide = pres.addSlide();
  engChrome(slide, "Engineering Report");

  // Heading
  slide.addText("SYNTH USER RESEARCH", {
    x: ML, y: 0.32, w: CW, h: 0.4,
    fontFace: F.heading, fontSize: 10, bold: true,
    color: CD.cyan, charSpacing: 3,
  });

  // Critical finding callout
  const CALLOUT_H = 0.94;
  const calloutY = 0.85;
  slide.addShape(pres.ShapeType.rect, {
    x: ML, y: calloutY, w: CW, h: CALLOUT_H,
    fill: { color: CD.card },
    line: { type: "none" },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: ML, y: calloutY, w: 0.06, h: CALLOUT_H,
    fill: { color: CD.cyanBorder },
    line: { type: "none" },
  });
  slide.addText([
    { text: "Critical Finding  ", options: { bold: true, fontSize: 10, color: CD.cyan } },
    { text: synth.critical_finding, options: { fontSize: 10, color: CD.textLight } },
  ], {
    x: ML + 0.22, y: calloutY, w: CW - 0.32, h: CALLOUT_H,
    fontFace: F.body, valign: "middle", lineSpacingMultiple: 1.4,
  });

  // Persona cards
  const results = synth.results.slice(0, 3);
  const cardY = calloutY + CALLOUT_H + 0.2;
  const GAP = 0.18;
  const cardW = (CW - (results.length - 1) * GAP) / results.length;
  const cardH = FOOTER_Y - cardY - 0.06;

  results.forEach((r, i) => {
    const cx = ML + i * (cardW + GAP);
    const vc = verdictFg(r.verdict);

    slide.addShape(pres.ShapeType.rect, {
      x: cx, y: cardY, w: cardW, h: cardH,
      fill: { color: CD.card },
      line: { type: "none" },
    });
    // Color top bar
    slide.addShape(pres.ShapeType.rect, {
      x: cx, y: cardY, w: cardW, h: 0.09,
      fill: { color: vc },
      line: { type: "none" },
    });
    // Persona name
    slide.addText(r.persona_name, {
      x: cx + 0.15, y: cardY + 0.15, w: cardW - 0.3, h: 0.36,
      fontFace: F.heading, fontSize: 11.5, bold: true,
      color: CD.white,
    });
    // Verdict · emotion
    slide.addText(`${r.verdict}  ·  ${r.emotion}`, {
      x: cx + 0.15, y: cardY + 0.54, w: cardW - 0.3, h: 0.28,
      fontFace: F.heading, fontSize: 9, bold: true, color: vc,
    });
    // Divider
    slide.addShape(pres.ShapeType.rect, {
      x: cx + 0.15, y: cardY + 0.84, w: cardW - 0.3, h: 0.01,
      fill: { color: CD.textDim }, line: { type: "none" },
    });
    // Reasoning
    slide.addText(tr(r.reasoning, 300), {
      x: cx + 0.15, y: cardY + 0.94, w: cardW - 0.3, h: cardH - 1.06,
      fontFace: F.body, fontSize: 10,
      color: CD.textLight, lineSpacingMultiple: 1.5, valign: "top",
    });
  });
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function exportAuditPptx(params: ExportAuditPptxParams): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_4x3";

  if (params.preset === "executive") {
    await exportExecutivePptx(params);
  } else {
    // Engineering preset uses the template-based approach (docxtemplater-style via PizZip)
    await exportEngineeringPptx(params);
  }
}
