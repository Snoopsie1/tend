import { formatDay, localDayKey } from "@/lib/days";
import { TAG_LABELS, type Entry } from "@/lib/entries";

// Every Good and Bad of one day, like a page of the paper journal.
export default function DayCard({ date, entries, onClose }: { date: string; entries: Entry[]; onClose: () => void }) {
  const day = entries.filter((e) => e.date === date).sort((a, b) => a.slot - b.slot);
  const goods = day.filter((e) => e.kind === "good");
  const bads = day.filter((e) => e.kind === "bad");

  return (
    <section
      aria-label={`Journal for ${formatDay(date)}`}
      className="absolute inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] mx-auto max-h-[70dvh] max-w-sm overflow-y-auto border-2 border-ink-blue bg-paper p-4 pr-12 text-ink-blue shadow-[4px_4px_0_var(--color-ink-pink)]"
    >
      <h2 className="font-mono text-xs uppercase tracking-wide">{formatDay(date)}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center text-2xl"
      >
        ×
      </button>

      <h3 className="mt-3 font-mono text-[10px] uppercase tracking-wide">Goods</h3>
      <ul className="mt-1 space-y-1">
        {goods.map((e) => (
          <li key={e.id}>
            {e.text} <span className="font-mono text-[10px] uppercase tracking-wide">· {TAG_LABELS[e.tag!]}</span>
          </li>
        ))}
      </ul>

      {bads.length > 0 && (
        <>
          <h3 className="mt-3 font-mono text-[10px] uppercase tracking-wide">Bads</h3>
          <ul className="mt-1 space-y-1">
            {bads.map((e) => (
              <li key={e.id}>
                <span className={e.pulledAt ? "line-through" : undefined}>{e.text}</span>
                {e.pulledAt && (
                  <span className="font-mono text-[10px] uppercase tracking-wide">
                    {" "}
                    · pulled {formatDay(localDayKey(new Date(e.pulledAt)))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
