import type { ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  DoubleSide,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import type { Plant } from "@/lib/layout";
import { PLANT_GEOMETRIES, PLANT_SIZES, speciesOf } from "@/lib/species";

const plantMaterial = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });

// Invisible to the renderer but still hit by the raycaster, so a tap anywhere
// on a plant counts, not only on its thin stem.
const pickMaterial = new MeshBasicMaterial({ visible: false });
const pickGeometry = new SphereGeometry(1, 6, 4);

// Scratch objects, only touched inside layout effects.
const position = new Vector3();
const rotation = new Quaternion();
const euler = new Euler();
const scale = new Vector3();
const transform = new Matrix4();

function PlantMesh({ geometry, plants }: { geometry: BufferGeometry; plants: Plant[] }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    plants.forEach((plant, i) => {
      transform.compose(
        position.set(plant.x, 0, plant.z),
        rotation.setFromEuler(euler.set(0, plant.yaw, 0)),
        scale.setScalar(plant.scale),
      );
      mesh.setMatrixAt(i, transform);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [plants]);
  // The bounding sphere spans the whole timeline, so culling never helps.
  return <instancedMesh ref={ref} args={[geometry, plantMaterial, plants.length]} frustumCulled={false} />;
}

type PlantEvents = {
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
};

function PickMesh({ plants, onSelect, onHover }: { plants: Plant[] } & PlantEvents) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    plants.forEach((plant, i) => {
      const { height, reach } = PLANT_SIZES[speciesOf(plant)][plant.variant];
      const halfHeight = Math.max(height / 2, 0.12) * plant.scale;
      const radius = Math.max(reach, 0.15) * plant.scale;
      transform.compose(position.set(plant.x, halfHeight, plant.z), rotation.identity(), scale.set(radius, halfHeight, radius));
      mesh.setMatrixAt(i, transform);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [plants]);

  const select = (event: ThreeEvent<MouseEvent>) => {
    // R3F fires onClick even after a drag, so a tap that moved is a drag.
    if (event.delta > 8 || event.instanceId === undefined) return;
    // Hits come nearest first. Only the nearest plant opens.
    event.stopPropagation();
    onSelect(event.instanceId);
  };

  // Hover is for a mouse with no button down. A finger mid-swipe or a mouse
  // drag must not flash labels over every plant it passes.
  const hover = (event: ThreeEvent<PointerEvent>) => {
    // Keep this before onHover. stopPropagation fires onPointerOut on the
    // plants behind, which sets the hover to null.
    event.stopPropagation();
    const idle = event.nativeEvent.pointerType === "mouse" && event.nativeEvent.buttons === 0;
    onHover(idle && event.instanceId !== undefined ? event.instanceId : null);
  };

  const leave = () => onHover(null);

  return (
    <instancedMesh
      ref={ref}
      args={[pickGeometry, pickMaterial, plants.length]}
      onClick={select}
      onPointerMove={hover}
      onPointerOut={leave}
    />
  );
}

// One instanced mesh per species and variant, plus one pick mesh. The pick
// mesh keeps the order of plants, so its instanceId is the plant's index.
export default function Plants({ plants, onSelect, onHover }: { plants: Plant[] } & PlantEvents) {
  const groups = useMemo(() => {
    const byKey = new Map<string, { geometry: BufferGeometry; plants: Plant[] }>();
    for (const plant of plants) {
      const species = speciesOf(plant);
      const key = `${species}:${plant.variant}`;
      const group = byKey.get(key) ?? { geometry: PLANT_GEOMETRIES[species][plant.variant], plants: [] };
      group.plants.push(plant);
      byKey.set(key, group);
    }
    return [...byKey];
  }, [plants]);

  return (
    <>
      {groups.map(([key, group]) => (
        <PlantMesh key={key} geometry={group.geometry} plants={group.plants} />
      ))}
      <PickMesh plants={plants} onSelect={onSelect} onHover={onHover} />
    </>
  );
}
