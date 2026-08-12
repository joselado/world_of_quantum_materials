import Phaser from 'phaser';

export function shade(colorInt: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(colorInt);
  if (amount >= 0) c.brighten(amount);
  else c.darken(-amount);
  return c.color;
}

// Linearly interpolates between two colors (t=0 -> a, t=1 -> b) -- used to
// tint a tile's ordinary fill color toward a per-tile `regionColor` override
// (OverworldScene's mapgen-driven branch/domain colors) without fully
// replacing it, so the tinted tile still reads as that biome's own ground/
// path rather than a flat swatch of the override color.
export function blend(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const r = Math.round(ca.red + (cb.red - ca.red) * t);
  const g = Math.round(ca.green + (cb.green - ca.green) * t);
  const bl = Math.round(ca.blue + (cb.blue - ca.blue) * t);
  return Phaser.Display.Color.GetColor(r, g, bl);
}

// Rotates a color's hue by a few degrees while keeping its saturation/value --
// used to give same-`TYPE_LOOK` compounds (e.g. every 'classicalMagnet'-type crystal
// starts from one shared base color) a visibly different tint instead of only
// the brightness step `shade()` gives siblings like Iron vs. Cobalt.
export function hueShift(colorInt: number, degrees: number): number {
  const c = Phaser.Display.Color.IntegerToColor(colorInt);
  const hsv = Phaser.Display.Color.RGBToHSV(c.red, c.green, c.blue);
  const h = (((hsv.h + degrees / 360) % 1) + 1) % 1;
  return Phaser.Display.Color.HSVToRGB(h, hsv.s, hsv.v).color;
}

// FNV-1a string hash -> a deterministic seed for a name (a material's own
// name, so the same compound always renders the same way across scenes/
// reloads instead of re-rolling its look every render).
export function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Mulberry32 -- a small, fast, deterministic PRNG seeded from `hashSeed()`,
// used to derive a compound's own hue/rotation/stretch jitter (art/crystals.ts)
// so every material reads as visually distinct rather than a shared silhouette
// in a different shade.
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
