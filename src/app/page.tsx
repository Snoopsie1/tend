import Garden from "@/components/Garden";
import { ENTRY_COLUMNS, toEntry, type EntryRow } from "@/lib/entries";
import { getServerSupabase } from "@/lib/supabase/server";

// Supabase returns at most 1000 rows per query, and a year of entries can be
// more, so read in pages.
const PAGE = 1000;

export default async function Home() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let rows: EntryRow[] | null = null;
  if (user) {
    rows = [];
    for (let from = 0; ; from += PAGE) {
      // (date, slot) is unique per user, so the order is stable across pages.
      const { data, error } = await supabase
        .from("entries")
        .select(ENTRY_COLUMNS)
        .order("date")
        .order("slot")
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("[tend] loading entries failed:", error.message);
        break;
      }
      rows.push(...(data as EntryRow[]));
      if (data.length < PAGE) break;
    }
  }

  return (
    <main className="h-dvh w-full">
      {/* A new key on log in or out, so the garden starts from the right entries. */}
      <Garden key={user?.id ?? "demo"} initialEntries={rows && rows.map(toEntry)} signedIn={user !== null} />
    </main>
  );
}
