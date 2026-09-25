import { describe, expect, it } from "vitest";
import { PLANT_GEOMETRIES, buildPlant, type Species } from "@/lib/species";

// Triangle budgets keep ~1200 instances cheap on a mid-range phone.
const BUDGET: Record<Species, number> = {
  people: 300,
  body: 300,
  work: 300,
  nature: 300,
  smallJoys: 300,
  weed: 60,
  compost: 60,
};

describe("plant geometries", () => {
  for (const [species, variants] of Object.entries(PLANT_GEOMETRIES) as [Species, typeof PLANT_GEOMETRIES.weed][]) {
    it(`builds ${species} inside its budget, with ink colors`, () => {
      expect(variants).toHaveLength(3);
      for (const geometry of variants) {
        expect(geometry.getAttribute("color")).toBeDefined();
        expect(geometry.index!.count / 3).toBeLessThanOrEqual(BUDGET[species]);
      }
    });

    it(`builds the same ${species} for the same seed`, () => {
      const a = buildPlant(species, 99).getAttribute("position").array;
      const b = buildPlant(species, 99).getAttribute("position").array;
      expect(a).toEqual(b);
    });
  }
});
