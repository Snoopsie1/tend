import { describe, expect, it } from "vitest";
import { demoEntries } from "@/lib/demo-data";
import type { Entry } from "@/lib/entries";
import { ROW_DEPTH, ROW_WIDTH, layoutGarden } from "@/lib/layout";

const TODAY = "2026-09-24";

const groupByDate = (list: Entry[]) => {
  const days = new Map<string, Entry[]>();
  for (const e of list) days.set(e.date, [...(days.get(e.date) ?? []), e]);
  return days;
};
const entries = demoEntries(TODAY);
const plants = layoutGarden(entries, TODAY);

describe("layoutGarden", () => {
  it("puts each day in its row, today at the front", () => {
    const today = plants.filter((_, i) => entries[i].date === TODAY);
    for (const p of today) expect(p.z).toBeGreaterThan(-0.6);
    const yesterday = layoutGarden([{ id: "x", date: "2026-09-23", kind: "good", tag: "body", text: "" }], TODAY)[0];
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
    const extra: Entry = { id: "new", date: TODAY, kind: "good", tag: "nature", text: "" };
    const after = layoutGarden([...entries, extra], TODAY);
    expect(after.slice(0, plants.length)).toEqual(plants);
  });

  it("does not depend on the order of the days", () => {
    const byDate = groupByDate(entries);
    const reversed = [...byDate.values()].reverse().flat();
    const again = new Map(layoutGarden(reversed, TODAY).map((p) => [p.entryId, p]));
    for (const p of plants) expect(again.get(p.entryId)).toEqual(p);
  });

  it("keeps variants, scale and kind in range", () => {
    for (const [i, p] of plants.entries()) {
      expect([0, 1, 2]).toContain(p.variant);
      expect(p.scale).toBeGreaterThanOrEqual(0.85);
      expect(p.scale).toBeLessThanOrEqual(1.15);
      expect(p.kind).toBe(entries[i].kind);
      if (p.kind === "bad") expect(p.tag).toBeUndefined();
    }
  });
});
