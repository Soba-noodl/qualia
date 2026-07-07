import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { auditDisplayName } from "./audit-display-name.ts";

Deno.test("uses single frame name when only one", () => {
  assertEquals(
    auditDisplayName({ figma_frame_names: ["Confirmation code"], screen_context: null, ai_report: null }),
    "Confirmation code",
  );
});

Deno.test("joins two frame names with separator", () => {
  assertEquals(
    auditDisplayName({ figma_frame_names: ["Login", "Onboarding"], screen_context: null, ai_report: null }),
    "Login · Onboarding",
  );
});

Deno.test("joins first two with overflow suffix when 3+", () => {
  assertEquals(
    auditDisplayName({ figma_frame_names: ["A", "B", "C", "D"], screen_context: null, ai_report: null }),
    "A · B + 2 more",
  );
});

Deno.test("falls back to prototype meta figma_file_name", () => {
  const ai_report = { prototype_meta: { figma_file_name: "Acme Onboarding Proto" } };
  assertEquals(
    auditDisplayName({ figma_frame_names: null, screen_context: null, ai_report }),
    "Acme Onboarding Proto",
  );
});

Deno.test("falls back to truncated screen_context", () => {
  assertEquals(
    auditDisplayName({
      figma_frame_names: null,
      screen_context: "User signs up after seeing the marketing landing page",
      ai_report: null,
    }),
    "User signs up after seeing the marketing…",
  );
});

Deno.test("returns Untitled audit when nothing else", () => {
  assertEquals(
    auditDisplayName({ figma_frame_names: null, screen_context: null, ai_report: null }),
    "Untitled audit",
  );
});

Deno.test("ignores empty/whitespace frame names", () => {
  assertEquals(
    auditDisplayName({ figma_frame_names: ["", "  ", "Real frame"], screen_context: null, ai_report: null }),
    "Real frame",
  );
});

Deno.test("returns short screen_context untruncated", () => {
  assertEquals(
    auditDisplayName({ figma_frame_names: null, screen_context: "Login flow", ai_report: null }),
    "Login flow",
  );
});
