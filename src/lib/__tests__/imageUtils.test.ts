import { describe, it, expect } from "vitest";
import { box2dToPixelRect, badgePosition } from "../imageUtils";

describe("box2dToPixelRect", () => {
  it("converts 0-1000 scale box_2d to pixel coordinates", () => {
    // box_2d = [ymin, xmin, ymax, xmax] on 0-1000 scale
    const result = box2dToPixelRect([100, 200, 400, 600], 1000, 800);
    expect(result).toEqual({ x: 200, y: 80, w: 400, h: 240 });
  });

  it("handles full-image box", () => {
    const result = box2dToPixelRect([0, 0, 1000, 1000], 500, 500);
    expect(result).toEqual({ x: 0, y: 0, w: 500, h: 500 });
  });

  it("clamps to image bounds", () => {
    const result = box2dToPixelRect([0, 0, 1100, 1100], 100, 100);
    expect(result).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
});

describe("badgePosition", () => {
  it("places badge outside the top-left corner of the box", () => {
    // box pixel rect {x:100, y:80, w:200, h:60}, badge radius 12
    const pos = badgePosition({ x: 100, y: 80, w: 200, h: 60 }, 12);
    // badge center = (x - radius, y - radius) = (88, 68)
    expect(pos).toEqual({ cx: 88, cy: 68 });
  });

  it("clamps badge to image bounds (left edge)", () => {
    const pos = badgePosition({ x: 5, y: 5, w: 100, h: 50 }, 12);
    expect(pos.cx).toBeGreaterThanOrEqual(12);
    expect(pos.cy).toBeGreaterThanOrEqual(12);
  });
});
