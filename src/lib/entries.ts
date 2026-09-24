export const TAGS = ["people", "body", "work", "nature", "smallJoys"] as const;

export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<Tag, string> = {
  people: "people",
  body: "body",
  work: "work",
  nature: "nature",
  smallJoys: "small joys",
};

export type Entry = {
  id: string;
  // Local calendar day, "YYYY-MM-DD".
  date: string;
  kind: "good" | "bad";
  // Goods only.
  tag?: Tag;
  text: string;
};
