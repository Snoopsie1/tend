import { isoWeekKey } from "@/lib/days";
import type { Entry } from "@/lib/entries";

// Each pulled weed feeds the flowers of its own week.
export const BOOST_PER_WEED = 0.15;
export const MAX_BOOST = 0.45;

// Extra flower scale per ISO week, from the weeds pulled in that week. The
// week is the Bad's own date, not the day it was pulled.
export function compostBoost(entries: readonly Entry[]) {
  const pulled = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind === "bad" && entry.pulledAt) {
      const week = isoWeekKey(entry.date);
      pulled.set(week, (pulled.get(week) ?? 0) + 1);
    }
  }
  return new Map([...pulled].map(([week, count]) => [week, Math.min(count * BOOST_PER_WEED, MAX_BOOST)]));
}
