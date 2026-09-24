"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { useState } from "react";
import CameraController from "@/components/CameraController";
import Plants from "@/components/Plants";
import { formatDay, localDayKey } from "@/lib/days";
import { demoEntries } from "@/lib/demo-data";
import { TAG_LABELS, type Entry } from "@/lib/entries";
import { layoutGarden } from "@/lib/layout";
import { PAPER, RisoEffect } from "@/lib/riso-effect";

function Riso() {
  const dpr = useThree((state) => state.viewport.dpr);
  const [effect] = useState(() => new RisoEffect());
  return <primitive object={effect} pixelRatio={dpr} />;
}

function EntryCard({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  return (
    <article className="absolute inset-x-4 bottom-4 mx-auto max-w-sm border-2 border-ink-blue bg-paper p-4 pr-12 text-ink-blue shadow-[4px_4px_0_var(--color-ink-pink)]">
      <p className="font-mono text-xs uppercase tracking-wide">
        {formatDay(entry.date)} · {entry.tag ? TAG_LABELS[entry.tag] : "weed"}
      </p>
      <p className="mt-2 text-lg leading-snug">{entry.text}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center text-2xl"
      >
        ×
      </button>
    </article>
  );
}

export default function Garden() {
  // The client's own calendar day. The demo garden is the same every day,
  // only its dates move.
  const [today] = useState(() => localDayKey(new Date()));
  const [entries] = useState(() => demoEntries(today));
  const [plants] = useState(() => layoutGarden(entries, today));
  const [depth] = useState(() => -Math.min(...plants.map((plant) => plant.z)));
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="relative h-full w-full">
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
        <Plants plants={plants} onSelect={setSelected} />

        <CameraController depth={depth} />
        <EffectComposer multisampling={0}>
          <Riso />
        </EffectComposer>
      </Canvas>

      {/* A sibling of the canvas, so taps on the card never reach the garden. */}
      {selected !== null && <EntryCard entry={entries[selected]} onClose={() => setSelected(null)} />}
    </div>
  );
}
