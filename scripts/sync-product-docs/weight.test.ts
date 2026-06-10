import { describe, it, expect } from "vitest";
import { computeWeight, type EvidenceInput } from "./weight";

describe("computeWeight", () => {
  it("HIGH for fresh + multi-source + mature-product + direct + convergent", () => {
    const input: EvidenceInput = {
      sources: [
        { date: "2026-05-01", round: "qual_4", sourceType: "direct-quote" },
        { date: "2026-05-02", round: "qual_4", sourceType: "direct-quote" },
        { date: "2026-04-20", round: "qual_3", sourceType: "direct-quote" },
        { date: "2026-04-15", round: "qual_3", sourceType: "paraphrased" },
        { date: "2026-04-10", round: "qual_3", sourceType: "direct-quote" },
      ],
      contradictedBy: 0,
      asOf: "2026-05-12",
    };
    expect(computeWeight(input).bucket).toBe("HIGH");
  });

  it("LOW for single-source MVP-1 quote", () => {
    const input: EvidenceInput = {
      sources: [{ date: "2025-11-26", round: "MVP-1", sourceType: "direct-quote" }],
      contradictedBy: 0,
      asOf: "2026-05-12",
    };
    expect(computeWeight(input).bucket).toBe("LOW");
  });

  it("VERY_LOW for single-source older + contradicted", () => {
    const input: EvidenceInput = {
      sources: [{ date: "2025-11-26", round: "MVP-1", sourceType: "inferred" }],
      contradictedBy: 2,
      asOf: "2026-05-12",
    };
    expect(computeWeight(input).bucket).toBe("VERY_LOW");
  });

  it("MEDIUM for 2 mature-product direct quotes", () => {
    const input: EvidenceInput = {
      sources: [
        { date: "2026-05-01", round: "qual_4", sourceType: "direct-quote" },
        { date: "2026-04-15", round: "qual_3", sourceType: "direct-quote" },
      ],
      contradictedBy: 0,
      asOf: "2026-05-12",
    };
    expect(computeWeight(input).bucket).toBe("MEDIUM");
  });

  it("exposes per-axis scores", () => {
    const input: EvidenceInput = {
      sources: [{ date: "2026-05-01", round: "qual_4", sourceType: "direct-quote" }],
      contradictedBy: 0,
      asOf: "2026-05-12",
    };
    const w = computeWeight(input);
    expect(w.axes.recency).toBeGreaterThan(0);
    expect(w.axes.frequency).toBeGreaterThan(0);
    expect(w.axes.productMaturity).toBeGreaterThan(0);
    expect(w.axes.sourceType).toBeGreaterThan(0);
    expect(w.axes.convergence).toBeGreaterThan(0);
  });
});
