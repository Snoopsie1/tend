// Calendar days as "YYYY-MM-DD" keys. The arithmetic runs on UTC midnights,
// so a daylight saving change never skips or repeats a day.

const DAY_MS = 86_400_000;

const toUtc = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// The local calendar day of a moment, not the UTC one.
export const localDayKey = (date: Date) => fromUtc(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

export const addDays = (key: string, days: number) => fromUtc(toUtc(key) + days * DAY_MS);

export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

// A real calendar day in "YYYY-MM-DD" form. "2026-02-31" is not one.
export const isDayKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;

// ISO 8601 week, like "2026-W39". Weeks start on Monday, and week 1 is the
// one with the year's first Thursday.
export function isoWeekKey(key: string) {
  const ms = toUtc(key);
  const monday0 = (new Date(ms).getUTCDay() + 6) % 7;
  const thursday = ms + (3 - monday0) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export const formatDay = (key: string) => dayFormat.format(toUtc(key));
