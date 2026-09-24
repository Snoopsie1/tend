import { addDays } from "@/lib/days";
import { TAGS, type Entry, type Tag } from "@/lib/entries";
import { hash, int, mulberry32, pick } from "@/lib/random";

const GOODS: Record<Tag, readonly string[]> = {
  people: [
    "Long call with my sister",
    "Dinner with old friends",
    "Mom sent a photo of her garden",
    "A stranger held the door and smiled",
    "Laughed until it hurt at lunch",
    "The neighbour brought cake",
    "Board game night that ran way too late",
    "A friend remembered something I said weeks ago",
  ],
  body: [
    "Slept eight hours",
    "Ran 5 km without stopping",
    "A long hot shower",
    "Stretched for ten minutes before bed",
    "My knee felt fine on the stairs",
    "Cooked a proper dinner",
    "Walked to work instead of taking the bus",
    "Went to bed before midnight",
  ],
  work: [
    "Shipped the fix before lunch",
    "The review went well",
    "Finished the hard part of the task",
    "Good feedback on my pull request",
    "Helped a colleague get unstuck",
    "A meeting that ended early",
    "Figured out the bug on the walk home",
    "Cleared the whole to-do list",
  ],
  nature: [
    "Sun on my face on the way home",
    "Saw a heron by the lake",
    "First snowdrops in the park",
    "Rain on the window while I read",
    "A walk in the woods",
    "Sunset over the rooftops",
    "A blackbird singing outside",
    "Frost on every leaf this morning",
  ],
  smallJoys: [
    "A perfect cup of coffee",
    "Found a new song I love",
    "Fresh bread from the bakery",
    "A great chapter in my book",
    "The bus came right away",
    "Clean sheets",
    "Found 20 kroner in an old jacket",
    "The cat slept on my lap all evening",
  ],
};

const BADS: readonly string[] = [
  "Slept badly",
  "Missed the train",
  "Argued about nothing",
  "Headache all afternoon",
  "The deploy failed twice",
  "Felt left out",
  "Spilled coffee on my shirt",
  "Too much time on my phone",
  "Forgot an important email",
  "Cold and grey all day",
  "Snapped at someone I love",
  "Stuck in traffic for an hour",
  "Worried about money",
  "Skipped the gym again",
];

// About 6 months of fake entries ending at today. Each day's content comes
// from a seed of its offset from today, so the demo garden looks the same on
// every visit and only the dates move. Entries come out in creation order.
export function demoEntries(today: string, days = 182): Entry[] {
  const entries: Entry[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const rng = mulberry32(hash(`demo:${offset}`));
    const date = addDays(today, -offset);
    const kinds: Entry["kind"][] = [
      ...Array<Entry["kind"]>(1 + int(rng, 7)).fill("good"),
      ...Array<Entry["kind"]>(int(rng, 4)).fill("bad"),
    ];
    // Fisher-Yates, so Bads land between Goods like a real day.
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = int(rng, i + 1);
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    kinds.forEach((kind, i) => {
      const id = `demo-${offset}-${i}`;
      if (kind === "good") {
        const tag = pick(rng, TAGS);
        entries.push({ id, date, kind, tag, text: pick(rng, GOODS[tag]) });
      } else {
        entries.push({ id, date, kind, text: pick(rng, BADS) });
      }
    });
  }
  return entries;
}
