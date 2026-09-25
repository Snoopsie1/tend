export const TAGS = ["people", "body", "work", "nature", "smallJoys"] as const;

export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<Tag, string> = {
  people: "people",
  body: "body",
  work: "work",
  nature: "nature",
  smallJoys: "small joys",
};

// Same limit as the check in supabase/migrations/0001_entries.sql.
export const TEXT_MAX = 280;

export type Entry = {
  id: string;
  // Local calendar day, "YYYY-MM-DD".
  date: string;
  kind: "good" | "bad";
  // Goods only.
  tag?: Tag;
  text: string;
  // The plant's place in its day's row. Stored, so deleting an entry never
  // moves another plant.
  slot: number;
  // Bads only. When the weed was pulled into compost, an ISO timestamp.
  pulledAt?: string;
};

// A row of the entries table, as supabase-js returns it.
export type EntryRow = {
  id: string;
  date: string;
  kind: Entry["kind"];
  tag: Tag | null;
  text: string;
  slot: number;
  pulled_at: string | null;
};

export const ENTRY_COLUMNS = "id,date,kind,tag,text,slot,pulled_at";

export const toEntry = (row: EntryRow): Entry => ({
  id: row.id,
  date: row.date,
  kind: row.kind,
  ...(row.tag ? { tag: row.tag } : {}),
  text: row.text,
  slot: row.slot,
  ...(row.pulled_at ? { pulledAt: row.pulled_at } : {}),
});
