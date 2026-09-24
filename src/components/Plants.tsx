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
import { PLANT_GEOMETRIES, speciesOf, type Species } from "@/lib/species";

const plantMaterial = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });

// Invisible to the renderer but still hit by the raycaster, so a tap anywhere
// on a plant counts, not only on its thin stem.
const pickMaterial = new MeshBasicMaterial({ visible: false });
const pickGeometry = new SphereGeometry(1, 6, 4);

// Height and reach of every species variant, for the pick shapes.
const PICK_SHAPES = Object.fromEntries(
  Object.entries(PLANT_GEOMETRIES).map(([species, variants]) => [
    species,
    variants.map((geometry) => {
      geometry.computeBoundingBox();
      const { min, max } = geometry.boundingBox!;
      return { height: max.y, reach: Math.max(-min.x, max.x, -min.z, max.z) };
    }),
  ]),
) as Record<Species, { height: number; reach: number }[]>;

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

function PickMesh({ plants, onSelect }: { plants: Plant[]; onSelect: (index: number) => void }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    plants.forEach((plant, i) => {
      const { height, reach } = PICK_SHAPES[speciesOf(plant)][plant.variant];
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

  return <instancedMesh ref={ref} args={[pickGeometry, pickMaterial, plants.length]} onClick={select} />;
}

// One instanced mesh per species and variant, plus one pick mesh. The pick
// mesh keeps the order of plants, so its instanceId is the plant's index.
export default function Plants({ plants, onSelect }: { plants: Plant[]; onSelect: (index: number) => void }) {
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
      <PickMesh plants={plants} onSelect={onSelect} />
    </>
  );
}
