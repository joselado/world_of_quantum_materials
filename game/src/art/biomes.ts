// Per-world overworld skin: sky/ceiling gradient, hill/ceiling silhouette,
// off-path vs. on-path ground color, ambient tile decoration, and the fog
// target color distant tiles blend toward. Keeps OverworldScene's rendering
// generic across worlds -- only this table changes per world, matching
// DESIGN.md's per-world biome themes.

export type DecorationKind = 'flowers' | 'crystalGlints' | 'fieldLines' | 'networkNodes' | 'ripples' | 'cracks' | 'mistMotes';

// What the *off-path* terrain actually is, not just what color it's painted
// -- OverworldScene.drawOffPathTile branches on this to render impassable
// ground as something you can plausibly see is impassable rather than a
// uniformly-colored wall block everywhere: 'rock' (the original raised
// stacked-stone block, still the default), 'lava' (a flat, glowing molten
// crust -- Defect Wastes' "scorched" theme made literal), 'water' (a dark,
// rippling frozen lake -- Frozen Caverns), 'void' (open sky/chasm you'd fall
// through -- Floating Islands' "one-way edge paths"). Not every biome needs
// its own theme; most stay 'rock' and differ only by wall/hill color, same
// as before this field existed.
export type WallTheme = 'rock' | 'lava' | 'water' | 'void';

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
  wallTheme: WallTheme;
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
  wallTheme: 'rock',
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
  wallTheme: 'rock',
};

const FLOATING_ISLANDS: Biome = {
  name: 'floatingIslands',
  skyTop: 0x2a3d6b,
  skyBottom: 0x8fb8e8,
  hillColor: 0x4a6a9a,
  hillAlpha: 0.75,
  ground: 0x35507a,
  path: 0x9ac0e0,
  fogTarget: 0x6888c0,
  clouds: true,
  decoration: 'crystalGlints',
  // Off-path here is the open sky between islands, not solid ground -- you'd
  // fall through it, matching the world's own "one-way edge paths" design.
  wallTheme: 'void',
};

// Topic 4 (QHE/Landau levels): a terrain of visible, glowing field lines and
// quantized-orbit rings -- cold electric blue rather than the caves' violet.
const LANDAU_TERRAIN: Biome = {
  name: 'landauTerrain',
  skyTop: 0x081428,
  skyBottom: 0x1f4d8f,
  hillColor: 0x2a5ca8,
  hillAlpha: 0.8,
  ground: 0x122544,
  path: 0x3a7fd4,
  fogTarget: 0x1b3868,
  clouds: false,
  decoration: 'fieldLines',
  wallTheme: 'rock',
};

// Topic 5 (superconductivity/Majorana): a frozen, zero-resistance cavern --
// icy blue-white, glinting rather than glowing.
const FROZEN_CAVERNS: Biome = {
  name: 'frozenCaverns',
  skyTop: 0x0d1b2a,
  skyBottom: 0x2a4858,
  hillColor: 0x24404f,
  hillAlpha: 0.85,
  ground: 0x0f2430,
  path: 0x8fdcff,
  fogTarget: 0x14313e,
  clouds: false,
  decoration: 'crystalGlints',
  // "Zero-resistance" made literal underfoot too: off-path here is a frozen
  // lake, not stacked stone.
  wallTheme: 'water',
};

// Topic 6 (classical magnetism/magnons): windswept plains with spin-wave
// ripples in the grass -- a warmer, wilder green/gold than world 1's meadow.
const WINDSWEPT_PLAINS: Biome = {
  name: 'windsweptPlains',
  skyTop: 0x9fd8ff,
  skyBottom: 0xdff3ff,
  hillColor: 0x8fae5c,
  hillAlpha: 0.8,
  ground: 0x5f8536,
  path: 0xd4c07a,
  fogTarget: 0xcbe8ff,
  clouds: true,
  decoration: 'ripples',
  wallTheme: 'rock',
};

// Topic 7 (entanglement/tensor networks): a dark network-graph world, bonds
// between sites rendered as the walkable paths themselves.
const NETWORK_GRAPH_WORLD: Biome = {
  name: 'networkGraphWorld',
  skyTop: 0x120a24,
  skyBottom: 0x2c1a4a,
  hillColor: 0x3a2560,
  hillAlpha: 0.8,
  ground: 0x1c1030,
  path: 0x8a5cd9,
  fogTarget: 0x201238,
  clouds: false,
  decoration: 'networkNodes',
  wallTheme: 'rock',
};

// Topic 8 (quantum magnetism/spinons/Kondo): a foggy forest that
// fractionalizes on contact -- muted, low-contrast greys and greens.
const FOGGY_FOREST: Biome = {
  name: 'foggyForest',
  skyTop: 0x2a2f28,
  skyBottom: 0x4a5248,
  hillColor: 0x3a4238,
  hillAlpha: 0.9,
  ground: 0x28302a,
  path: 0x5a6a58,
  fogTarget: 0x454e46,
  clouds: false,
  decoration: 'mistMotes',
  wallTheme: 'rock',
};

// Topic 9 (excitations and defects): a cracked, glitching world -- scorched
// reds and blacks, terrain that reads as damaged rather than merely dark.
const CRACKED_WORLD: Biome = {
  name: 'crackedWorld',
  skyTop: 0x1a0808,
  skyBottom: 0x3a1414,
  hillColor: 0x4a1c1c,
  hillAlpha: 0.85,
  ground: 0x220c0c,
  path: 0x8a2a2a,
  fogTarget: 0x2e1010,
  clouds: false,
  decoration: 'cracks',
  // The world's own "scorched"/"damaged" theme made literal underfoot: a
  // glowing molten crust, not a stacked stone wall.
  wallTheme: 'lava',
};

// Topic 10 (finale, ML/adaptive boss): a meta-world reflecting the player's
// own team back at them -- shimmering silver-violet, distinct from every
// earlier biome's palette.
const META_WORLD: Biome = {
  name: 'metaWorld',
  skyTop: 0x2a1a3a,
  skyBottom: 0x6a4a8a,
  hillColor: 0x5a3a7a,
  hillAlpha: 0.75,
  ground: 0x3a2450,
  path: 0xc9a8f0,
  fogTarget: 0x4a3068,
  clouds: true,
  decoration: 'crystalGlints',
  wallTheme: 'rock',
};

export const BIOMES: Partial<Record<number, Biome>> = {
  1: MEADOW,
  2: CRYSTAL_CAVE,
  3: FLOATING_ISLANDS,
  4: LANDAU_TERRAIN,
  5: FROZEN_CAVERNS,
  6: WINDSWEPT_PLAINS,
  7: NETWORK_GRAPH_WORLD,
  8: FOGGY_FOREST,
  9: CRACKED_WORLD,
  10: META_WORLD,
};

export function getBiome(world: number): Biome {
  return BIOMES[world] ?? MEADOW;
}
