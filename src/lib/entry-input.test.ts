import { describe, expect, it } from "vitest";
import { toEntry } from "@/lib/entries";
import { parseCode, parseEmail, parseNewEntry, parseText } from "@/lib/entry-input";

const LATEST = "2026-09-25";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("parseNewEntry", () => {
  it("accepts a tagged Good", () => {
    expect(parseNewEntry(form({ kind: "good", tag: "people", date: "2026-09-24", text: " Coffee with Mads " }), LATEST)).toEqual({
      kind: "good",
      tag: "people",
      date: "2026-09-24",
      text: "Coffee with Mads",
    });
  });

  it("accepts a Bad without a tag", () => {
    expect(parseNewEntry(form({ kind: "bad", date: "2026-09-24", text: "Slept badly" }), LATEST)).toEqual({
      kind: "bad",
      date: "2026-09-24",
      text: "Slept badly",
    });
  });

  it("rejects a Good without a tag and a Bad with one", () => {
    expect(parseNewEntry(form({ kind: "good", date: "2026-09-24", text: "x" }), LATEST)).toBeNull();
    expect(parseNewEntry(form({ kind: "bad", tag: "work", date: "2026-09-24", text: "x" }), LATEST)).toBeNull();
    expect(parseNewEntry(form({ kind: "good", tag: "cats", date: "2026-09-24", text: "x" }), LATEST)).toBeNull();
  });

  it("rejects unknown kinds, bad dates and future days", () => {
    expect(parseNewEntry(form({ kind: "meh", date: "2026-09-24", text: "x" }), LATEST)).toBeNull();
    expect(parseNewEntry(form({ kind: "bad", date: "2026-02-31", text: "x" }), LATEST)).toBeNull();
    expect(parseNewEntry(form({ kind: "bad", date: "24/09/2026", text: "x" }), LATEST)).toBeNull();
    expect(parseNewEntry(form({ kind: "bad", date: "2026-09-26", text: "x" }), LATEST)).toBeNull();
  });
});

describe("parseText", () => {
  it("keeps 1 to 280 characters after trimming", () => {
    expect(parseText("   ")).toBeNull();
    expect(parseText("a".repeat(280))).toHaveLength(280);
    expect(parseText("a".repeat(281))).toBeNull();
    expect(parseText(42)).toBeNull();
  });
});

describe("login input", () => {
  it("normalises an email address", () => {
    expect(parseEmail(" Oli@Example.COM ")).toBe("oli@example.com");
    expect(parseEmail("not an email")).toBeNull();
  });

  it("keeps only the digits of a code", () => {
    expect(parseCode("123 456")).toBe("123456");
    expect(parseCode("12345")).toBeNull();
    expect(parseCode("12345678901")).toBeNull();
  });
});

describe("toEntry", () => {
  it("maps a table row and drops empty fields", () => {
    expect(
      toEntry({ id: "1", date: "2026-09-24", kind: "bad", tag: null, text: "x", slot: 2, pulled_at: null }),
    ).toEqual({ id: "1", date: "2026-09-24", kind: "bad", text: "x", slot: 2 });
    expect(
      toEntry({ id: "2", date: "2026-09-24", kind: "bad", tag: null, text: "x", slot: 0, pulled_at: "2026-09-25T10:00:00Z" })
        .pulledAt,
    ).toBe("2026-09-25T10:00:00Z");
  });
});
