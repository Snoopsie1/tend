import { describe, expect, it } from "vitest";
import { MAX_BOOST } from "@/lib/compost";
import { demoEntries } from "@/lib/demo-data";
import type { Entry } from "@/lib/entries";
import { ROW_DEPTH, ROW_WIDTH, layoutGarden } from "@/lib/layout";
import { speciesOf } from "@/lib/species";

const TODAY = "2026-09-24";

const groupByDate = (list: Entry[]) => {
  const days = new Map<string, Entry[]>();
  for (const e of list) days.set(e.date, [...(days.get(e.date) ?? []), e]);
  return days;
};

const good = (id: string, date: string, slot: number): Entry => ({ id, date, kind: "good", tag: "body", text: id, slot });
const bad = (id: string, date: string, slot: number, pulledAt?: string): Entry => ({
  id,
  date,
  kind: "bad",
  text: id,
  slot,
  ...(pulledAt ? { pulledAt } : {}),
});

const entries = demoEntries(TODAY);
const plants = layoutGarden(entries, TODAY);

describe("layoutGarden", () => {
  it("puts each day in its row, today at the front", () => {
    const today = plants.filter((_, i) => entries[i].date === TODAY);
    for (const p of today) expect(p.z).toBeGreaterThan(-0.6);
    const [yesterday] = layoutGarden([good("x", "2026-09-23", 0)], TODAY);
    expect(Math.abs(yesterday.z + ROW_DEPTH)).toBeLessThanOrEqual(0.08);
  });

  it("keeps every plant inside the row width", () => {
    for (const p of plants) expect(Math.abs(p.x)).toBeLessThanOrEqual(ROW_WIDTH / 2);
  });

  it("gives plants of the same day different positions", () => {
    const today = plants.filter((_, i) => entries[i].date === TODAY);
    const positions = new Set(today.map((p) => `${p.x.toFixed(3)}:${p.z.toFixed(3)}`));
    expect(positions.size).toBe(today.length);
  });

  it("never moves existing plants when a new entry is added", () => {
    const after = layoutGarden([...entries, good("new", TODAY, 99)], TODAY);
    expect(after.slice(0, plants.length)).toEqual(plants);
  });

  it("never moves the other plants when an entry is deleted", () => {
    const day = [good("a", TODAY, 0), good("b", TODAY, 1), good("c", TODAY, 2)];
    const [a, , c] = layoutGarden(day, TODAY);
    expect(layoutGarden([day[0], day[2]], TODAY)).toEqual([a, c]);
  });

  it("does not depend on the order of the entries", () => {
    const reversed = [...groupByDate(entries).values()].reverse().flat();
    const again = new Map(layoutGarden(reversed, TODAY).map((p) => [p.entryId, p]));
    for (const p of plants) expect(again.get(p.entryId)).toEqual(p);
  });

  it("turns a pulled Bad into compost", () => {
    const [weed, mound] = layoutGarden([bad("w", TODAY, 0), bad("m", TODAY, 1, "2026-09-24T12:00:00Z")], TODAY);
    expect(speciesOf(weed)).toBe("weed");
    expect(speciesOf(mound)).toBe("compost");
  });

  it("grows the flowers of a week by 15% per pulled weed, but not the weeds", () => {
    const week = [good("g", "2026-09-22", 0), bad("b", "2026-09-23", 0)];
    const [flower, weed] = layoutGarden(week, TODAY);
    const pulled = layoutGarden([week[0], { ...week[1], pulledAt: "2026-09-24T08:00:00Z" }], TODAY);
    expect(pulled[0].scale).toBeCloseTo(flower.scale * 1.15, 6);
    expect(pulled[1].scale).toBe(weed.scale);
  });

  it("leaves the flowers of other weeks alone", () => {
    // 2026-09-20 is a Sunday, so the pulled weed on Monday the 21st is in the next ISO week.
    const lastWeek = good("g", "2026-09-20", 0);
    const [before] = layoutGarden([lastWeek], TODAY);
    const [after] = layoutGarden([lastWeek, bad("b", "2026-09-21", 0, "2026-09-22T08:00:00Z")], TODAY);
    expect(after.scale).toBe(before.scale);
  });

  it("keeps variants, scale and kind in range", () => {
    for (const [i, p] of plants.entries()) {
      expect([0, 1, 2]).toContain(p.variant);
      expect(p.scale).toBeGreaterThanOrEqual(0.85);
      expect(p.scale).toBeLessThanOrEqual(1.15 * (1 + MAX_BOOST));
      expect(p.kind).toBe(entries[i].kind);
      if (p.kind === "bad") {
        expect(p.tag).toBeUndefined();
        expect(p.scale).toBeLessThanOrEqual(1.15);
      }
    }
  });

  it("lays out an empty garden", () => {
    expect(layoutGarden([], TODAY)).toEqual([]);
  });
});
