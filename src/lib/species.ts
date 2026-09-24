import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Tag } from "@/lib/entries";
import { VARIANTS } from "@/lib/layout";
import { hash, int, mulberry32, range, type Rng } from "@/lib/random";
import { INKS, inkColor } from "@/lib/riso-effect";

export type Species = Tag | "weed";

export const speciesOf = (plant: { tag?: Tag }): Species => plant.tag ?? "weed";

// Smallest flower head size, in world units. The camera fades rows into the
// paper where a head this size drops under 12 CSS px.
export const HEAD_SIZE = 0.3;

// Only exact ink overprints, so the riso filter prints each part in clean
// solid ink.
const PINK = inkColor(INKS.pink);
const BLUE = inkColor(INKS.blue);
const YELLOW = inkColor(INKS.yellow);
const ORANGE = PINK.clone().multiply(YELLOW);
const PURPLE = PINK.clone().multiply(BLUE);
const GREEN = BLUE.clone().multiply(YELLOW);
const DARK = PURPLE.clone().multiply(YELLOW);

const matrix = (position: Vector3, rotation = new Euler(), scale = new Vector3(1, 1, 1)) =>
  new Matrix4().compose(position, new Quaternion().setFromEuler(rotation), scale);

// Moves a part into place (transforms apply in order) and paints it in one
// ink. Every part gets a color attribute, or mergeGeometries refuses them.
function part(geometry: BufferGeometry, color: Color, ...transforms: Matrix4[]) {
  for (const transform of transforms) geometry.applyMatrix4(transform);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

// A flat petal or leaf from the origin along +y.
function petal(width: number, length: number, points = 8) {
  const outline = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    return new Vector2((Math.sin(a) * width) / 2, ((1 - Math.cos(a)) * length) / 2);
  });
  return new ShapeGeometry(new Shape(outline));
}

// Radius 0.02 keeps a stem at about 3.6 CSS px on a phone's front row. Solid
// ink holds down to about 1.6 px.
const stem = (height: number, radius = 0.02) =>
  part(new CylinderGeometry(radius, radius * 1.25, height, 5, 1, true), GREEN, matrix(new Vector3(0, height / 2, 0)));

// Two leaves on the lower stem, one to each side, angled up.
const leaves = (rng: Rng, height: number, width = 0.07, length = 0.25) =>
  [-1, 1].map((side) =>
    part(
      petal(width, length, 6),
      GREEN,
      matrix(new Vector3(), new Euler(0, range(rng, -0.6, 0.6), side * range(rng, 0.8, 1.1))),
      matrix(new Vector3(0, height * range(rng, 0.2, 0.4), 0)),
    ),
  );

// A ring of petals lying flat around a head, before the head is tilted.
const petalRing = (count: number, width: number, length: number, radius: number, color: Color, head: Matrix4) =>
  Array.from({ length: count }, (_, i) =>
    part(
      petal(width, length),
      color,
      new Matrix4().makeRotationX(-Math.PI / 2),
      matrix(new Vector3(0, 0, -radius)),
      new Matrix4().makeRotationY((i / count) * Math.PI * 2),
      head,
    ),
  );

// People. A pink daisy, tilted toward the camera.
function daisy(rng: Rng) {
  const height = range(rng, 0.8, 1);
  const head = matrix(new Vector3(0, height, 0), new Euler(range(rng, 0.5, 0.8), 0, 0));
  return [
    stem(height),
    ...leaves(rng, height),
    ...petalRing(9 + int(rng, 4), 0.05, range(rng, 0.13, 0.16), 0.035, PINK, head),
    part(new SphereGeometry(0.06, 8, 5), YELLOW, matrix(new Vector3(), new Euler(), new Vector3(1, 0.4, 1)), head),
  ];
}

// Body. An orange tulip, a closed cup.
function tulip(rng: Rng) {
  const height = range(rng, 0.75, 0.9);
  const width = range(rng, 0.9, 1.1);
  const profile = [
    [0.02, 0],
    [0.11, 0.06],
    [0.14, 0.15],
    [0.1, 0.24],
    [0.04, 0.29],
    [0, 0.3],
  ].map(([x, y]) => new Vector2(x * width, y));
  return [
    stem(height),
    ...leaves(rng, height * 0.4, 0.08, 0.45),
    part(new LatheGeometry(profile, 8), ORANGE, matrix(new Vector3(0, height - 0.02, 0), new Euler(range(rng, 0, 0.2), 0, 0))),
  ];
}

