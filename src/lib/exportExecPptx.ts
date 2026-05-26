/**
 * Template-based PPTX export for the Executive preset.
 * Template: src/assets/templates/executive.pptx (5 slides)
 *   Slide 1 – Cover        : {product_name}, {risk_level}, {report_date}
 *   Slide 2 – Overview     : {summary}, {product_mission}
 *   Slide 3 – Key Risks    : {risk_1_title}/{risk_1_impact} × 3
 *   Slide 4 – Recommendation: {recommendation}, {one_big_thing}
 *   Slide 5 – Visual       : screenshot placeholder (x=1016000 y=1143000 w=10160000 h=5334000)
 */

import PizZip from "pizzip";
import type { ExportAuditPptxParams } from "./exportAuditPptx";
import { escapeXml, fill } from "./pptx-xml-utils";
import { localizeExecXml } from "./pptx-i18n";

import executiveTemplateUrl from "@/assets/templates/executive.pptx?url";

// ─── PPTX / OPC constants ────────────────────────────────────────────────────

const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tr(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + "\u2026" : s; }

// ─── Risk color ──────────────────────────────────────────────────────────────

function riskColorHex(level: string): string {
  if (level === "High") return "EF4444";
  if (level === "Medium") return "EAB308";
  return "22C55E";
}


/**
 * Replace {key} and inject a solidFill color into the surrounding <a:rPr>.
 * Used to colorize the risk level badge text.
 */
