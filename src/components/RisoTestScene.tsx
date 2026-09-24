"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { useState } from "react";
import { INKS, RisoEffect, inkColor } from "@/lib/riso-effect";

// Two-ink overprints. inkColor() is linear, so multiply() is the linear
// product the shader will try to reproduce. R3F copies a Color prop into the
// material, so sharing these instances is safe.
const overprint = (a: string, b: string) => inkColor(a).multiply(inkColor(b));

const OVERPRINTS = [
  { name: "green", color: overprint(INKS.blue, INKS.yellow) },
  { name: "orange", color: overprint(INKS.pink, INKS.yellow) },
  { name: "purple", color: overprint(INKS.pink, INKS.blue) },
];

// Stem radii in world units. The thinnest that survives the dots sets the
// minimum stem width for milestone 2.
const STEMS = [
  { name: "pink", radius: 0.01, ink: INKS.pink },
  { name: "yellow", radius: 0.025, ink: INKS.yellow },
  { name: "blue", radius: 0.05, ink: INKS.blue },
];
const STEM_HEIGHT = 1.4;
const HEAD_RADIUS = 0.12;

const ORBIT_RADIUS = 6;
const ORBIT_HEIGHT = 2.4;
const SWING = Math.PI / 6; // 30° each way
// Portrait cannot fit the three spheres at the desktop distance. Vertical fov
// 35 gives a 16.6° horizontal fov on a 390x844 phone. Below this aspect the
// camera backs off in proportion, so the frame keeps the width it has at
// aspect 1.3, about 5 world units for the 4.4 the spheres span. Wider
// aspects keep ORBIT_RADIUS.
const FIT_ASPECT = 1.3;

function CameraArc() {
  useFrame(({ camera, clock, size }) => {
    const radius = ORBIT_RADIUS * Math.max(1, FIT_ASPECT / (size.width / size.height));
    const angle = Math.sin(clock.elapsedTime * 0.25) * SWING;
    camera.position.set(Math.sin(angle) * radius, ORBIT_HEIGHT, Math.cos(angle) * radius);
    camera.lookAt(0, 0.5, 0);
  });
  return null;
}

function Riso() {
  const dpr = useThree((state) => state.viewport.dpr);
  const [effect] = useState(() => new RisoEffect());
  return <primitive object={effect} pixelRatio={dpr} />;
}

export default function RisoTestScene() {
  return (
    <Canvas flat dpr={[1, 2]} camera={{ position: [0, ORBIT_HEIGHT, ORBIT_RADIUS], fov: 35 }}>
      <color attach="background" args={["#ffffff"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 6, 4]} intensity={2.5} />

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshLambertMaterial color="#d6e6c8" />
      </mesh>

      {OVERPRINTS.map(({ name, color }, i) => (
        <mesh key={name} position={[(i - 1) * 1.6, 0.6, 0]}>
          <sphereGeometry args={[0.6, 48, 32]} />
          <meshLambertMaterial color={color} />
        </mesh>
      ))}

      {STEMS.map(({ name, radius, ink }, i) => (
        <group key={name} position={[(i - 1) * 1.4, 0, -1.8]}>
          <mesh position={[0, STEM_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[radius, radius, STEM_HEIGHT, 12]} />
            <meshLambertMaterial color={ink} />
          </mesh>
          <mesh position={[0, STEM_HEIGHT + HEAD_RADIUS, 0]}>
            <sphereGeometry args={[HEAD_RADIUS, 24, 16]} />
            <meshLambertMaterial color={ink} />
          </mesh>
        </group>
      ))}

      <CameraArc />
      <EffectComposer multisampling={0}>
        <Riso />
      </EffectComposer>
    </Canvas>
  );
}
