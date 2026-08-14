// Per-world overworld skin: sky/ceiling gradient, distant self, off-path vs.
// on-path ground color, ambient tile decoration, and the fog target color
// distant tiles blend toward. Keeps OverworldScene's rendering generic across
// worlds -- only this table changes per world, matching DESIGN.md's per-world
// biome themes.

export type DecorationKind = 'flowers' | 'crystalGlints' | 'fieldLines' | 'networkNodes' | 'ripples' | 'cracks' | 'mistMotes';

// What the *off-path* terrain actually is, not just what color it's painted
// -- OverworldScene.drawOffPathTile branches on this to give each world's
// impassable ground its own material: 'rock' (bare ground in the biome's own
// `ground` color, the default, no accent), 'lava' (a glowing molten crust --
// Defect Wastes' "scorched" theme made literal), 'water' (a rippling frozen
// lake -- Frozen Caverns), 'void' (the starlit drop between islands --
// Topological Islands' "one-way edge paths"). Impassable terrain lies in the
// same plane as the walkable floor everywhere, so a theme changes the color
// and the accent over it, never the geometry. Not every biome needs its own
// theme; most stay 'rock' and differ only by ground/hill color.
export type WallTheme = 'rock' | 'forest' | 'lava' | 'water' | 'void';

export interface Biome {
  name: string;
  skyTop: number;
  skyBottom: number;
  // The world's distant self -- how it looks from a world away (WORLDS.md
  // section 4). `hillColor` is its base color and `hillAlpha` its swallow, how
  // much of the silhouette survives the mist, with zero meaning a world whose
  // horizon is nothing at all. Both belong to the world depicted and are read
  // by its *neighbour's* renderer: standing in world N, the horizon draws from
  // world N+1's entry. Neither carries any atmosphere of its own -- the fog is
  // applied at render from the live haze target, which is what lets the
  // silhouette follow the retint as the player nears a gate. A swallow value
  // is bounded by how far the base color sits from the fog it is drowned into:
  // a world whose profile cannot stay inside a narrow excursion from the mist
  // goes to zero rather than to a slab.
  hillColor: number;
  hillAlpha: number;
  ground: number; // off-path fill
  path: number; // walkable trail fill
  fogTarget: number;
  clouds: boolean;
  decoration: DecorationKind;
  wallTheme: WallTheme;
}

// World 1, the Mean Fields (mean field, spontaneous symmetry breaking):
// bright morning, and the only world whose value break runs the way a field
// runs rather than the way a track does. You walk *in* the field -- pale
// wheat and mown grass underfoot -- and dark summer canopy is what hems it
// in, so the walkable route is the bright thing on screen and the surround
// is the dark one. A dirt trail through light grass would invert that and
// turn the world into a path across a lawn.
const MEAN_FIELDS: Biome = {
  name: 'meanFields',
  skyTop: 0x8fd0ff,
  skyBottom: 0xe8f6ff,
  // Never composed into any horizon -- nothing precedes world 1, which
  // simply starts (WORLDS.md section 4). Authored anyway, so every world
  // states how it looks from outside itself in the same place.
  hillColor: 0x2f6b3c,
  hillAlpha: 0.55,
  ground: 0x1d4526,
  path: 0xd9d295,
  fogTarget: 0xbfe3ff,
  clouds: true,
  decoration: 'flowers',
  wallTheme: 'forest',
};

// Topic 2 (symmetries/tight-binding): amethyst cave gloom -- a saturated
// violet floor path through cool indigo stone, cyan crystal glints over both.
const CRYSTAL_CAVE: Biome = {
  name: 'crystalCave',
  skyTop: 0x1a1730,
  skyBottom: 0x362f5c,
  hillColor: 0x3a3560,
  // Held well under every other world's: this indigo is seen from the Mean
  // Fields, whose mist is the palest in the game, and a dark base against a
  // pale fog spends the value budget fastest.
  hillAlpha: 0.35,
  ground: 0x27243a,
  path: 0x625a8a,
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
  // Held far darker than the pale island floor it borders: off-path here is
  // the drop between islands, and the depth of the value break is what sells
  // it as empty space rather than lower ground.
  ground: 0x17224a,
  path: 0x9ac0e0,
  fogTarget: 0x6888c0,
  clouds: true,
  decoration: 'crystalGlints',
  // Off-path here is the open drop between islands, not solid ground -- you'd
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
  ground: 0x0f1f3a,
  path: 0x3f8ade,
  fogTarget: 0x1b3868,
  clouds: false,
  decoration: 'fieldLines',
  wallTheme: 'rock',
};

