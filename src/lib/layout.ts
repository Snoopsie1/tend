import { compostBoost } from "@/lib/compost";
import { daysBetween, isoWeekKey } from "@/lib/days";
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
  // A Bad whose weed was pulled into compost.
  pulled: boolean;
  x: number;
  z: number;
  yaw: number;
  scale: number;
  variant: number;
};

// Each entry stands in its stored slot, so adding or deleting an entry never
// moves the other plants. All jitter comes from the entry id. Flowers grow
// with the compost of their week.
export function layoutGarden(entries: readonly Entry[], today: string): Plant[] {
  const boost = compostBoost(entries);
  return entries.map((entry) => {
    const seed = hash(entry.id);
    const rng = mulberry32(seed);
    const slot = entry.slot % SLOTS;
    const subRow = Math.floor(entry.slot / SLOTS);
    const slotWidth = ROW_WIDTH / SLOTS;
    const growth = entry.kind === "good" ? 1 + (boost.get(isoWeekKey(entry.date)) ?? 0) : 1;
    return {
      entryId: entry.id,
      kind: entry.kind,
      tag: entry.tag,
      pulled: entry.kind === "bad" && entry.pulledAt !== undefined,
      x: (slot + 0.5) * slotWidth - ROW_WIDTH / 2 + range(rng, -0.3, 0.3) * slotWidth,
      z: -daysBetween(entry.date, today) * ROW_DEPTH - subRow * SUB_ROW_DEPTH + range(rng, -0.08, 0.08),
      yaw: range(rng, -MAX_YAW, MAX_YAW),
      scale: range(rng, 0.85, 1.15) * growth,
      variant: seed % VARIANTS,
    };
  });
}
