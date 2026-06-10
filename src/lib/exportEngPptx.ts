/**
 * Template-based PPTX export for the Engineering Lead preset.
 * Template: src/assets/templates/engineering.pptx (6 slides)
 *   Slide 1 – Cover
 *   Slide 2 – Key Findings
 *   Slide 3 – Step template (duplicated per flow step / accessibility issue)
 *   Slide 4 – Accessibility step (skipped — we reuse slide 3 for acc issues)
 *   Slide 5 – Accessibility summary (skipped)
 *   Slide 6 – Synth
 */

import PizZip from "pizzip";
import { stripCoordinateFromReportText } from "./stripReportCoordinateText";
import type { ExportAuditPptxParams, LocalizedIssue } from "./exportAuditPptx";
import { escapeXml, fill } from "./pptx-xml-utils";
import { localizeEngXml, localizeEngReportType } from "./pptx-i18n";
import { getMarkerColorHex } from "./markerColors";

import engineeringTemplateUrl from "@/assets/templates/engineering.pptx?url";

// ─── PPTX / OPC constants ────────────────────────────────────────────────────

const SLIDE_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const SLIDE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

// Brand purple (matches Qualia gradient panel in cover)
const BRAND_PURPLE = "7C3AED";

// Score color thresholds — mirrors ScoreCard.tsx
function scoreColorHex(score: number | undefined | null): string {
  if (score == null) return "9CA3AF";
  if (score >= 80) return "22C55E";
  if (score >= 50) return "EAB308";
  return "EF4444";
}

// Pin palette delegated to markerColors.ts canonical source
function pinColor(idx: number) { return getMarkerColorHex(idx); }

// Circled number prefixes for multi-issue slides
const CIRCLE = "①②③④⑤⑥⑦⑧⑨";
function pinNum(i: number) { return i < CIRCLE.length ? CIRCLE[i] : `(${i + 1})`; }

// ─── XML helpers ─────────────────────────────────────────────────────────────

function tr(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Truncate at the last complete sentence before maxChars.
 * The result always ends at a period — never mid-word or mid-thought.
 * Falls back to last word boundary if no sentence end is found.
 */
function trSentence(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  const cut = s.slice(0, maxChars);
  // Try last ". " sentence boundary
  const lastDot = cut.lastIndexOf(". ");
  if (lastDot > maxChars / 3) return cut.slice(0, lastDot + 1);
  // Fall back to last word boundary (no trailing "…")
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}

/**
 * Replace the FIRST occurrence of `search` with `replacement`.
 * The replacement is XML-escaped automatically.
 */
function replaceFirst(xml: string, search: string, replacement: string): string {
  const i = xml.indexOf(search);
  if (i === -1) return xml;
  return xml.slice(0, i) + escapeXml(replacement) + xml.slice(i + search.length);
}

/**
 * Replace a score placeholder {key} inside its <a:r> run and inject a solidFill color.
 * Must be called BEFORE fill() so the token is still present.
 */
function fillColoredScore(
  xml: string,
  key: string,
  value: string,
  hex: string
): string {
  const token = `{${key}}`;
  const ti = xml.indexOf(token);
  if (ti === -1) return xml;

  const rStart = xml.lastIndexOf("<a:r>", ti);
  if (rStart === -1) return xml.replaceAll(token, escapeXml(value));
  const rEnd = xml.indexOf("</a:r>", ti) + "</a:r>".length;
  let run = xml.slice(rStart, rEnd).replace(token, escapeXml(value));

  // Inject <a:solidFill> into the <a:rPr>
  const selfClose = run.match(/<a:rPr([^>]*)\/>/);
  if (selfClose) {
    run = run.replace(
      selfClose[0],
      `<a:rPr${selfClose[1]}><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></a:rPr>`
    );
  } else {
    run = run.replace(
      "</a:rPr>",
      `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></a:rPr>`
    );
  }
  return xml.slice(0, rStart) + run + xml.slice(rEnd);
}

// ─── Image helpers ────────────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

/** Draw numbered pin circles on a screenshot blob via Canvas API. */
async function drawPins(blob: Blob, pins: LocalizedIssue[]): Promise<Blob> {
  if (!pins.length) return blob;
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);

  const r = Math.min(bmp.width, bmp.height) * 0.028;
  for (const pin of pins) {
    const cx = (pin.x / 100) * bmp.width;
    const cy = (pin.y / 100) * bmp.height;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = r * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `#${pinColor(pin.markerIndex)}`;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = r * 0.2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${r * 1.1}px -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(pin.markerIndex + 1), cx, cy);
  }
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", 0.92)
  );
}