// Topic 5 (superconductivity/Majorana): a frozen, zero-resistance cavern --
// icy blue-white, glinting rather than glowing. Held in a narrow, desaturated
// value range: a wide ice-to-near-black spread makes each depth step of the
// haze a visible band across the floor, where a compressed one lets the same
// falloff read as continuous cold air.
const FROZEN_CAVERNS: Biome = {
  name: 'frozenCaverns',
  skyTop: 0x1b2c3a,
  skyBottom: 0x3d5b69,
  hillColor: 0x3c5866,
  hillAlpha: 0.85,
  ground: 0x1c3440,
  path: 0xa4dbe6,
  fogTarget: 0x44606e,
  clouds: false,
  decoration: 'crystalGlints',
  // "Zero-resistance" made literal underfoot too: off-path here is a frozen
  // lake, not stacked stone.
  wallTheme: 'water',
};

// Topic 6 (classical magnetism/magnons): golden-hour plains with spin-wave
// ripples in the grass -- olive-gold grass hazing into a warm cream horizon,
// the late-summer counterpart to world 1's crisp spring meadow. The haze
// target follows the warm horizon rather than a blue sky, which is what
// carries most of the two worlds' difference at distance.
const WINDSWEPT_PLAINS: Biome = {
  name: 'windsweptPlains',
  skyTop: 0x9cc8e8,
  skyBottom: 0xf0e8c8,
  hillColor: 0x9caa52,
  hillAlpha: 0.8,
  ground: 0x6e8d3a,
  path: 0xd4c07a,
  fogTarget: 0xe6e8c2,
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
  // Swallowed: this world's impassable is nothing, so it has no surround to
  // restate at horizon scale. The Iron Steppe looking forward into an
  // emptying horizon is the tell its false calm needs.
  hillAlpha: 0,
  ground: 0x1c1030,
  path: 0x8a5cd9,
  fogTarget: 0x201238,
  clouds: false,
  decoration: 'networkNodes',
  wallTheme: 'rock',
};

// Topic 8 (quantum magnetism/spinons/Kondo): a foggy forest that
// fractionalizes on contact -- muted greys and greens. Muted in hue, but the
// ground/path value break is still held wide: this is the darkest, haziest
// biome, and the walkable route has to stay readable through that fog on its
// own color break.
const FOGGY_FOREST: Biome = {
  name: 'foggyForest',
  skyTop: 0x2a2f28,
  skyBottom: 0x4e584c,
  hillColor: 0x3a4238,
  // Swallowed: a horizon that dissolves before it resolves is this world's
  // identity, not a missing profile.
  hillAlpha: 0,
  ground: 0x1b231d,
  path: 0x738667,
  fogTarget: 0x49544a,
  clouds: false,
  decoration: 'mistMotes',
  wallTheme: 'rock',
};

// Topic 9 (excitations and defects): a cracked, glitching world -- scorched
// reds and blacks, terrain that reads as damaged rather than merely dark. The
// walkable route is scorched clay: still inside the world's warm red family,
// but held several times lighter than the molten crust's own glow (whose wash
// is kept dim for exactly this reason -- see OverworldScene.drawLavaAccent),
// so the route is told apart by value while everything on screen stays red.
const CRACKED_WORLD: Biome = {
  name: 'crackedWorld',
  skyTop: 0x1a0808,
  skyBottom: 0x3a1414,
  hillColor: 0x4a1c1c,
  hillAlpha: 0.85,
  ground: 0x220c0c,
  path: 0xa86b54,
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
  // Swallowed: this world is seen from the Defect Scars, and it has no
  // silhouette to show there -- its own horizon is the Qumatuomi sky, and a
  // violet ridge would announce a shape the Mirror never had.
  hillAlpha: 0,
  ground: 0x3a2450,
  path: 0xc9a8f0,
  fogTarget: 0x4a3068,
  clouds: true,
  decoration: 'crystalGlints',
  wallTheme: 'rock',
};

export const BIOMES: Partial<Record<number, Biome>> = {
  1: MEAN_FIELDS,
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
  return BIOMES[world] ?? MEAN_FIELDS;
}
