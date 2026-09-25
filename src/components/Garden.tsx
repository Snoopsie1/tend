"use client";

import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { useMemo, useRef, useState, useTransition, type RefObject } from "react";
import { Vector3, type Fog } from "three";
import { pullWeed, signOut } from "@/app/actions";
import CameraController from "@/components/CameraController";
import DayCard from "@/components/DayCard";
import EntrySheet, { type SheetMode } from "@/components/EntrySheet";
import Plants from "@/components/Plants";
import Riso from "@/components/Riso";
import { formatDay, localDayKey } from "@/lib/days";
import { demoEntries } from "@/lib/demo-data";
import { TAG_LABELS, type Entry } from "@/lib/entries";
import { layoutGarden } from "@/lib/layout";
import { PAPER } from "@/lib/riso-effect";
import { PLANT_SIZES, speciesOf } from "@/lib/species";

// Space between the top of the plant and the bottom of the label, and
// between the label and the screen edges, in CSS px.
const LABEL_GAP = 10;
const EDGE = 8;

// Scratch vectors, only touched in the frame callback.
const point = new Vector3();
const view = new Vector3();

// Moves the label above its plant every frame, after the camera has moved.
// Hides it when the plant is off screen or has faded into the paper.
function LabelTracker({ labelRef, anchor }: { labelRef: RefObject<HTMLDivElement | null>; anchor: Vector3 | null }) {
  useFrame(({ camera, size, scene }) => {
    const element = labelRef.current;
    if (!element || !anchor) return;
    camera.updateMatrixWorld();
    const depth = -view.copy(anchor).applyMatrix4(camera.matrixWorldInverse).z;
    point.copy(anchor).project(camera);
    const onScreen = depth > 0 && depth < (scene.fog as Fog).far && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1;
    element.style.visibility = onScreen ? "visible" : "hidden";
    if (!onScreen) return;

    const x = ((point.x + 1) / 2) * size.width;
    const y = ((1 - point.y) / 2) * size.height;
    const left = Math.min(Math.max(x - element.offsetWidth / 2, EDGE), size.width - element.offsetWidth - EDGE);
    const top = Math.max(y - element.offsetHeight - LABEL_GAP, EDGE);
    element.style.transform = `translate(${left}px, ${top}px)`;
  });
  return null;
}

const kindLabel = (entry: Entry) => (entry.tag ? TAG_LABELS[entry.tag] : entry.pulledAt ? "compost" : "weed");

const chip =
  "min-h-11 border-2 border-ink-blue bg-paper px-3 font-mono text-xs uppercase tracking-wide text-ink-blue disabled:opacity-50";

