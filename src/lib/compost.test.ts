import { describe, expect, it } from "vitest";
import { compostBoost } from "@/lib/compost";
import type { Entry } from "@/lib/entries";

const bad = (id: string, date: string, pulledAt?: string): Entry => ({
  id,
  date,
  kind: "bad",
  text: id,
  slot: 0,
  ...(pulledAt ? { pulledAt } : {}),
});
const PULLED = "2026-09-25T10:00:00Z";

describe("compostBoost", () => {
  it("gives nothing without pulled weeds", () => {
    expect(compostBoost([bad("a", "2026-09-22"), bad("b", "2026-09-23")]).size).toBe(0);
  });

  it("adds 15% per pulled weed in the week", () => {
    const boost = compostBoost([bad("a", "2026-09-22", PULLED), bad("b", "2026-09-23", PULLED)]);
    expect(boost.get("2026-W39")).toBeCloseTo(0.3, 6);
  });

  it("stops at 45%", () => {
    const four = ["a", "b", "c", "d"].map((id) => bad(id, "2026-09-22", PULLED));
    expect(compostBoost(four).get("2026-W39")).toBeCloseTo(0.45, 6);
  });

  it("counts each weed in the week of its own date", () => {
    const boost = compostBoost([bad("a", "2026-09-20", PULLED), bad("b", "2026-09-21", PULLED)]);
    expect(boost.get("2026-W38")).toBeCloseTo(0.15, 6);
    expect(boost.get("2026-W39")).toBeCloseTo(0.15, 6);
  });
});
