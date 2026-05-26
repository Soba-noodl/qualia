import { describe, it, expect } from "vitest";
import { scoreToTailwindColor, scoreToBadgeClasses, SCORE_THRESHOLDS } from "../score-colors";

describe("scoreToTailwindColor", () => {
  it("returns green for scores at or above GOOD threshold", () => {
    expect(scoreToTailwindColor(SCORE_THRESHOLDS.GOOD)).toBe("text-green-400");
    expect(scoreToTailwindColor(100)).toBe("text-green-400");
    expect(scoreToTailwindColor(82)).toBe("text-green-400");
  });

  it("returns amber for scores between WARNING and GOOD", () => {
    expect(scoreToTailwindColor(SCORE_THRESHOLDS.WARNING)).toBe("text-amber-400");
    expect(scoreToTailwindColor(79)).toBe("text-amber-400");
    expect(scoreToTailwindColor(60)).toBe("text-amber-400");
  });

  it("returns red for scores below WARNING threshold", () => {
    expect(scoreToTailwindColor(49)).toBe("text-red-400");
    expect(scoreToTailwindColor(0)).toBe("text-red-400");
  });
});

describe("scoreToBadgeClasses", () => {
  it("returns green badge classes for scores at or above GOOD threshold", () => {
    expect(scoreToBadgeClasses(SCORE_THRESHOLDS.GOOD)).toBe("bg-green-500/20 text-green-400");
    expect(scoreToBadgeClasses(100)).toBe("bg-green-500/20 text-green-400");
    expect(scoreToBadgeClasses(82)).toBe("bg-green-500/20 text-green-400");
  });

  it("returns amber badge classes for scores between WARNING and GOOD", () => {
    expect(scoreToBadgeClasses(SCORE_THRESHOLDS.WARNING)).toBe("bg-amber-500/20 text-amber-400");
    expect(scoreToBadgeClasses(79)).toBe("bg-amber-500/20 text-amber-400");
    expect(scoreToBadgeClasses(60)).toBe("bg-amber-500/20 text-amber-400");
  });

  it("returns red badge classes for scores below WARNING threshold", () => {
    expect(scoreToBadgeClasses(49)).toBe("bg-red-500/20 text-red-400");
    expect(scoreToBadgeClasses(0)).toBe("bg-red-500/20 text-red-400");
  });
});
