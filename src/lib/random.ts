// Seeded randomness for the demo garden and plant variation. The same seed
// always gives the same garden, so nothing in the garden calls Math.random.

export type Rng = () => number;

// mulberry32, a small 32-bit PRNG. Returns floats in [0, 1).
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 32-bit FNV-1a, to seed from a string such as an entry id.
export function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const range = (rng: Rng, min: number, max: number) => min + (max - min) * rng();

export const int = (rng: Rng, n: number) => Math.floor(rng() * n);

export const pick = <T>(rng: Rng, items: readonly T[]) => items[int(rng, items.length)];
