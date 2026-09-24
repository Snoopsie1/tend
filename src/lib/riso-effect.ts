import { Effect, EffectAttribute } from "postprocessing";
import { Color, Matrix3, Uniform, Vector2, Vector3, type Texture } from "three";

// Screen approximations of the three Riso inks, as printed on white stock.
export const INKS = {
  pink: "#ff48b0",
  blue: "#0078bf",
  yellow: "#ffe800",
} as const;

export const PAPER = "#f4efe4";

// Real ink never absorbs a channel completely. Without this floor, blue
// (#0078bf has no red) over pink prints navy instead of purple.
const INK_FLOOR = 0.08;

// Linear transmittance of an ink, with the floor applied.
export function inkColor(hex: string) {
  const color = new Color(hex);
  return color.setRGB(Math.max(color.r, INK_FLOOR), Math.max(color.g, INK_FLOOR), Math.max(color.b, INK_FLOOR));
}

// All sizes are in CSS pixels. The shader scales them by the pixel ratio.
const CELL_SIZE = 6;
const PLATES = {
  pink: { angle: 15, offset: [1.6, -0.9] },
  blue: { angle: 45, offset: [-1.2, 0.6] },
  yellow: { angle: 75, offset: [0.4, 1.4] },
} as const;
// Under the spotlight, the rest of the garden keeps this share of its ink,
// and the pink plate prints a halo this wide around the plant.
const KNOCK_BACK = 0.3;
const HALO_PX = 3;

const fragmentShader = /* glsl */ `
uniform mat3 separation;
uniform vec3 paper;
uniform vec3 darkest;
uniform vec3 inkPink;
uniform vec3 inkBlue;
uniform vec3 inkYellow;
uniform vec3 angles;
uniform vec2 offsetPink;
uniform vec2 offsetBlue;
uniform vec2 offsetYellow;
uniform float cellSize;
uniform float pixelRatio;
// The spotlit plant alone, white on black, and how far the spotlight has
// faded in (0 = off).
uniform sampler2D highlight;
uniform float spotlight;
uniform float knockBack;
uniform float haloPx;

// Dave Hoskins' hash12. Stays stable on mobile GPUs, where sin() of large
// pixel coordinates loses precision and bands.
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Beer-Lambert split. The optical density of the pixel, relative to the paper,
// is a mix of the three ink densities. The separation matrix solves that mix.
// Nothing prints darker than all three inks, so colors below that are floored
// to it, or dark colors over-separate.
vec3 inkCoverage(vec3 color) {
  vec3 density = max(log(paper) - log(max(color, darkest)), vec3(0.0));
  return clamp(separation * density, 0.0, 1.0);
}

// Uneven ink laydown as relative optical density, about 0.8 to 1.2. Two
// octaves of value noise on the plate's turned grid, the second turned again,
// so no lattice lines up with the screen, the other octave or another plate.
float blotch(vec2 q, float seed) {
  float scale = 40.0 * pixelRatio;
  float n = valueNoise(q / scale + seed);
  n += 0.5 * valueNoise(mat2(0.8, -0.6, 0.6, 0.8) * q / (0.45 * scale) + seed * 1.7);
  return 0.8 + 0.4 * (n / 1.5);
}

// The mask grown by haloPx, from 8 taps around the pixel.
float halo(vec2 uv) {
  vec2 reach = haloPx * pixelRatio / resolution;
  float grown = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982;
    grown = max(grown, texture2D(highlight, uv + vec2(cos(a), sin(a)) * reach).r);
  }
  return grown;
}

// One ink plate, screened per pixel like a RIP does it. Each pixel compares
// its own coverage against a round spot on a grid turned by the plate angle,
// so solid ink keeps the true edge of the geometry and only tints break into
// dots. Image and screen shift together by the plate offset, like a
// misregistered print. Returns (ink fraction, relative density).
vec2 plate(vec2 px, float angle, vec2 offset, vec3 channel, float seed) {
  float cell = cellSize * pixelRatio;
  vec2 shifted = px - offset * pixelRatio;
  float s = sin(angle);
  float c = cos(angle);
  vec2 q = mat2(c, -s, s, c) * shifted;

  vec2 sampleUv = clamp(shifted / resolution, 0.0, 1.0);
  float amount = dot(inkCoverage(texture2D(inputBuffer, sampleUv).rgb), channel);
  // Spotlight. Everything but the plant is knocked back to a light screen,
  // and the pink plate prints a halo around it. The mask is read at the
  // plate's own offset, so the knock-back misregisters like the ink does.
  if (spotlight > 0.0) {
    float held = texture2D(highlight, sampleUv).r;
    amount *= mix(1.0, knockBack, spotlight * (1.0 - held));
    if (channel.x > 0.5) amount = max(amount, spotlight * max(halo(sampleUv) - held, 0.0));
  }
  // Dot radius in cell units. 0.7071 is half the cell diagonal, so coverage 1
  // fills the cell.
  float r = sqrt(amount) * 0.7071;
  // Distance to the cell center in cell units, capped half a pixel short of
  // the corner so a full cell has no pinprick where four dots meet.
  float d = min(length(fract(q / cell) - 0.5), 0.7071 - 0.5 / cell);
  // 1 px antialiased edge. min(r * cell, 1.0) fades dots smaller than a pixel,
  // so pale tints do not pop in and out while the camera moves.
  float ink = clamp((r - d) * cell + 0.5, 0.0, 1.0) * min(r * cell, 1.0);
  // Pinholes where the drum did not transfer.
  ink *= step(0.03, hash(floor(px / pixelRatio) + seed));
  return vec2(ink, blotch(q, seed));
}

// One ink layer over the pixel. p.x is the ink fraction, p.y the relative
// density. pow scales optical density, so a channel the ink fully absorbs
// stays 0 instead of leaking when the ink thins. max guards pow(0, y).
vec3 inkLayer(vec3 ink, vec2 p) {
  return mix(vec3(1.0), pow(max(ink, vec3(1e-4)), vec3(p.y)), p.x);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = uv * resolution;
  vec2 pink = plate(px, angles.x, offsetPink, vec3(1.0, 0.0, 0.0), 11.0);
  vec2 blue = plate(px, angles.y, offsetBlue, vec3(0.0, 1.0, 0.0), 23.0);
  vec2 yellow = plate(px, angles.z, offsetYellow, vec3(0.0, 0.0, 1.0), 37.0);

  vec3 color = paper * (1.0 - 0.05 * hash(floor(px / pixelRatio)));
  color *= inkLayer(inkPink, pink);
  color *= inkLayer(inkBlue, blue);
  color *= inkLayer(inkYellow, yellow);
  outputColor = vec4(color, 1.0);
}
`;

