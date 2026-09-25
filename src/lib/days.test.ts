import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDay, isDayKey, isoWeekKey, localDayKey } from "@/lib/days";

describe("days", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts whole days across a daylight saving change", () => {
    // Denmark moves the clocks on the last Sunday of March.
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });

  it("uses the local calendar day", () => {
    expect(localDayKey(new Date(2026, 8, 24, 23, 30))).toBe("2026-09-24");
  });

  it("names ISO weeks, including across year ends", () => {
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
    expect(isoWeekKey("2025-12-29")).toBe("2026-W01");
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
    expect(isoWeekKey("2026-09-20")).toBe("2026-W38");
    expect(isoWeekKey("2026-09-21")).toBe("2026-W39");
  });

  it("knows a real calendar day", () => {
    expect(isDayKey("2026-09-24")).toBe(true);
    expect(isDayKey("2026-02-31")).toBe(false);
    expect(isDayKey("2026-9-24")).toBe(false);
  });

  it("formats a day for the entry card", () => {
    expect(formatDay("2026-09-24")).toBe("Thursday 24 September");
  });
});
