import { daysBetween } from "@/lib/days";
import type { Entry, Tag } from "@/lib/entries";
import { hash, mulberry32, range } from "@/lib/random";

// Every day is one row of the same width, today at z = 0 and older days
// further back along -z.
export const ROW_WIDTH = 4;
export const ROW_DEPTH = 0.7;
const SLOTS = 5;
const SUB_ROW_DEPTH = 0.25;
// Plants turn at most this far from facing the camera, so tilted heads stay
// readable.
const MAX_YAW = 0.6;

export const VARIANTS = 3;

export type Plant = {
  entryId: string;
  kind: Entry["kind"];
  tag?: Tag;
  x: number;
  z: number;
  yaw: number;
  scale: number;
  variant: number;
};

// Entries must come in creation order. The k-th entry of a day takes slot
// k, so a new entry never moves the plants that are already there. All
// jitter comes from the entry id, never from the array index.
export function layoutGarden(entries: readonly Entry[], today: string): Plant[] {
  const countPerDay = new Map<string, number>();
  return entries.map((entry) => {
    const k = countPerDay.get(entry.date) ?? 0;
    countPerDay.set(entry.date, k + 1);

    const seed = hash(entry.id);
    const rng = mulberry32(seed);
    const slot = k % SLOTS;
    const subRow = Math.floor(k / SLOTS);
    const slotWidth = ROW_WIDTH / SLOTS;
    return {
      entryId: entry.id,
      kind: entry.kind,
      tag: entry.tag,
      x: (slot + 0.5) * slotWidth - ROW_WIDTH / 2 + range(rng, -0.3, 0.3) * slotWidth,
      z: -daysBetween(entry.date, today) * ROW_DEPTH - subRow * SUB_ROW_DEPTH + range(rng, -0.08, 0.08),
      yaw: range(rng, -MAX_YAW, MAX_YAW),
      scale: range(rng, 0.85, 1.15),
      variant: seed % VARIANTS,
    };
  });
}