function density(hex: string) {
  const { r, g, b } = inkColor(hex);
  return [r, g, b].map((v) => -Math.log(v));
}

// Columns are the densities of pink, blue and yellow. The inverse maps a
// pixel density back to how much of each ink it needs.
function separationMatrix() {
  const [p, b, y] = [density(INKS.pink), density(INKS.blue), density(INKS.yellow)];
  return new Matrix3().set(p[0], b[0], y[0], p[1], b[1], y[1], p[2], b[2], y[2]).invert();
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export class RisoEffect extends Effect {
  constructor() {
    super("RisoEffect", fragmentShader, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["separation", new Uniform(separationMatrix())],
        ["paper", new Uniform(new Color(PAPER))],
        [
          "darkest",
          new Uniform(
            new Color(PAPER).multiply(inkColor(INKS.pink)).multiply(inkColor(INKS.blue)).multiply(inkColor(INKS.yellow)),
          ),
        ],
        ["inkPink", new Uniform(inkColor(INKS.pink))],
        ["inkBlue", new Uniform(inkColor(INKS.blue))],
        ["inkYellow", new Uniform(inkColor(INKS.yellow))],
        [
          "angles",
          new Uniform(
            new Vector3(radians(PLATES.pink.angle), radians(PLATES.blue.angle), radians(PLATES.yellow.angle)),
          ),
        ],
        ["offsetPink", new Uniform(new Vector2(...PLATES.pink.offset))],
        ["offsetBlue", new Uniform(new Vector2(...PLATES.blue.offset))],
        ["offsetYellow", new Uniform(new Vector2(...PLATES.yellow.offset))],
        ["cellSize", new Uniform(CELL_SIZE)],
        ["pixelRatio", new Uniform(1)],
        ["highlight", new Uniform<Texture | null>(null)],
        ["spotlight", new Uniform(0)],
        ["knockBack", new Uniform(KNOCK_BACK)],
        ["haloPx", new Uniform(HALO_PX)],
      ]),
    });
  }

  set pixelRatio(value: number) {
    this.uniforms.get("pixelRatio")!.value = value;
  }

  // Spotlight one plant through its mask. An amount of 0 turns it off.
  setSpotlight(mask: Texture | null, amount: number) {
    this.uniforms.get("highlight")!.value = mask;
    this.uniforms.get("spotlight")!.value = amount;
  }
}
