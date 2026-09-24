"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { useRef, useState, type RefObject } from "react";
import { Vector3, type Fog } from "three";
import CameraController from "@/components/CameraController";
import Plants from "@/components/Plants";
import Riso from "@/components/Riso";
import { formatDay, localDayKey } from "@/lib/days";
import { demoEntries } from "@/lib/demo-data";
import { TAG_LABELS } from "@/lib/entries";
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

export default function Garden() {
  // The client's own calendar day. The demo garden is the same every day,
  // only its dates move.
  const [today] = useState(() => localDayKey(new Date()));
  const [entries] = useState(() => demoEntries(today));
  const [plants] = useState(() => layoutGarden(entries, today));
  const [depth] = useState(() => -Math.min(...plants.map((plant) => plant.z)));
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  // Hover wins, so a mouse can read other plants while one is selected.
  const shown = hovered ?? selected;
  const entry = shown === null ? null : entries[shown];
  const plant = shown === null ? null : plants[shown];
  let anchor: Vector3 | null = null;
  if (plant) {
    const { height } = PLANT_SIZES[speciesOf(plant)][plant.variant];
    anchor = new Vector3(plant.x, height * plant.scale, plant.z);
  }

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
        <Plants plants={plants} onSelect={setSelected} onHover={setHovered} />

        <CameraController depth={depth} />
        <LabelTracker labelRef={labelRef} anchor={anchor} />
        <EffectComposer multisampling={0}>
          <Riso highlight={plant} />
        </EffectComposer>
      </Canvas>

      {/* A sibling of the canvas that ignores the pointer, so it never
          blocks a tap or a hover on the garden. Hidden until the tracker
          has placed it, and remounted per plant. */}
      {entry && (
        <div
          key={shown}
          ref={labelRef}
          style={{ visibility: "hidden" }}
          className="pointer-events-none absolute top-0 left-0 max-w-72 border-2 border-ink-blue bg-paper px-3 py-2 text-ink-blue shadow-[3px_3px_0_var(--color-ink-pink)]"
        >
          <p className="font-mono text-[10px] whitespace-nowrap uppercase tracking-wide">
            {formatDay(entry.date)} · {entry.tag ? TAG_LABELS[entry.tag] : "weed"}
          </p>
          <p className="mt-1 text-sm leading-snug">{entry.text}</p>
        </div>
      )}
    </div>
  );
}
