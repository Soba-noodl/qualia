import { describe, it, expect } from "vitest";
import {
  buildProjectContextSection,
  buildAuditSummarySection,
  engineLabel,
  buildAuditSourceSection,
  buildDesignSystemSection,
} from "../exportAuditAi";

describe("engineLabel", () => {
  it("returns human-readable labels", () => {
    expect(engineLabel("system_logic")).toBe("System Logic");
    expect(engineLabel("heuristic")).toBe("Heuristics");
    expect(engineLabel("cognitive")).toBe("Cognitive");
    expect(engineLabel("interaction")).toBe("Interaction");
  });

  it("falls back to the raw key for unknown engines", () => {
    expect(engineLabel("unknown_engine")).toBe("unknown_engine");
  });
});

describe("buildProjectContextSection", () => {
  it("renders all fields when present", () => {
    const result = buildProjectContextSection({
      name: "Acme", mission: "Sell fast", constraints: "Mobile",
      personas: [{ name: "New buyer", description: "Low digital literacy" }],
      screenGoal: "Complete checkout",
    });
    expect(result).toContain("**Product:** Acme");
    expect(result).toContain("**Mission:** Sell fast");
    expect(result).toContain("**Constraints:** Mobile");
    expect(result).toContain("New buyer");
    expect(result).toContain("**Screen goal:** Complete checkout");
  });

  it("omits constraints line when null", () => {
    const result = buildProjectContextSection({
      name: "X", mission: "Y", constraints: null, personas: [], screenGoal: null,
    });
    expect(result).not.toContain("Constraints");
  });

  it("omits personas line when empty", () => {
    const result = buildProjectContextSection({
      name: "X", mission: "Y", constraints: null, personas: [], screenGoal: null,
    });
    expect(result).not.toContain("Personas");
  });

  it("omits screen goal when null", () => {
    const result = buildProjectContextSection({
      name: "X", mission: "Y", constraints: null, personas: [], screenGoal: null,
    });
    expect(result).not.toContain("Screen goal");
  });
});

describe("buildAuditSummarySection", () => {
  it("renders score, one_big_thing, and sub-scores", () => {
    const result = buildAuditSummarySection({
      score: 72, one_big_thing: "Checkout is broken",
      sub_scores: { system_logic_score: 60, heuristic_score: 80, cognitive_score: 70, interaction_score: 78 },
      isPrototype: false,
    });
    expect(result).toContain("72/100");
    expect(result).toContain("Checkout is broken");
    expect(result).toContain("System logic: 60");
    expect(result).toContain("Heuristics: 80");
  });

  it("omits sub-scores block when undefined", () => {
    const result = buildAuditSummarySection({
      score: 50, one_big_thing: "Bad", sub_scores: undefined, isPrototype: false,
    });
    expect(result).not.toContain("System logic");
  });

  it("includes prototype extra scores when isPrototype", () => {
    const result = buildAuditSummarySection({
      score: 65, one_big_thing: "Flow issues",
      sub_scores: { system_logic_score: 60, heuristic_score: 70, cognitive_score: 65, interaction_score: 68,
        prototype_completeness_score: 55, cross_frame_score: 50 },
      isPrototype: true,
    });
    expect(result).toContain("Prototype completeness: 55");
    expect(result).toContain("Cross-frame: 50");
  });
});

describe("buildAuditSourceSection", () => {
  it("includes prototype URL and deep figma flag when true", () => {
    const result = buildAuditSourceSection({
      screenCount: 5,
      prototypeUrl: "https://figma.com/proto/abc",
      deepFigmaUi: true,
    });
    expect(result).toContain("5 screens");
    expect(result).toContain("https://figma.com/proto/abc");
    expect(result).toContain("Yes");
  });

  it("omits URL line when prototypeUrl is null", () => {
    const result = buildAuditSourceSection({ screenCount: 3, prototypeUrl: null, deepFigmaUi: false });
    expect(result).not.toContain("Prototype URL");
  });

  it("shows No for deepFigmaUi false", () => {
    const result = buildAuditSourceSection({ screenCount: 2, prototypeUrl: null, deepFigmaUi: false });
    expect(result).toContain("No");
  });
});

describe("buildDesignSystemSection", () => {
  it("renders verdict and each dimension", () => {
    const result = buildDesignSystemSection({
      components: "good components",
      color: "partial color",
      typography: "poor typography",
      spacing_layout: "good spacing",
      interactive_states: "partial states",
      iconography: "good icons",
      microcopy_voice: "good voice",
      verdict: "Partially enforced system",
    });
    expect(result).toContain("Partially enforced system");
    expect(result).toContain("**Components:**");
    expect(result).toContain("**Typography:**");
  });

  it("includes token_consistency and component_library when present", () => {
    const result = buildDesignSystemSection({
      components: "c", color: "c", typography: "c", spacing_layout: "c",
      interactive_states: "c", iconography: "c", microcopy_voice: "c",
      verdict: "v",
      token_consistency: "token issues",
      component_library: "library partial",
    });
    expect(result).toContain("**Token Consistency:**");
    expect(result).toContain("**Component Library:**");
  });
});
