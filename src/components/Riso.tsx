import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Color, DoubleSide, Mesh, MeshBasicMaterial, Scene, Vector2, WebGLRenderTarget } from "three";
import { plantMatrix } from "@/components/Plants";
import type { Plant } from "@/lib/layout";
import { RisoEffect } from "@/lib/riso-effect";
import { PLANT_GEOMETRIES, speciesOf } from "@/lib/species";

// How fast the spotlight fades in and out, per second.
const FADE = 10;

type Mask = { scene: Scene; mesh: Mesh; target: WebGLRenderTarget };

const maskMaterial = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });

// Scratch values, only touched in the frame callback.
const black = new Color(0x000000);
const savedClear = new Color();
const bufferSize = new Vector2();

// The riso filter, with a spotlight on one plant. The filter needs a mask of
// that plant alone, white on black at half resolution, so it is drawn every
// frame the spotlight is on, before the filter runs.
export default function Riso({ highlight }: { highlight: Plant | null }) {
  const dpr = useThree((state) => state.viewport.dpr);
  const [effect] = useState(() => new RisoEffect());
  const maskRef = useRef<Mask | null>(null);
  // The spotlight fades out on the plant it showed last.
  const fadeRef = useRef<{ amount: number; plant: Plant | null }>({ amount: 0, plant: null });

  useEffect(() => {
    const mesh = new Mesh(undefined, maskMaterial);
    mesh.matrixAutoUpdate = false;
    const mask = { scene: new Scene().add(mesh), mesh, target: new WebGLRenderTarget(1, 1) };
    maskRef.current = mask;
    return () => {
      mask.target.dispose();
      maskRef.current = null;
    };
  }, []);

  useFrame(({ gl, camera }, delta) => {
    const mask = maskRef.current;
    const fade = fadeRef.current;
    if (highlight) fade.plant = highlight;
    fade.amount += ((highlight ? 1 : 0) - fade.amount) * (1 - Math.exp(-FADE * delta));
    if (!mask || !fade.plant || fade.amount < 0.001) {
      effect.setSpotlight(null, 0);
      return;
    }

    gl.getDrawingBufferSize(bufferSize);
    const width = Math.ceil(bufferSize.x / 2);
    const height = Math.ceil(bufferSize.y / 2);
    if (mask.target.width !== width || mask.target.height !== height) mask.target.setSize(width, height);

    mask.mesh.geometry = PLANT_GEOMETRIES[speciesOf(fade.plant)][fade.plant.variant];
    plantMatrix(fade.plant, mask.mesh.matrix);
    mask.mesh.matrixWorldNeedsUpdate = true;

    // postprocessing turns autoClear off, so clear the mask by hand, and give
    // the renderer its clear color back for the main scene.
    gl.getClearColor(savedClear);
    const savedAlpha = gl.getClearAlpha();
    gl.setRenderTarget(mask.target);
    gl.setClearColor(black, 1);
    gl.clear();
    gl.render(mask.scene, camera);
    gl.setRenderTarget(null);
    gl.setClearColor(savedClear, savedAlpha);

    effect.setSpotlight(mask.target.texture, fade.amount);
  });

  return <primitive object={effect} pixelRatio={dpr} />;
}