/**
 * Remove every <p:sp> block that contains `token` anywhere in its body.
 * Used to strip the ISSUE/SUGGESTION panels on no-issues slides.
 */
function removeShapesContaining(xml: string, token: string): string {
  let out = xml;
  let idx = out.indexOf(token);
  while (idx !== -1) {
    const start = out.lastIndexOf("<p:sp>", idx);
    const end = out.indexOf("</p:sp>", idx);
    if (start === -1 || end === -1) break;
    out = out.slice(0, start) + out.slice(end + "</p:sp>".length);
    idx = out.indexOf(token);
  }
  return out;
}

/**
 * Remove a <p:sp> block by its cNvPr name attribute.
 */
function removeShapeByName(xml: string, name: string): string {
  const nameToken = `name="${name}"`;
  const idx = xml.indexOf(nameToken);
  if (idx === -1) return xml;
  const start = xml.lastIndexOf("<p:sp>", idx);
  const end = xml.indexOf("</p:sp>", idx);
  if (start === -1 || end === -1) return xml;
  return xml.slice(0, start) + xml.slice(end + "</p:sp>".length);
}

/**
 * Replace the "Screenshot Placeholder" <p:sp> in slide XML with a <p:pic> element
 * that references the given image, which is added to the zip.
 * `box` overrides the default placeholder bounds (EMU) — used for full-width no-issues slides.
 */
async function insertScreenshot(
  zip: PizZip,
  slideNum: number,
  slideXml: string,
  blob: Blob,
  box?: { x: number; y: number; w: number; h: number }
): Promise<string> {
  const fname = `slide${slideNum}_img.jpeg`;
  zip.file(`ppt/media/${fname}`, await blobToBase64(blob), { base64: true });

  const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
  const currentRels =
    zip.file(relsPath)?.asText() ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  zip.file(
    relsPath,
    currentRels.replace(
      "</Relationships>",
      `<Relationship Id="rId99" Type="${IMAGE_REL_TYPE}" Target="../media/${fname}"/></Relationships>`
    )
  );

  // Placeholder bounds (EMU). Full-width override used for no-issues slides.
  const BOX_X = box?.x ?? 508000;
  const BOX_Y = box?.y ?? 1485900;
  const BOX_W = box?.w ?? 6350000;
  const BOX_H = box?.h ?? 3937000;

  // Fit image inside placeholder preserving aspect ratio (letterbox / pillarbox)
  const bmp = await createImageBitmap(blob);
  const imgRatio = bmp.width / bmp.height;
  bmp.close();
  const boxRatio = BOX_W / BOX_H;
  let picW: number, picH: number;
  if (imgRatio > boxRatio) {
    picW = BOX_W;
    picH = Math.round(BOX_W / imgRatio);
  } else {
    picH = BOX_H;
    picW = Math.round(BOX_H * imgRatio);
  }
  const picX = BOX_X + Math.round((BOX_W - picW) / 2);
  const picY = BOX_Y + Math.round((BOX_H - picH) / 2);

  const pic = [
    `<p:pic>`,
    `<p:nvPicPr>`,
    `<p:cNvPr id="99" name="Screenshot"/>`,
    `<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>`,
    `<p:nvPr/>`,
    `</p:nvPicPr>`,
    `<p:blipFill>`,
    `<a:blip r:embed="rId99"/>`,
    `<a:stretch><a:fillRect/></a:stretch>`,
    `</p:blipFill>`,
    `<p:spPr>`,
    `<a:xfrm><a:off x="${picX}" y="${picY}"/><a:ext cx="${picW}" cy="${picH}"/></a:xfrm>`,
    `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 6000"/></a:avLst></a:prstGeom>`,
    `</p:spPr>`,
    `</p:pic>`,
  ].join("");

  const mi = slideXml.indexOf('name="Screenshot Placeholder"');
  if (mi === -1) return slideXml;
  const s = slideXml.lastIndexOf("<p:sp>", mi);
  const e = slideXml.indexOf("</p:sp>", mi) + "</p:sp>".length;
  return slideXml.slice(0, s) + pic + slideXml.slice(e);
}

