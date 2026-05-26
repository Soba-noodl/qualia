import { describe, it, expect } from "vitest";
import { summaryRating, isPositiveVerdict } from "../../ui/utils/designSystemRating";

describe("summaryRating", () => {
  const make = (ratings: Record<string, string>) => {
    const ds: Record<string, unknown> = { verdict: "" };
    for (const [k, v] of Object.entries(ratings)) {
      ds[k] = { rating: v, verdict: "", action: "" };
    }
    return ds;
  };

  it("returns 'partial' when no ratings present (fallback)", () => {
    expect(summaryRating({ verdict: "" })).toBe("partial");
  });

  it("returns 'poor' when ≥40% of categories are poor", () => {
    expect(summaryRating(make({ components: "poor", color: "poor", typography: "good", spacing_layout: "good", interactive_states: "good" }))).toBe("poor");
  });

  it("returns 'partial' when poor+partial ≥50%", () => {
    expect(summaryRating(make({ components: "partial", color: "partial", typography: "partial", spacing_layout: "good", interactive_states: "good" }))).toBe("partial");
  });

  it("returns 'outstanding' when no poor and ≥60% outstanding", () => {
    expect(summaryRating(make({ components: "outstanding", color: "outstanding", typography: "outstanding", spacing_layout: "outstanding", interactive_states: "good" }))).toBe("outstanding");
  });

  it("returns 'good' for healthy mix without enough outstanding", () => {
    expect(summaryRating(make({ components: "good", color: "good", typography: "good", spacing_layout: "outstanding", interactive_states: "good" }))).toBe("good");
  });
});

describe("isPositiveVerdict", () => {
  it("matches 'coherent', 'consistent', 'well-enforced', 'strong' case-insensitively", () => {
    expect(isPositiveVerdict("Coherent design system")).toBe(true);
    expect(isPositiveVerdict("a CONSISTENT palette")).toBe(true);
    expect(isPositiveVerdict("well-enforced tokens")).toBe(true);
    expect(isPositiveVerdict("Strong typography hierarchy")).toBe(true);
  });

  it("returns false for negative verdicts", () => {
    expect(isPositiveVerdict("inconsistent components and weak tokens")).toBe(false);
    expect(isPositiveVerdict("patchwork of styles")).toBe(false);
  });
});
