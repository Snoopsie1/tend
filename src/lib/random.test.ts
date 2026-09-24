import { describe, expect, it } from "vitest";
import { hash, int, mulberry32, pick, range } from "@/lib/random";

describe("mulberry32", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });

  it("gives a different sequence for a different seed", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("helpers", () => {
  it("keeps range() inside [min, max)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = range(rng, -2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(3);
    }
  });

  it("hits every value of int() over many draws", () => {
    const rng = mulberry32(7);
    const seen = new Set(Array.from({ length: 1000 }, () => int(rng, 6)));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("picks an item from the list", () => {
    const items = ["a", "b", "c"];
    expect(items).toContain(pick(mulberry32(3), items));
  });
});

describe("hash", () => {
  it("matches the FNV-1a reference value", () => {
    expect(hash("a")).toBe(0xe40c292c);
  });

  it("separates different strings", () => {
    expect(hash("demo-1-0")).not.toBe(hash("demo-1-1"));
  });
});
