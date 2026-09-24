import { describe, expect, it } from "vitest";
import { FIT_ASPECT, depthForPixelSize, fitDistance, pitchFor, pixelSizeAtDepth } from "@/lib/camera-fit";

const FOV = 45;

describe("camera fit", () => {
  it("backs off on a portrait phone", () => {
    expect(fitDistance(390 / 844, FOV, 4, 0.2)).toBeCloseTo(11.5, 1);
  });

  it("keeps the aspect-1.3 distance on wider screens", () => {
    expect(fitDistance(16 / 9, FOV, 4, 0.2)).toBe(fitDistance(FIT_ASPECT, FOV, 4, 0.2));
  });

  it("fills the screen width with the row", () => {
    for (const aspect of [390 / 844, 0.75, 1, FIT_ASPECT]) {
      const height = 844;
      const distance = fitDistance(aspect, FOV, 4, 0.2);
      expect(pixelSizeAtDepth(4 + 2 * 0.2, distance, FOV, height)).toBeCloseTo(height * aspect, 6);
    }
  });

  it("looks down more steeply on tall screens", () => {
    const degrees = (aspect: number) => (pitchFor(aspect) * 180) / Math.PI;
    expect(degrees(16 / 9)).toBeCloseTo(32, 6);
    expect(degrees(FIT_ASPECT)).toBeCloseTo(32, 6);
    expect(degrees(390 / 844)).toBeCloseTo(55, 6);
    expect(degrees(0.3)).toBeCloseTo(55, 6);
    expect(degrees(0.9)).toBeGreaterThan(32);
    expect(degrees(0.9)).toBeLessThan(55);
  });

  it("inverts pixel size and depth", () => {
    const depth = depthForPixelSize(0.3, 12, FOV, 844);
    expect(pixelSizeAtDepth(0.3, depth, FOV, 844)).toBeCloseTo(12, 6);
  });
});
