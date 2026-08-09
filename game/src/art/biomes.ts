// Per-world overworld skin: sky/ceiling gradient, hill/ceiling silhouette,
// off-path vs. on-path ground color, ambient tile decoration, and the fog
// target color distant tiles blend toward. Keeps OverworldScene's rendering
// generic across worlds -- only this table changes per world, matching
// DESIGN.md's per-world biome themes.

export type DecorationKind = 'flowers' | 'crystalGlints';

export interface Biome {
  name: string;
  skyTop: number;
  skyBottom: number;
  hillColor: number;
  hillAlpha: number;
  ground: number; // off-path fill
  path: number; // walkable trail fill
  fogTarget: number;
  clouds: boolean;
  decoration: DecorationKind;
}

const MEADOW: Biome = {
  name: 'meadow',
  skyTop: 0x8fd0ff,
  skyBottom: 0xe8f6ff,
  hillColor: 0x5c9c6a,
  hillAlpha: 0.8,
  ground: 0x2e7d32,
  path: 0xb08d57,
  fogTarget: 0xbfe3ff,
  clouds: true,
  decoration: 'flowers',
};

const CRYSTAL_CAVE: Biome = {
  name: 'crystalCave',
  skyTop: 0x1a1730,
  skyBottom: 0x362f5c,
  hillColor: 0x3a3560,
  hillAlpha: 0.85,
  ground: 0x2b2b3a,
  path: 0x585073,
  fogTarget: 0x24203f,
  clouds: false,
  decoration: 'crystalGlints',
};

export const BIOMES: Partial<Record<number, Biome>> = {
  1: MEADOW,
  2: CRYSTAL_CAVE,
};

export function getBiome(world: number): Biome {
  return BIOMES[world] ?? MEADOW;
}