// ─── Slide registration helpers ──────────────────────────────────────────────

function registerContentType(zip: PizZip, slidePath: string) {
  const ct = zip.file("[Content_Types].xml")!.asText();
  const tag = `<Override PartName="/ppt/${slidePath}" ContentType="${SLIDE_CONTENT_TYPE}"/>`;
  if (!ct.includes(tag)) {
    zip.file("[Content_Types].xml", ct.replace("</Types>", `${tag}</Types>`));
  }
}

function addPresRel(relsXml: string, rId: string, path: string): string {
  if (relsXml.includes(`Id="${rId}"`)) return relsXml;
  return relsXml.replace(
    "</Relationships>",
    `<Relationship Id="${rId}" Type="${SLIDE_REL_TYPE}" Target="${path}"/></Relationships>`
  );
}

// ─── Step data ───────────────────────────────────────────────────────────────

interface StepData {
  stepNumber: string;      // "STEP 01"
  stepTitle: string;       // "3 issues detected"
  engineLabel: string;     // "HEURISTIC"
  issueLines: string[];    // issue text, one entry per pin (numbered if >1)
  suggestionLines: string[]; // suggestion text, one per pin
  violationCount: string;
  screenshotBlob: Blob | null;
  pins: LocalizedIssue[];
  accBadge?: string;       // "A1", "A2" — only for accessibility slides
  noIssues?: boolean;      // true when this step has zero findings
}

type FindingFull = { issue: string; why_it_matters: string; suggestion: string };

function findFull(
  pin: LocalizedIssue,
  aiReport: ExportAuditPptxParams["aiReport"]
): { whyItMatters: string; suggestion: string } {
  const text = stripCoordinateFromReportText(pin.issue);
  if (pin.engineId === "accessibility") {
    const v = aiReport.accessibility?.other_violations.find(
      (v) => stripCoordinateFromReportText(v.issue) === text
    );
    return { whyItMatters: "", suggestion: v?.suggestion ?? "" };
  }
  // cross_frame and prototype_completeness live at the top level, not inside engines
  if (pin.engineId === "cross_frame" || pin.engineId === "prototype_completeness") {
    const source = pin.engineId === "cross_frame" ? aiReport.cross_frame : aiReport.prototype_completeness;
    const f = (source?.findings ?? []).find(
      (f) => stripCoordinateFromReportText(f.issue) === text
    );
    return { whyItMatters: f?.why_it_matters ?? "", suggestion: f?.suggestion ?? "" };
  }
  const findings = (aiReport.engines as Record<string, FindingFull[]>)[pin.engineId] ?? [];
  const f = findings.find((f) => stripCoordinateFromReportText(f.issue) === text);
  return { whyItMatters: f?.why_it_matters ?? "", suggestion: f?.suggestion ?? "" };
}