export default function Garden({ initialEntries, signedIn }: { initialEntries: Entry[] | null; signedIn: boolean }) {
  // The client's own calendar day. The demo garden is the same every day,
  // only its dates move.
  const [today] = useState(() => localDayKey(new Date()));
  const [entries, setEntries] = useState(() => initialEntries ?? demoEntries(today));
  const plants = useMemo(() => layoutGarden(entries, today), [entries, today]);
  const depth = useMemo(() => (plants.length ? -Math.min(...plants.map((plant) => plant.z)) : 0), [plants]);

  // Plants are picked by entry id, because a delete or a pull changes indices.
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pulling, startPull] = useTransition();
  const labelRef = useRef<HTMLDivElement>(null);

  // Hover wins, so a mouse can read other plants while one is selected.
  const shown = hovered ?? selected;
  const index = shown === null ? -1 : entries.findIndex((e) => e.id === shown);
  const entry = index < 0 ? null : entries[index];
  const plant = index < 0 ? null : plants[index];
  // Only a selected label takes taps. A hover label must let the mouse through.
  const pinned = entry !== null && shown === selected;
  let anchor: Vector3 | null = null;
  if (plant) {
    const { height } = PLANT_SIZES[speciesOf(plant)][plant.variant];
    anchor = new Vector3(plant.x, height * plant.scale, plant.z);
  }

  const replace = (next: Entry) => setEntries((prev) => prev.map((e) => (e.id === next.id ? next : e)));

  const pull = (id: string) =>
    startPull(async () => {
      const result = await pullWeed(id);
      if ("entry" in result) replace(result.entry);
      else setNotice(result.error);
    });

  return (
    <div className="relative h-full w-full overflow-hidden" style={hovered === null ? undefined : { cursor: "pointer" }}>
      <Canvas
        flat
        dpr={[1, 2]}
        style={{ touchAction: "none" }}
        camera={{ fov: 45, near: 0.1, far: 100 }}
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={[PAPER]} />
        {/* Fog in the paper color prints no ink, so old rows fade into the page. */}
        <fog attach="fog" args={[PAPER, 10, 30]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 6, 4]} intensity={2.5} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -depth / 2]}>
          <planeGeometry args={[60, depth + 60]} />
          <meshLambertMaterial color="#d6e6c8" />
        </mesh>
        <Plants
          plants={plants}
          onSelect={(i) => setSelected(plants[i].entryId)}
          onHover={(i) => setHovered(i === null ? null : plants[i].entryId)}
        />

        <CameraController depth={depth} />
        <LabelTracker labelRef={labelRef} anchor={anchor} />
        <EffectComposer multisampling={0}>
          <Riso highlight={plant} />
        </EffectComposer>
      </Canvas>

      {/* Chrome, labels and cards are siblings of the canvas, so taps on them
          never reach the garden. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] text-ink-blue">
        <p className="text-2xl font-bold tracking-tight">Tend</p>
        {signedIn ? (
          <form action={signOut} className="pointer-events-auto">
            <button type="submit" className={chip}>
              Log out
            </button>
          </form>
        ) : (
          <Link href="/login" className={`${chip} pointer-events-auto flex items-center`}>
            Log in
          </Link>
        )}
      </header>

      {signedIn && entries.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-2xl text-ink-blue">
          Plant your first Good
        </p>
      )}

      {notice && (
        <button
          type="button"
          onClick={() => setNotice(null)}
          className="absolute inset-x-4 top-[max(64px,calc(env(safe-area-inset-top)+52px))] mx-auto max-w-sm border-2 border-ink-pink bg-paper p-3 text-sm text-ink-blue"
        >
          {notice}
        </button>
      )}

      {signedIn && (
        <button
          type="button"
          onClick={() => setSheet({ mode: "new" })}
          aria-label="Write a new entry"
          className="absolute right-4 bottom-[max(16px,env(safe-area-inset-bottom))] flex h-14 w-14 items-center justify-center border-2 border-ink-blue bg-ink-blue text-3xl text-paper shadow-[3px_3px_0_var(--color-ink-pink)]"
        >
          +
        </button>
      )}

      {/* Hidden until the tracker has placed it, and remounted per plant. */}
      {entry && (
        <div
          key={shown}
          ref={labelRef}
          style={{ visibility: "hidden" }}
          className={`${pinned ? "pointer-events-auto" : "pointer-events-none"} absolute top-0 left-0 max-w-72 border-2 border-ink-blue bg-paper px-3 py-2 text-ink-blue shadow-[3px_3px_0_var(--color-ink-pink)]`}
        >
          <p className="font-mono text-[10px] whitespace-nowrap uppercase tracking-wide">
            {formatDay(entry.date)} · {kindLabel(entry)}
          </p>
          <p className="mt-1 text-sm leading-snug">{entry.text}</p>
          {entry.pulledAt && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wide">
              Pulled {formatDay(localDayKey(new Date(entry.pulledAt)))}
            </p>
          )}
          {pinned && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setDay(entry.date)} className={chip}>
                Whole day
              </button>
              {signedIn && entry.kind === "bad" && !entry.pulledAt && (
                <button type="button" disabled={pulling} onClick={() => pull(entry.id)} className={chip}>
                  {pulling ? "Pulling" : "Pull"}
                </button>
              )}
              {signedIn && (
                <button type="button" onClick={() => setSheet({ mode: "edit", entry })} className={chip}>
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {day && <DayCard date={day} entries={entries} onClose={() => setDay(null)} />}

      {sheet && (
        <EntrySheet
          sheet={sheet}
          today={today}
          onClose={() => setSheet(null)}
          onSaved={(saved) => {
            if (sheet.mode === "new") {
              setEntries((prev) => [...prev, saved]);
              // Spotlight the new plant, so you watch it arrive.
              setSelected(saved.id);
            } else {
              replace(saved);
            }
            setSheet(null);
          }}
          onDeleted={(id) => {
            setEntries((prev) => prev.filter((e) => e.id !== id));
            setSelected(null);
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}
