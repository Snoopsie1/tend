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

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export const formatDay = (key: string) => dayFormat.format(toUtc(key));