function getTopEngine(pins: LocalizedIssue[]): string {
  if (!pins.length) return "system_logic";
  const c: Record<string, number> = {};
  for (const p of pins) c[p.engineId] = (c[p.engineId] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}

function engineLabel(id: string): string {
  return (
    ({ system_logic: "Logic", heuristic: "Heuristic", cognitive: "Cognitive",
      interaction: "Interaction", accessibility: "Accessibility" } as Record<string, string>
    )[id] ?? id
  );
}

// Minimal UI strings that are injected as content (not replaced by localizeEngXml)
const UI_STRINGS = {
  en: {
    noIssues: "No issues detected",
    issuesSingle: "1 issue detected",
    issuesPlural: (n: number) => `${n} issues detected`,
    accessibilityIssue: "Accessibility issue",
    contrastFailures: "Contrast failures",
    issueLabel: "ISSUE",
    suggestionLabel: "SUGGESTION",
    accessibilityLabel: "ACCESSIBILITY",
    contrastIssueIntro: (n: number) => `Contrast failed in ${n} element${n > 1 ? "s" : ""}:`,
    contrastSuggestionIntro: (ratio: string) => `Increase contrast to the required ratio of ${ratio}. Update text or background colors on the failing elements above to meet WCAG AA accessibility standards.`,
  },
  it: {
    noIssues: "Nessun problema rilevato",
    issuesSingle: "1 problema rilevato",
    issuesPlural: (n: number) => `${n} problemi rilevati`,
    accessibilityIssue: "Problema di accessibilità",
    contrastFailures: "Problemi di contrasto",
    issueLabel: "PROBLEMA",
    suggestionLabel: "SUGGERIMENTO",
    accessibilityLabel: "ACCESSIBILITÀ",
    contrastIssueIntro: (n: number) => `Contrasto insufficiente in ${n} element${n > 1 ? "i" : "o"}:`,
    contrastSuggestionIntro: (ratio: string) => `Aumentare il contrasto fino al rapporto richiesto di ${ratio}. Aggiornare i colori del testo o dello sfondo degli elementi indicati per rispettare gli standard WCAG AA.`,
  },
};

function makeStepData(
  stepNum: number,
  rawPins: LocalizedIssue[],
  blob: Blob | null,
  aiReport: ExportAuditPptxParams["aiReport"],
  accBadge?: string,
  uiLang: "en" | "it" = "en"
): StepData {
  const ui = UI_STRINGS[uiLang];
  const pins = rawPins.map((p) => ({ ...p, issue: stripCoordinateFromReportText(p.issue) }));
  const multi = pins.length > 1;

  const issueLines: string[] = [];
  const suggestionLines: string[] = [];

  if (!pins.length) {
    issueLines.push(ui.noIssues);
  } else {
    for (let i = 0; i < rawPins.length; i++) {
      const { whyItMatters, suggestion } = findFull(rawPins[i], aiReport);
      const issueText = pins[i].issue;

      if (multi) {
        // Flow mode: numbered, compact
        issueLines.push(`${pinNum(i)} ${issueText}`);
        if (suggestion) suggestionLines.push(`${pinNum(i)} ${suggestion}`);
      } else {
        // Single issue per slide: issue box = issue + why it matters, suggestion box = fix
        issueLines.push(issueText);
        issueLines.push(whyItMatters || "—");
        suggestionLines.push(suggestion || "—");
      }
    }
  }

  if (!suggestionLines.length && rawPins.length) suggestionLines.push("—");

  return {
    stepNumber: `STEP ${String(stepNum).padStart(2, "0")}`,
    stepTitle: rawPins.length
      ? (rawPins.length === 1 ? ui.issuesSingle : ui.issuesPlural(rawPins.length))
      : ui.noIssues,
    engineLabel: rawPins.length ? engineLabel(getTopEngine(rawPins)).toUpperCase() : "—",
    issueLines,
    suggestionLines,
    violationCount: String(rawPins.length),
    screenshotBlob: blob,
    pins: rawPins,
    noIssues: rawPins.length === 0,
    accBadge,
  };
}

function buildSteps(params: ExportAuditPptxParams): StepData[] {
  const allPins = params.localizedIssues ?? [];
  const uiLang = params.uiLang ?? "en";
  const ui = UI_STRINGS[uiLang];
  let steps: StepData[];

  // Accessibility pins are handled by dedicated loops below — exclude them here
  const nonAccPins = allPins.filter((p) => p.engineId !== "accessibility");

  if (params.isFlow && params.flowImageBlobs?.length) {
    // Flow: one slide per flow step (all issues for that step on one slide)
    steps = params.flowImageBlobs.map((blob, i) =>
      makeStepData(i + 1, nonAccPins.filter((p) => p.imageIndex === i), blob, params.aiReport, undefined, uiLang)
    );
  } else {
    // Single screen: one slide per issue so nothing gets crammed together
    const screenPins = nonAccPins.filter((p) => p.imageIndex === null);
    const blob = params.screenshotBlob ?? null;
    if (screenPins.length > 0) {
      steps = screenPins.map((pin, i) =>
        makeStepData(i + 1, [pin], blob, params.aiReport, undefined, uiLang)
      );
    } else {
      steps = [makeStepData(1, [], blob, params.aiReport, undefined, uiLang)];
    }
  }

  // Accessibility violations → extra step slides
  const acc = params.aiReport.accessibility;
  if (acc?.other_violations?.length) {
    const accPins = allPins.filter((p) => p.engineId === "accessibility");
    const fallbackBlob = params.flowImageBlobs?.[0] ?? params.screenshotBlob ?? null;

    for (let i = 0; i < acc.other_violations.length; i++) {
      const v = acc.other_violations[i];
      const issueText = stripCoordinateFromReportText(v.issue);
      const matchPin = accPins.find((p) => stripCoordinateFromReportText(p.issue) === issueText);
      const pins = matchPin ? [matchPin] : [];

      // Use the step number from the pin's imageIndex so the badge reflects
      // the actual screen where the accessibility issue was found.
      let stepNum: number;
      let screenshotBlob: Blob | null;
      if (matchPin?.imageIndex != null) {
        stepNum = matchPin.imageIndex + 1;
        screenshotBlob = params.flowImageBlobs?.[matchPin.imageIndex] ?? fallbackBlob;
      } else {
        stepNum = 1;
        screenshotBlob = fallbackBlob;
      }

      steps.push({
        stepNumber: `STEP ${String(stepNum).padStart(2, "0")}`,
        stepTitle: ui.accessibilityIssue,
        engineLabel: ui.accessibilityLabel,
        issueLines: [tr(issueText || "—", 280)],
        suggestionLines: [tr(v.suggestion || "—", 280)],
        violationCount: "1",
        screenshotBlob: pins.length ? screenshotBlob : null,
        pins,
        accBadge: `A${i + 1}`,
      });
    }
  }

  // Contrast failures → one grouped slide listing all failing elements
  const cf = acc?.contrast_failures ?? [];
  if (cf.length > 0) {
    const fallbackBlob = params.flowImageBlobs?.[0] ?? params.screenshotBlob ?? null;

    // Build element list: "Label (3.92:1), 2/3 (3.53:1), ..."
    // CF objects can use either `element` (old check-contrast format) or `element_description` (AI format)
    const cfLabel = (f: { element?: string; element_description?: string }) =>
      f.element ?? f.element_description ?? "—";
    const elementList = cf
      .map((f) => `${cfLabel(f)} (${f.ratio.toFixed(2)}:1)`)
      .join(", ");
    const issueText = `${ui.contrastIssueIntro(cf.length)} ${elementList}`;

    // Unique required ratios (usually just 4.5:1)
    const uniqueRequired = [...new Set(cf.map((f) => `${f.required}:1`))].join(", ");
    const suggestionText = ui.contrastSuggestionIntro(uniqueRequired);

    // Collect the pins that correspond to contrast failures so they get drawn on the screenshot.
    // In AuditDetail, contrast failure pins are added with issue = row.element (already stripped).
    const cfElementNames = new Set(cf.map((f) => stripCoordinateFromReportText(cfLabel(f))));
    const cfPins = allPins.filter(
      (p) => p.engineId === "accessibility" && cfElementNames.has(stripCoordinateFromReportText(p.issue))
    );

    steps.push({
      stepNumber: `STEP 00`,
      stepTitle: ui.contrastFailures,
      engineLabel: ui.accessibilityLabel,
      issueLines: [tr(issueText, 500)],
      suggestionLines: [tr(suggestionText, 400)],
      violationCount: String(cf.length),
      screenshotBlob: fallbackBlob,
      pins: cfPins,
      accBadge: "CF",
    });
  }

  return steps;
}

// ─── Slide 3 XML build ───────────────────────────────────────────────────────

/**
 * Build one step slide XML from the slide 3 template.
 * Slide 3 has TWO Issue Title / Issue Body shape pairs — top (issue) + bottom (suggestion).
 * We use replaceFirst() to target each pair independently.
 */
function buildStepSlide(template: string, step: StepData, uiLang: "en" | "it" = "en"): string {
  const ui = UI_STRINGS[uiLang];
  let xml = template;

  // Basic badge/heading placeholders
  xml = fill(xml, {
    step_number: step.stepNumber,
    step_title: step.stepTitle,
    engine_label: step.engineLabel,
    violation_count: step.violationCount,
  });

  // Engine badge: change cyan text color (06B6D4) → brand purple
  // (only the text fill inside Engine Badge run)
  xml = xml.replace(
    `<a:solidFill><a:srgbClr val="06B6D4"/></a:solidFill>`,
    `<a:solidFill><a:srgbClr val="${BRAND_PURPLE}"/></a:solidFill>`
  );

  if (step.noIssues) {
    // Remove right-panel shapes and their border lines — image will be full-width
    xml = removeShapesContaining(xml, "{issue_title}");
    xml = removeShapesContaining(xml, "{issue_body}");
    xml = removeShapeByName(xml, "Issue Border");
    xml = removeShapeByName(xml, "Sugg Border");
  } else {
    // Top pair → "ISSUE"/"PROBLEMA" header + issue text
    xml = replaceFirst(xml, "{issue_title}", ui.issueLabel);
    xml = replaceFirst(xml, "{issue_body}", step.issueLines.join("\n"));

    // Bottom pair → "SUGGESTION"/"SUGGERIMENTO" header + suggestion text
    xml = replaceFirst(xml, "{issue_title}", ui.suggestionLabel);
    xml = replaceFirst(xml, "{issue_body}", step.suggestionLines.join("\n"));
  }

  // A-badge for accessibility slides
  if (step.accBadge) {
    const badge = [
      `<p:sp>`,
      `<p:nvSpPr><p:cNvPr id="200" name="Acc Badge"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`,
      `<p:spPr>`,
      `<a:xfrm><a:off x="2717800" y="723900"/><a:ext cx="952500" cy="279400"/></a:xfrm>`,
      `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 10000"/></a:avLst></a:prstGeom>`,
      `<a:solidFill><a:srgbClr val="4C1D95"/></a:solidFill><a:ln><a:noFill/></a:ln>`,
      `</p:spPr>`,
      `<p:txBody>`,
      `<a:bodyPr lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="ctr" anchorCtr="0"/>`,
      `<a:lstStyle/>`,
      `<a:p><a:pPr algn="ctr"><a:buNone/></a:pPr>`,
      `<a:r><a:rPr lang="en-US" sz="1200" b="1" dirty="0">`,
      `<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>`,
      `<a:latin typeface="Inter"/></a:rPr>`,
      `<a:t>${escapeXml(step.accBadge)}</a:t></a:r></a:p>`,
      `</p:txBody></p:sp>`,
    ].join("");
    xml = xml.replace("</p:spTree>", `${badge}</p:spTree>`);
  }

  return xml;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function exportEngineeringPptx(params: ExportAuditPptxParams): Promise<void> {
  console.info("[eng-pptx] starting export, template url:", engineeringTemplateUrl);
  const resp = await fetch(`${engineeringTemplateUrl}?t=${Date.now()}`, { cache: "no-store" });
  if (!resp.ok) throw new Error(`Template fetch failed: ${resp.status} ${resp.url}`);
  const zip = new PizZip(await resp.arrayBuffer());
  console.info("[eng-pptx] template loaded, files:", Object.keys(zip.files).length);

  const { aiReport, projectContext, isFlow, isPrototype } = params;
  const uiLang = params.uiLang ?? "en";
  const ss = aiReport.sub_scores;
  const sc = (v: number | undefined | null) => (v != null ? String(v) : "—");

  // ── Localise all slide XMLs (UI labels only, before any fill()) ───────────
  const slideFiles = ["ppt/slides/slide1.xml","ppt/slides/slide2.xml",
    "ppt/slides/slide3.xml","ppt/slides/slide4.xml","ppt/slides/slide5.xml"];
  for (const path of slideFiles) {
    const f = zip.file(path);
    if (f) zip.file(path, localizeEngXml(f.asText(), uiLang));
  }

  // ── Slide 1: Cover ────────────────────────────────────────────────────────

  {
    let s1 = zip.file("ppt/slides/slide1.xml")!.asText();

    // Score colors on sub-score cards
    s1 = fillColoredScore(s1, "logic_score", sc(ss?.system_logic_score), scoreColorHex(ss?.system_logic_score));
    s1 = fillColoredScore(s1, "heuristic_score", sc(ss?.heuristic_score), scoreColorHex(ss?.heuristic_score));
    s1 = fillColoredScore(s1, "cognitive_score", sc(ss?.cognitive_score), scoreColorHex(ss?.cognitive_score));
    s1 = fillColoredScore(s1, "interaction_score", sc(ss?.interaction_score), scoreColorHex(ss?.interaction_score));

    s1 = fill(s1, {
      product_name: projectContext.name,
      report_type: localizeEngReportType(isFlow, uiLang, isPrototype),
      score_line: `${aiReport.score}/100`,
    });

    zip.file("ppt/slides/slide1.xml", s1);
  }

  // ── Slide 2: Key Findings ─────────────────────────────────────────────────

  {
    let s2 = zip.file("ppt/slides/slide2.xml")!.asText();

    // Score colors (must happen before fill so tokens still present)
    s2 = fillColoredScore(s2, "logic_score", sc(ss?.system_logic_score), scoreColorHex(ss?.system_logic_score));
    s2 = fillColoredScore(s2, "heuristic_score", sc(ss?.heuristic_score), scoreColorHex(ss?.heuristic_score));
    s2 = fillColoredScore(s2, "cognitive_score", sc(ss?.cognitive_score), scoreColorHex(ss?.cognitive_score));
    s2 = fillColoredScore(s2, "interaction_score", sc(ss?.interaction_score), scoreColorHex(ss?.interaction_score));

    s2 = fill(s2, {
      one_big_thing: trSentence(aiReport.one_big_thing, 550),   // ~5–6 lines in OBT card
      product_mission: trSentence(projectContext.mission, 120), // ~2 lines in mission card
    });

    zip.file("ppt/slides/slide2.xml", s2);
  }

  // ── Slide 5: Synth ────────────────────────────────────────────────────────

  {
    const synth = aiReport.synth_users;
    zip.file(
      "ppt/slides/slide5.xml",
      fill(zip.file("ppt/slides/slide5.xml")!.asText(), {
        critical_finding: synth ? tr(synth.critical_finding, 400) : "—",
        p1_name: synth?.results[0]?.persona_name ?? "—",
        p1_verdict: synth?.results[0] ? `${synth.results[0].verdict} · ${synth.results[0].emotion}` : "—",
        p1_reasoning: synth?.results[0] ? tr(synth.results[0].reasoning, 460) : "—",
        p2_name: synth?.results[1]?.persona_name ?? "—",
        p2_verdict: synth?.results[1] ? `${synth.results[1].verdict} · ${synth.results[1].emotion}` : "—",
        p2_reasoning: synth?.results[1] ? tr(synth.results[1].reasoning, 460) : "—",
        p3_name: synth?.results[2]?.persona_name ?? "—",
        p3_verdict: synth?.results[2] ? `${synth.results[2].verdict} · ${synth.results[2].emotion}` : "—",
        p3_reasoning: synth?.results[2] ? tr(synth.results[2].reasoning, 460) : "—",
      })
    );
  }

  // ── Step slides ───────────────────────────────────────────────────────────

  const steps = buildSteps(params);
  const slide3Template = zip.file("ppt/slides/slide3.xml")!.asText();
  const slide3RelsTemplate = zip.file("ppt/slides/_rels/slide3.xml.rels")!.asText();

  // Slide order: 1, 2, steps..., 5(synth)
  // Template rId mapping: rId2→slide1, rId3→slide2, rId4→slide3, rId5→slide4(acc,skipped), rId6→slide5(synth)
  // Extra step slides: slide6.xml+ with rId50, rId51...
  const slideOrder: Array<{ path: string; rId: string; id: number }> = [
    { path: "slides/slide1.xml", rId: "rId2", id: 270 },
    { path: "slides/slide2.xml", rId: "rId3", id: 268 },
  ];

  let nextFile = 6;   // extra slides start at slide6.xml (slide4 is template acc slide, skipped)
  let nextRId = 50;   // avoid collisions with template rIds (1-11 are used)
  let nextId = 300;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let slideNum: number;
    let rId: string;
    let slideId: number;

    if (i === 0) {
      // Reuse slide3.xml slot
      slideNum = 3;
      rId = "rId4";
      slideId = 269;
    } else {
      slideNum = nextFile++;
      rId = `rId${nextRId++}`;
      slideId = nextId++;
      zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`, slide3RelsTemplate);
      registerContentType(zip, `slides/slide${slideNum}.xml`);
    }

    let slideXml = buildStepSlide(slide3Template, step, uiLang);

    // Insert screenshot with pin overlay
    if (step.screenshotBlob) {
      try {
        const blob = step.pins.length
          ? await drawPins(step.screenshotBlob, step.pins)
          : step.screenshotBlob;
        // No-issues: use full-width centered box (slide is 12192000 × 6858000 EMU)
        const box = step.noIssues
          ? { x: 457200, y: 1200000, w: 11277600, h: 5400000 }
          : undefined;
        slideXml = await insertScreenshot(zip, slideNum, slideXml, blob, box);
      } catch (e) {
        console.warn("Screenshot insertion failed for step", i, e);
        // Continue without screenshot rather than aborting the whole export
      }
    }

    zip.file(`ppt/slides/slide${slideNum}.xml`, slideXml);
    slideOrder.push({ path: `slides/slide${slideNum}.xml`, rId, id: slideId });
  }

  // Synth last (slide5) — only include if this audit has synth user research
  if (params.aiReport.synth_users) {
    slideOrder.push({ path: "slides/slide5.xml", rId: "rId6", id: 266 });
  }

  // ── Update presentation.xml ───────────────────────────────────────────────

  const newSldIdLst = `<p:sldIdLst>${slideOrder
    .map((s) => `<p:sldId id="${s.id}" r:id="${s.rId}"/>`)
    .join("")}</p:sldIdLst>`;

  {
    const presXml = zip.file("ppt/presentation.xml")!.asText();
    const sldStart = presXml.indexOf("<p:sldIdLst>");
    const sldEnd = presXml.indexOf("</p:sldIdLst>") + "</p:sldIdLst>".length;
    zip.file(
      "ppt/presentation.xml",
      presXml.slice(0, sldStart) + newSldIdLst + presXml.slice(sldEnd)
    );
  }

  // ── Update presentation rels ──────────────────────────────────────────────

  let presRels = zip.file("ppt/_rels/presentation.xml.rels")!.asText();
  for (const s of slideOrder) {
    presRels = addPresRel(presRels, s.rId, s.path);
  }
  zip.file("ppt/_rels/presentation.xml.rels", presRels);

  // ── Download ──────────────────────────────────────────────────────────────

  const blob = zip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qualia-engineering-${params.date.replace(/[\s/]/g, "-")}.pptx`;
  // eslint-disable-next-line no-restricted-syntax -- REACT-004: standard file-download idiom (createElement + click + remove)
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