// Work. A tall yellow sunflower with a dark center, facing the camera.
function sunflower(rng: Rng) {
  const height = range(rng, 1.1, 1.3);
  const head = matrix(new Vector3(0, height, 0), new Euler(range(rng, 0.7, 1), 0, 0));
  return [
    stem(height, 0.025),
    ...leaves(rng, height, 0.12, 0.25),
    ...petalRing(12 + int(rng, 3), 0.06, 0.14, 0.085, YELLOW, head),
    part(new SphereGeometry(0.1, 10, 6), DARK, matrix(new Vector3(), new Euler(), new Vector3(1, 0.35, 1)), head),
  ];
}

// Nature. Blue bells hanging from a stem that arches to one side. The bells
// touch, so the cluster reads as one shape at dot size.
function bluebells(rng: Rng) {
  const height = range(rng, 0.85, 1);
  const side = rng() < 0.5 ? -1 : 1;
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0, 0),
    new Vector3(0.02 * side, height * 0.55, 0),
    new Vector3(0.12 * side, height * 0.9, 0),
    new Vector3(0.3 * side, height, 0.02),
  ]);
  const bell = [
    [0.065, 0],
    [0.06, 0.02],
    [0.05, 0.06],
    [0.03, 0.1],
    [0, 0.11],
  ].map(([x, y]) => new Vector2(x, y));
  const bells = [0.55, 0.7, 0.85, 1].map((t) =>
    part(new LatheGeometry(bell, 6), BLUE, matrix(curve.getPointAt(t).add(new Vector3(0, -0.12, 0)))),
  );
  return [part(new TubeGeometry(curve, 8, 0.02, 5), GREEN), ...leaves(rng, height * 0.5, 0.04, 0.35), ...bells];
}

// Small joys. A purple dome of tiny blooms.
function joyCluster(rng: Rng) {
  const height = range(rng, 0.8, 0.9);
  const blooms = [new Vector3(0, height + 0.07, 0)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + range(rng, -0.2, 0.2);
    blooms.push(new Vector3(Math.cos(a) * 0.1, height + range(rng, 0.01, 0.05), Math.sin(a) * 0.1));
  }
  return [
    stem(height),
    ...leaves(rng, height),
    ...blooms.map((position) => part(new SphereGeometry(0.07, 6, 4), PURPLE, matrix(position))),
  ];
}

// A Bad. A low, dark rosette of jagged blades, like a dandelion's.
function weed(rng: Rng) {
  const count = 7 + int(rng, 3);
  return Array.from({ length: count }, (_, i) => {
    const length = range(rng, 0.18, 0.24);
    const width = 0.08;
    const outline = [
      [0, 0],
      [0.5, 0.25],
      [0.2, 0.35],
      [0.45, 0.6],
      [0, 1],
      [-0.45, 0.55],
      [-0.2, 0.4],
      [-0.5, 0.2],
    ].map(([x, y]) => new Vector2(x * width, y * length));
    return part(
      new ShapeGeometry(new Shape(outline)),
      DARK,
      new Matrix4().makeRotationX(-(Math.PI / 2 - range(rng, 0.3, 0.7))),
      new Matrix4().makeRotationY((i / count) * Math.PI * 2 + range(rng, -0.2, 0.2)),
    );
  });
}

const BUILDERS: Record<Species, (rng: Rng) => BufferGeometry[]> = {
  people: daisy,
  body: tulip,
  work: sunflower,
  nature: bluebells,
  smallJoys: joyCluster,
  weed,
};

export const buildPlant = (species: Species, seed: number) => mergeGeometries(BUILDERS[species](mulberry32(seed)))!;

// Built once when the module loads and shared by every instance, so nothing
// needs disposing when the garden unmounts.
export const PLANT_GEOMETRIES = Object.fromEntries(
  (Object.keys(BUILDERS) as Species[]).map((species) => [
    species,
    Array.from({ length: VARIANTS }, (_, variant) => buildPlant(species, hash(`${species}:${variant}`))),
  ]),
) as Record<Species, BufferGeometry[]>;

// Height and horizontal reach of every species variant, before instance
// scale. The pick shapes and the entry label use them.
export const PLANT_SIZES = Object.fromEntries(
  Object.entries(PLANT_GEOMETRIES).map(([species, variants]) => [
    species,
    variants.map((geometry) => {
      geometry.computeBoundingBox();
      const { min, max } = geometry.boundingBox!;
      return { height: max.y, reach: Math.max(-min.x, max.x, -min.z, max.z) };
    }),
  ]),
) as Record<Species, { height: number; reach: number }[]>;