function fillColored(xml: string, key: string, value: string, hex: string): string {
  const escaped = escapeXml(value);
  // Find the run containing {key} and inject solidFill into its rPr
  return xml.replace(
    new RegExp(`(<a:rPr[^>]*>)((?:(?!</a:rPr>).)*?)</a:rPr>([^<]*<a:t>[^<]*\\{${key}\\}[^<]*</a:t>)`),
    (_match, rprOpen, rprInner, after) => {
      const solidFill = `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
      // Remove existing fill if present, then inject
      const cleaned = rprInner.replace(/<a:solidFill>.*?<\/a:solidFill>/s, "");
      return `${rprOpen}${cleaned}${solidFill}</a:rPr>${after}`;
    }
  ).split(`{${key}}`).join(escaped);
}

/**
 * Fix all split runs: { + name + } → {name}
 * PowerPoint spell-check splits placeholders across 3 runs.
 * Iterates to fix every occurrence (slide 4 has both {recommendation} and {one_big_thing} split).
 */
function fixSplitRuns(xml: string): string {
  const START = "<a:t>{</a:t></a:r>";
  const END = "<a:t>}</a:t>";

  let result = xml;
  let offset = 0;

  while (true) {
    const startIdx = result.indexOf(START, offset);
    if (startIdx === -1) break;

    const endIdx = result.indexOf(END, startIdx + START.length);
    if (endIdx === -1) break;

    // Extract placeholder name from the middle run: <a:t>name</a:t>
    const inner = result.slice(startIdx + START.length, endIdx);
    const nameMatch = inner.match(/<a:t>([A-Za-z0-9_]+)<\/a:t>/);
    if (!nameMatch) {
      offset = startIdx + START.length;
      continue;
    }

    const replacement = `<a:t>{${nameMatch[1]}}</a:t>`;
    result = result.slice(0, startIdx) + replacement + result.slice(endIdx + END.length);
    offset = startIdx + replacement.length;
  }

  return result;
}

// ─── Screenshot helpers ───────────────────────────────────────────────────────

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Screenshot placeholder EMU bounds (from template XML)
const BOX_X = 1016000;
const BOX_Y = 1143000;
const BOX_W = 10160000;
const BOX_H = 5334000;

/**
 * Insert a screenshot into slide 5, aspect-ratio-preserving (letterbox/pillarbox).
 * Replaces the "Image Placeholder" shape with a <p:pic> element.
 */
async function insertScreenshot(
  zip: PizZip,
  blob: Blob,
  slideFile: string,
  relsFile: string
): Promise<void> {
  const ext = blob.type === "image/png" ? "png" : "jpeg";
  const mime = blob.type === "image/png" ? "image/png" : "image/jpeg";
  const imgName = `exec_screenshot.${ext}`;
  const imgPath = `ppt/media/${imgName}`;

  // Add image binary to zip
  const buf = await blobToArrayBuffer(blob);
  zip.file(imgPath, buf);

  // Get natural dimensions for aspect ratio
  const bmp = await createImageBitmap(blob);
  const imgRatio = bmp.width / bmp.height;
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

  // Add image relationship
  const relsXml = zip.file(relsFile)!.asText();
  const imgRId = "rId50";
  const newRel = `<Relationship Id="${imgRId}" Type="${IMAGE_REL_TYPE}" Target="../media/${imgName}"/>`;
  const updatedRels = relsXml.replace("</Relationships>", `${newRel}</Relationships>`);
  zip.file(relsFile, updatedRels);

  // Add content type if needed
  const ctFile = "[Content_Types].xml";
  const ct = zip.file(ctFile)!.asText();
  if (!ct.includes(`ContentType="${mime}"`)) {
    const ctEntry = `<Default Extension="${ext}" ContentType="${mime}"/>`;
    zip.file(ctFile, ct.replace("</Types>", `${ctEntry}</Types>`));
  }

  // Build <p:pic> XML
  const picXml = `<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="99" name="Screenshot"/>
    <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
    <p:nvPr/>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="${imgRId}"/>
    <a:stretch><a:fillRect/></a:stretch>
  </p:blipFill>
  <p:spPr>
    <a:xfrm><a:off x="${picX}" y="${picY}"/><a:ext cx="${picW}" cy="${picH}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
</p:pic>`;

  // Remove the "Image Placeholder" shape and append the pic before </p:spTree>
  let slideXml = zip.file(slideFile)!.asText();
  slideXml = slideXml.replace(
    /<p:sp>[\s\S]*?<p:cNvPr[^>]*name="Image Placeholder"[\s\S]*?<\/p:sp>/,
    ""
  );
  slideXml = slideXml.replace("</p:spTree>", `${picXml}</p:spTree>`);
  zip.file(slideFile, slideXml);
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function exportExecutivePptx(params: ExportAuditPptxParams): Promise<void> {
  console.info("[exec-pptx] starting export");

  // Load template
  const resp = await fetch(`${executiveTemplateUrl}?t=${Date.now()}`, { cache: "no-store" });
  const buf = await resp.arrayBuffer();
  const zip = new PizZip(buf);

  const { aiReport, projectContext, date, executiveContent } = params;
  const exec = executiveContent;
  const uiLang = params.uiLang ?? "en";

  // Localise static UI labels before fill() so content placeholders stay intact
  for (const path of [
    "ppt/slides/slide1.xml",
    "ppt/slides/slide2.xml",
    "ppt/slides/slide3.xml",
    "ppt/slides/slide4.xml",
    "ppt/slides/slide5.xml",
  ]) {
    const f = zip.file(path);
    if (f) zip.file(path, localizeExecXml(f.asText(), uiLang));
  }

  console.info("[exec-pptx] exec data:", JSON.stringify({
    hasExec: !!exec,
    risk_level: exec?.risk_level,
    r1_title: exec?.top3_risks?.[0]?.title || "(empty)",
    r2_title: exec?.top3_risks?.[1]?.title || "(empty)",
    r3_title: exec?.top3_risks?.[2]?.title || "(empty)",
    recommendation: exec?.recommendation?.slice(0, 80) || "(empty)",
    one_big_thing: aiReport.one_big_thing?.slice(0, 60) || "(empty)",
  }));

  // Verify placeholders exist in template XML
  const s3xml = zip.file("ppt/slides/slide3.xml")!.asText();
  console.info("[exec-pptx] slide3 has {risk_1_title}:", s3xml.includes("{risk_1_title}"));
  console.info("[exec-pptx] slide4 has {one_big_thing}:", zip.file("ppt/slides/slide4.xml")!.asText().includes("{one_big_thing}"));

  // ── Slide 1: Cover ──
  {
    let xml = zip.file("ppt/slides/slide1.xml")!.asText();
    xml = fill(xml, {
      product_name: projectContext.name,
      report_date: date,
    });
    // Risk level with color
    if (exec) {
      xml = fillColored(xml, "risk_level", exec.risk_level.toUpperCase() + " RISK", riskColorHex(exec.risk_level));
    } else {
      xml = fill(xml, { risk_level: `Score: ${aiReport.score}/100` });
    }
    zip.file("ppt/slides/slide1.xml", xml);
  }

  // ── Slide 2: Overview ──
  {
    let xml = zip.file("ppt/slides/slide2.xml")!.asText();
    xml = fill(xml, {
      summary: exec?.summary || aiReport.one_big_thing,
      product_mission: projectContext.mission,
    });
    zip.file("ppt/slides/slide2.xml", xml);
  }

  // ── Slide 3: Key Risks ──
  {
    let xml = zip.file("ppt/slides/slide3.xml")!.asText();
    const risks = exec?.top3_risks ?? [];
    xml = fill(xml, {
      risk_1_title: risks[0]?.title || "—",
      risk_1_impact: risks[0]?.business_impact || "—",
      risk_2_title: risks[1]?.title || "—",
      risk_2_impact: risks[1]?.business_impact || "—",
      risk_3_title: risks[2]?.title || "—",
      risk_3_impact: risks[2]?.business_impact || "—",
    });
    zip.file("ppt/slides/slide3.xml", xml);
  }

  // ── Slide 4: Recommendation ──
  {
    let xml = zip.file("ppt/slides/slide4.xml")!.asText();
    // Fix split run before replacement
    let fixed = fixSplitRuns(xml);

    const remaining = fixed.match(/\{[A-Za-z0-9_]+\}/g);
    if (remaining) {
      console.warn("[exportExecPptx] Unreplaced placeholders detected after fixSplitRuns:", remaining);
      fixed = fixed.replace(/\{[A-Za-z0-9_]+\}/g, "");
    }

    xml = fixed;
    xml = fill(xml, {
      recommendation: exec?.recommendation || "—",
      one_big_thing: aiReport.one_big_thing || "—",
    });
    zip.file("ppt/slides/slide4.xml", xml);
  }

  // ── Slide 5: Visual ──
  const screenshotBlob =
    (params.flowImageBlobs && params.flowImageBlobs[0]) ?? params.screenshotBlob ?? null;

  console.info("[exec-pptx] screenshotBlob:", screenshotBlob ? `${screenshotBlob.size} bytes` : "null",
    "| isFlow:", params.isFlow,
    "| flowBlobs:", params.flowImageBlobs?.length ?? 0,
    "| singleBlob:", params.screenshotBlob ? "yes" : "null");

  if (screenshotBlob) {
    await insertScreenshot(
      zip,
      screenshotBlob,
      "ppt/slides/slide5.xml",
      "ppt/slides/_rels/slide5.xml.rels"
    );
  }

  // ── Output ──
  const out = zip.generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  const filename = `qualia-executive-${date.replace(/[\s/]/g, "-")}.pptx`;
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  console.info("[exec-pptx] done:", filename);
}
