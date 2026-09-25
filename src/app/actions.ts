"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays } from "@/lib/days";
import { ENTRY_COLUMNS, toEntry, type Entry, type EntryRow } from "@/lib/entries";
import { parseNewEntry, parseText } from "@/lib/entry-input";
import { getServerSupabase } from "@/lib/supabase/server";

// Journal writes. Every action checks the session itself, because the page's
// check does not cover a server action. RLS then limits each query to the
// user's own rows, so an id from another user finds nothing.

type EntryResult = { entry: Entry } | { error: string };

async function signedIn() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

const LOGGED_OUT = { error: "Log in first." };
const NOT_FOUND = { error: "That entry is gone." };

export async function addEntry(form: FormData): Promise<EntryResult> {
  const supabase = await signedIn();
  if (!supabase) return LOGGED_OUT;
  // The writer's local day can run a day ahead of the server's UTC day.
  const input = parseNewEntry(form, addDays(new Date().toISOString().slice(0, 10), 1));
  if (!input) return { error: "Check the text and the date." };

  // The next free slot of that day. The unique (user, date, slot) constraint
  // catches a second tab that took it first, so try once more.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: last } = await supabase
      .from("entries")
      .select("slot")
      .eq("date", input.date)
      .order("slot", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabase
      .from("entries")
      .insert({ date: input.date, kind: input.kind, tag: input.tag ?? null, text: input.text, slot: last ? last.slot + 1 : 0 })
      .select(ENTRY_COLUMNS)
      .single();
    if (data) return { entry: toEntry(data as EntryRow) };
    if (error?.code !== "23505") {
      console.error("[tend] addEntry failed:", error?.message);
      break;
    }
  }
  return { error: "Could not save. Try again." };
}

export async function updateEntryText(id: string, text: string): Promise<EntryResult> {
  const supabase = await signedIn();
  if (!supabase) return LOGGED_OUT;
  const clean = parseText(text);
  if (!clean) return { error: "Write between 1 and 280 characters." };
  const { data } = await supabase.from("entries").update({ text: clean }).eq("id", id).select(ENTRY_COLUMNS).maybeSingle();
  return data ? { entry: toEntry(data as EntryRow) } : NOT_FOUND;
}

export async function deleteEntry(id: string): Promise<{ id: string } | { error: string }> {
  const supabase = await signedIn();
  if (!supabase) return LOGGED_OUT;
  const { data } = await supabase.from("entries").delete().eq("id", id).select("id").maybeSingle();
  return data ? { id: data.id as string } : NOT_FOUND;
}

// Pulls a weed into compost. The Bad and its text stay in the journal.
export async function pullWeed(id: string): Promise<EntryResult> {
  const supabase = await signedIn();
  if (!supabase) return LOGGED_OUT;
  const { data } = await supabase
    .from("entries")
    .update({ pulled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("kind", "bad")
    .is("pulled_at", null)
    .select(ENTRY_COLUMNS)
    .maybeSingle();
  return data ? { entry: toEntry(data as EntryRow) } : NOT_FOUND;
}

export async function signOut() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
