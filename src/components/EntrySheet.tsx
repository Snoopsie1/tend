import { useState, useTransition } from "react";
import { addEntry, deleteEntry, updateEntryText } from "@/app/actions";
import { formatDay } from "@/lib/days";
import { TAGS, TAG_LABELS, TEXT_MAX, type Entry, type Tag } from "@/lib/entries";

export type SheetMode = { mode: "new" } | { mode: "edit"; entry: Entry };

const toggle = (on: boolean) =>
  `min-h-11 border-2 border-ink-blue px-3 font-mono text-xs uppercase tracking-wide ${
    on ? "bg-ink-blue text-paper" : "bg-paper text-ink-blue"
  }`;
const primary =
  "min-h-11 flex-1 border-2 border-ink-blue bg-ink-blue px-4 font-mono text-sm uppercase tracking-wide text-paper shadow-[3px_3px_0_var(--color-ink-pink)] disabled:opacity-50";
const secondary =
  "min-h-11 border-2 border-ink-pink bg-paper px-4 font-mono text-xs uppercase tracking-wide text-ink-blue disabled:opacity-50";

// A sheet over the garden, to write a new entry or change one. A new entry
// has a kind, a tag for Goods, the text and a date. An old one only changes
// its text, or goes.
export default function EntrySheet({
  sheet,
  today,
  onClose,
  onSaved,
  onDeleted,
}: {
  sheet: SheetMode;
  today: string;
  onClose: () => void;
  onSaved: (entry: Entry) => void;
  onDeleted: (id: string) => void;
}) {
  const editing = sheet.mode === "edit" ? sheet.entry : null;
  const [kind, setKind] = useState<Entry["kind"]>("good");
  const [tag, setTag] = useState<Tag>("people");
  const [text, setText] = useState(editing?.text ?? "");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      let result;
      if (editing) {
        result = await updateEntryText(editing.id, text);
      } else {
        const form = new FormData();
        form.set("kind", kind);
        if (kind === "good") form.set("tag", tag);
        form.set("text", text);
        form.set("date", date);
        result = await addEntry(form);
      }
      if ("entry" in result) onSaved(result.entry);
      else setError(result.error);
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteEntry(editing!.id);
      if ("id" in result) onDeleted(result.id);
      else setError(result.error);
    });

  return (
    // The backdrop closes the sheet. It is a sibling of the canvas, so the
    // tap never reaches the garden.
    <div className="absolute inset-0 flex items-end bg-ink-blue/10 sm:items-center sm:justify-center" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-3 overflow-y-auto border-t-2 border-ink-blue bg-paper p-4 pb-[max(16px,env(safe-area-inset-bottom))] text-ink-blue shadow-[0_-4px_0_var(--color-ink-pink)] sm:max-w-md sm:border-2 sm:shadow-[4px_4px_0_var(--color-ink-pink)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-wide">
            {editing ? `${formatDay(editing.date)} · ${editing.tag ? TAG_LABELS[editing.tag] : "bad"}` : "New entry"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center text-2xl">
            ×
          </button>
        </div>

        {!editing && (
          <div className="flex gap-2" role="radiogroup" aria-label="Kind">
            {(["good", "bad"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`${toggle(kind === k)} flex-1`}>
                {k === "good" ? "A Good" : "A Bad"}
              </button>
            ))}
          </div>
        )}

        {!editing && kind === "good" && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tag">
            {TAGS.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={tag === t} onClick={() => setTag(t)} className={toggle(tag === t)}>
                {TAG_LABELS[t]}
              </button>
            ))}
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wide">
            {editing ? "Text" : kind === "good" ? "What went well?" : "What went wrong?"}
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={TEXT_MAX}
            rows={3}
            autoFocus
            required
            className="w-full resize-none border-2 border-ink-blue bg-paper p-3 text-base focus:border-ink-pink focus:outline-none"
          />
          <span className="self-end font-mono text-[10px]">
            {text.length}/{TEXT_MAX}
          </span>
        </label>

        {!editing && (
          <label className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-wide">Day</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              required
              className="min-h-11 border-2 border-ink-blue bg-paper px-3 text-base"
            />
          </label>
        )}

        {error && <p className="text-sm text-ink-pink">{error}</p>}

        <div className="flex gap-2">
          {editing && (
            <button
              type="button"
              disabled={pending}
              onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
              className={secondary}
            >
              {confirmDelete ? "Tap again to delete" : "Delete"}
            </button>
          )}
          <button type="submit" disabled={pending || text.trim().length === 0} className={primary}>
            {pending ? "Saving" : editing ? "Save" : kind === "good" ? "Plant it" : "Plant the weed"}
          </button>
        </div>
      </form>
    </div>
  );
}
