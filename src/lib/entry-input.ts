// Checks for what the server actions receive from forms. Anything that fails
// comes back as null, and the action answers with an error.

import { isDayKey } from "@/lib/days";
import { TAGS, TEXT_MAX, type Entry, type Tag } from "@/lib/entries";

export type NewEntry = Pick<Entry, "date" | "kind" | "tag" | "text">;

const isTag = (value: unknown): value is Tag => TAGS.includes(value as Tag);

// Trimmed, 1 to TEXT_MAX characters.
export function parseText(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length >= 1 && text.length <= TEXT_MAX ? text : null;
}

// A Good needs a tag and a Bad must not have one. The date can be any real
// day up to latest.
export function parseNewEntry(form: FormData, latest: string): NewEntry | null {
  const kind = form.get("kind");
  const tag = form.get("tag");
  const date = form.get("date");
  const text = parseText(form.get("text"));
  if (text === null || typeof date !== "string" || !isDayKey(date) || date > latest) return null;
  if (kind === "good" && isTag(tag)) return { kind, tag, date, text };
  if (kind === "bad" && !tag) return { kind, date, text };
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

// Mail apps paste "123 456" or a trailing space, so keep only the digits.
// The length is a range because Supabase's Email OTP Length is a dashboard
// setting (6 to 10).
export function parseCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.replace(/\D/g, "");
  return /^\d{6,10}$/.test(code) ? code : null;
}
