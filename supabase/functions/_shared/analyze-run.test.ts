import { assertStringIncludes, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildAnalysisPrompts } from "./analyze-run.ts";

const baseParams = {
  mission: "Help users sign up faster",
  persona: "Busy professional",
  constraints: "Mobile-first",
  screenContext: "Onboarding flow",
  userDataBlock: "",
  additionalContextBlock: "",
  projectLanguage: "English",
};

Deno.test("flow mode: contrastDataSection is substituted into the prompt", () => {
  const contrast = "HARD DATA - ACCESSIBILITY (per step):\nStep 1 (image_index 0): ratio 2.1:1 (FAIL - AA Fail).";
  const { systemPrompt } = buildAnalysisPrompts({
    ...baseParams,
    isFlowMode: true,
    stepCount: 3,
    contrastDataSection: contrast,
  });
  assertStringIncludes(systemPrompt, "Step 1 (image_index 0): ratio 2.1:1");
  assertEquals(systemPrompt.includes("{contrast_data}"), false);
});

Deno.test("flow mode: empty contrastDataSection collapses cleanly (no leftover placeholder)", () => {
  const { systemPrompt } = buildAnalysisPrompts({
    ...baseParams,
    isFlowMode: true,
    stepCount: 3,
    contrastDataSection: "",
  });
  assertEquals(systemPrompt.includes("{contrast_data}"), false);
});

Deno.test("single mode: contrastDataSection still substituted (regression check)", () => {
  const contrast = "HARD DATA - ACCESSIBILITY:\nThe mathematically calculated contrast ratio is 4.8:1.";
  const { systemPrompt } = buildAnalysisPrompts({
    ...baseParams,
    isFlowMode: false,
    contrastDataSection: contrast,
  });
  assertStringIncludes(systemPrompt, "4.8:1");
  assertEquals(systemPrompt.includes("{contrast_data}"), false);
});
