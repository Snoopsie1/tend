import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/days";
import { demoEntries } from "@/lib/demo-data";
import { TAGS, type Entry } from "@/lib/entries";

const TODAY = "2026-09-24";

const groupByDate = (list: Entry[]) => {
  const days = new Map<string, Entry[]>();
  for (const e of list) days.set(e.date, [...(days.get(e.date) ?? []), e]);
  return days;
};

describe("demoEntries", () => {
  const entries = demoEntries(TODAY);

  it("covers 182 days that end today", () => {
    const dates = [...new Set(entries.map((e) => e.date))].sort();
    expect(dates).toHaveLength(182);
    expect(dates[0]).toBe(addDays(TODAY, -181));
    expect(dates.at(-1)).toBe(TODAY);
  });

  it("has 1-7 Goods and 0-3 Bads every day", () => {
    const byDate = groupByDate(entries);
    for (const day of byDate.values()) {
      const goods = day.filter((e) => e.kind === "good").length;
      expect(goods).toBeGreaterThanOrEqual(1);
      expect(goods).toBeLessThanOrEqual(7);
      expect(day.length - goods).toBeLessThanOrEqual(3);
    }
    expect(entries.length).toBeGreaterThan(700);
    expect(entries.length).toBeLessThan(1400);
  });

  it("tags every Good and no Bad", () => {
    for (const e of entries) {
      if (e.kind === "good") expect(TAGS).toContain(e.tag);
      else expect(e.tag).toBeUndefined();
    }
  });

  it("uses unique ids", () => {
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });

  it("is the same garden for the same day", () => {
    expect(demoEntries(TODAY)).toEqual(entries);
  });

  it("is the same garden tomorrow, with every date one day later", () => {
    const tomorrow = demoEntries(addDays(TODAY, 1));
    expect(tomorrow.map(({ id, text }) => ({ id, text }))).toEqual(entries.map(({ id, text }) => ({ id, text })));
    expect(tomorrow.map((e) => e.date)).toEqual(entries.map((e) => addDays(e.date, 1)));
  });
});
