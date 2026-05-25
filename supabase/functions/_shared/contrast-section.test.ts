import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildFlowContrastSection, type ContrastResult } from "./contrast-section.ts";

Deno.test("returns empty string when given empty array", () => {
  assertEquals(buildFlowContrastSection([]), "");
});

Deno.test("formats a single passing step", () => {
  const results: ContrastResult[] = [
    { image_index: 0, ratio: 7.2, level: "AAA Pass", foreground_hex: "#111111", background_hex: "#ffffff" },
  ];
  const out = buildFlowContrastSection(results);
  assertStringIncludes(out, "HARD DATA - ACCESSIBILITY");
  assertStringIncludes(out, "Step 1 (image_index 0)");
  assertStringIncludes(out, "7.2:1");
  assertStringIncludes(out, "PASS");
  assertStringIncludes(out, "#111111");
  assertStringIncludes(out, "#ffffff");
});

Deno.test("flags a failing step as FAIL", () => {
  const results: ContrastResult[] = [
    { image_index: 0, ratio: 2.1, level: "AA Fail", foreground_hex: "#aaaaaa", background_hex: "#ffffff" },
  ];
  const out = buildFlowContrastSection(results);
  assertStringIncludes(out, "2.1:1");
  assertStringIncludes(out, "FAIL");
});

Deno.test("formats multiple steps in order", () => {
  const results: ContrastResult[] = [
    { image_index: 0, ratio: 7.2, level: "AAA Pass", foreground_hex: "#111111", background_hex: "#ffffff" },
    { image_index: 1, ratio: 2.4, level: "AA Fail", foreground_hex: "#888888", background_hex: "#ffffff" },
    { image_index: 2, ratio: 4.5, level: "AA Pass", foreground_hex: "#555555", background_hex: "#ffffff" },
  ];
  const out = buildFlowContrastSection(results);
  assertStringIncludes(out, "Step 1 (image_index 0)");
  assertStringIncludes(out, "Step 2 (image_index 1)");
  assertStringIncludes(out, "Step 3 (image_index 2)");
  const i1 = out.indexOf("Step 1");
  const i2 = out.indexOf("Step 2");
  const i3 = out.indexOf("Step 3");
  assertEquals(i1 < i2 && i2 < i3, true);
});

Deno.test("includes a per-step note when contrast unavailable (ratio null)", () => {
  const results: ContrastResult[] = [
    { image_index: 0, ratio: null, level: "Unknown", foreground_hex: "#333333", background_hex: "#ffffff", note: "format not decodable" },
  ];
  const out = buildFlowContrastSection(results);
  assertStringIncludes(out, "Step 1 (image_index 0)");
  assertStringIncludes(out, "unavailable");
  assertStringIncludes(out, "format not decodable");
});

Deno.test("includes the senior filter instruction block", () => {
  const results: ContrastResult[] = [
    { image_index: 0, ratio: 4.5, level: "AA Pass", foreground_hex: "#333333", background_hex: "#ffffff" },
  ];
  const out = buildFlowContrastSection(results);
  assertStringIncludes(out, "INSTRUCTION FOR ACCESSIBILITY DATA");
  assertStringIncludes(out, "IGNORE MARGINAL FAILS");
  assertStringIncludes(out, "FLAG CRITICAL FAILURES ONLY");
});

Deno.test("PASS/FAIL is derived from ratio, not from the level field", () => {
  // Inconsistent input: level says "AA Pass" but ratio is below threshold.
  // The helper must trust ratio (the mathematical ground truth) and emit FAIL.
  const results: ContrastResult[] = [
    { image_index: 0, ratio: 2.1, level: "AA Pass", foreground_hex: "#888888", background_hex: "#ffffff" },
  ];
  const out = buildFlowContrastSection(results);
  assertStringIncludes(out, "FAIL");
  // The level string is still echoed (transparency), but PASS/FAIL is what matters.
});

Deno.test("includes Note: prefix when note is set on a step with a valid ratio", () => {
  const results: ContrastResult[] = [
    { image_index: 0, ratio: 4.8, level: "AA Pass", foreground_hex: "#222222", background_hex: "#ffffff", note: "downsampled to 400px" },
  ];
  const out = buildFlowContrastSection(results);
  assertStringIncludes(out, "4.8:1");
  assertStringIncludes(out, "Note: downsampled to 400px");
});
