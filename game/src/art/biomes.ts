// Per-world overworld skin: sky/ceiling gradient, distant self, off-path vs.
// on-path ground color, ambient tile decoration, and the fog target color
// distant tiles blend toward. Keeps OverworldScene's rendering generic across
// worlds -- only this table changes per world, matching DESIGN.md's per-world
// biome themes.

export type DecorationKind = 'flowers' | 'mosaic' | 'edgeFlow' | 'crystalGlints' | 'orbitRings' | 'flowLines' | 'networkNodes' | 'ripples' | 'cracks' | 'mistMotes';

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
export type WallTheme = 'rock' | 'forest' | 'columns' | 'deadFloor' | 'charged' | 'ice' | 'shards' | 'lava';

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
  // How fast those clouds cross the sky, in pixels per second, zero for a
  // still sky. Only the Edge Cliffs run this: racing cloud over ground where
  // nothing can move is that world's whole tension.
  cloudDrift: number;
  decoration: DecorationKind;
  // How much of the walkable route carries that decoration. A scatter (the
  // Mean Fields' flowers, the Defect Scars' cracks) wants a fraction; a floor
  // *pattern* wants all of it, since the Stone Lattice's aisle is an actual
  // repeating wallpaper group and a wallpaper group with holes in it is not
  // one.
  decorationChance: number;
  wallTheme: WallTheme;
  // The Storm Flats' flat bands, and nothing else's. Landau levels are
  // dispersionless flat bands, so "Flats" is the physics rather than the
  // weather, and the ground says so: discrete steps of one hue, `period` rows
  // to a step and `steps` steps before the ramp repeats, with a soft dark
  // strip and a glowing channel at every boundary between two of them. The
  // channel is the subject, not trim -- edge channels live between filled
  // Landau levels. The strip is lighting and claims no elevation: it is what
  // gives flat bands material depth on an engine that cannot draw a hill.
  bands: BandRamp | null;
}

export interface BandRamp {
  color: number;
  period: number;
  steps: number;
  channel: number;
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
  cloudDrift: 0,
  decoration: 'flowers',
  decorationChance: 0.16,
  wallTheme: 'forest',
  bands: null,
};

// World 2, the Stone Lattice (symmetries, tight-binding, effective models):
// an open-air stone cloister in hard midday sun, and the only architecture in
// the game. Every contrast axis flips against the Mean Fields at once --
// organic against geometric, green against sandstone, soft irregular edges
// against hard straight ones -- which is what stops two consecutive daylight
// worlds from reading as one place.
//
// Cloudless, deliberately: the Mean Fields carry morning cloud and the Edge
// Cliffs carry racing cloud, so a hard empty midday sky is this world's own
// slot in that sequence.
const STONE_LATTICE: Biome = {
  name: 'stoneLattice',
  skyTop: 0x5aa6e0,
  skyBottom: 0xd6e6f0,
  // Sandstone: the colonnade restated as horizon teeth. Seen from the Mean
  // Fields, whose mist is the palest in the game, so it runs warm against
  // that pale blue rather than dark under it.
  hillColor: 0xb99a72,
  hillAlpha: 0.75,
  // The deep cast shadow *between* the columns, which is what the off-path
  // fill actually is here -- the lit stone is the accent standing in it.
  ground: 0x4a3427,
  path: 0xdcc9a8,
  fogTarget: 0xe0d3ba,
  clouds: false,
  cloudDrift: 0,
  decoration: 'mosaic',
  // A tiled aisle is a wallpaper group, so it covers the whole floor. A
  // wallpaper group with holes in it is not one.
  decorationChance: 1,
  wallTheme: 'columns',
  bands: null,
};

// World 3, the Edge Cliffs (topological band theory): a lit ledge with a
// shallow drop either side of it, and the two bulk domains as sunken dead
// floors flanking it. Bulk-boundary correspondence made literal -- the edge
// state is the only place you can stand, and the bulk is over the side.
//
// The drop is shallow and never true void. Nothingness belongs to the
// Entangled Web alone, a visible floor below calibrates the eye far better
// than uncalibrated black, and a gapped bulk is genuinely matter -- present,
// extended, inert, just unavailable. The domain colors themselves come from
// the generator (world/generators/world3.ts's DOMAIN_PALETTE); `ground` is
// the dim slate they are mixed over.
const EDGE_CLIFFS: Biome = {
  name: 'edgeCliffs',
  skyTop: 0x4f9fd8,
  skyBottom: 0xcfe6f2,
  // Dead ochre: the sunken floors restated as low flat-topped plateaus with
  // an abrupt step wherever two domains meet.
  hillColor: 0x8a7a5a,
  hillAlpha: 0.6,
  ground: 0x394349,
  path: 0xdfe6e2,
  fogTarget: 0xbcd6e0,
  clouds: true,
  cloudDrift: 22,
  decoration: 'edgeFlow',
  decorationChance: 1,
  wallTheme: 'deadFloor',
  bands: null,
};

// World 4, the Storm Flats (magnetic field, quantum Hall, Landau levels):
// flat bands underfoot in a single-hue indigo ramp under a stormy dusk. The
// ground here is a diagram, and two things stop it reading as a chart: the
// boundary shadow strips that give the bands material depth, and the
// overhead arcs that put the violence in the sky (art/horizons.ts's
// OVERHEAD_SKIES). Drop either and the world regresses immediately.
//
// Indigo rather than storm-violet. Violet belongs to the Devouring Mirror by
// right, as the finale, and this world is the reason that has to be said out
// loud -- a storm is the one other thing in the game that wants it.
const STORM_FLATS: Biome = {
  name: 'stormFlats',
  skyTop: 0x151a3a,
  skyBottom: 0x3a4270,
  // Dead flat, because this world is flat by locked identity and so is the
  // Edge Cliffs before it. The two therefore cannot be told apart on shape at
  // all, and the whole distinction is carried by this world's storm.
  hillColor: 0x3a4478,
  hillAlpha: 0.5,
  ground: 0x1b2044,
  path: 0x6272b8,
  fogTarget: 0x2b3260,
  // The cloud sprite is a fair-weather cumulus and a storm is not made of
  // those; this world's sky activity is its arcs.
  clouds: false,
  cloudDrift: 0,
  decoration: 'orbitRings',
  decorationChance: 0.26,
  wallTheme: 'charged',
  bands: { color: 0x1a2044, period: 4, steps: 4, channel: 0xa8e4ff },
};

// World 5, the Vortex Glacier (superconductivity, Nambu, Majorana): an open
// glacier at overcast twilight, the corridor spiralling around one or two
// permanently blocked vortex cores. "Swept" is literal -- the ice is streaked
// with flow-lines that bend away from the bulk and converge only into the
// pits, which is field expulsion drawn as terrain. The world becomes the
// place that pushes something invisible away from itself, rather than "the
// ice one".
//
// Held desaturated and in a narrow value range: a wide ice-to-near-black
// spread makes each depth step of the haze a visible band across the floor,
// where a compressed one lets the same falloff read as continuous cold air.
const VORTEX_GLACIER: Biome = {
  name: 'vortexGlacier',
  skyTop: 0x3c4a56,
  skyBottom: 0x6e808c,
  // Pale ice-cyan, and pale deliberately: this is the one distant self read
  // against the Storm Flats' dark indigo dusk, and a cold-dark ridge there
  // sits so close to that world's own fog that its forward horizon
  // disappears. Pressure ridges are pale ice seen from a world away, so the
  // honest color is also the legible one.
  hillColor: 0x9fc8d8,
  hillAlpha: 0.7,
  ground: 0x54707e,
  path: 0xa8c8d4,
  fogTarget: 0x7e939e,
  // Overcast: an unbroken lid rather than discrete clouds.
  clouds: false,
  cloudDrift: 0,
  decoration: 'flowLines',
  decorationChance: 1,
  wallTheme: 'ice',
  bands: null,
};

// World 6, the Iron Steppe (classical magnetism, magnons): night under a
// green aurora, black iron-sand underfoot with spin-wave ripples running
// through it, and fields of aligned iron shards leaning uniformly one way and
// flipping across a domain wall.
//
// The hinge of the light arc: the sky still exists, but it is already lying
// about where light comes from. Everything visible here is emitted by the
// world rather than received from above, one world before the sky is taken
// away for good.
//
// The false calm, and anatomically so -- the mood relaxes after ice and
// storm while the lethality does not, since leaning shards are the most
// overtly impaling surround so far.
const IRON_STEPPE: Biome = {
  name: 'ironSteppe',
  skyTop: 0x050a14,
  skyBottom: 0x0d1622,
  // Leaning teeth, all tilted together, with the lean reversing at one point
  // along the horizon -- the domain wall, visible from a world away. That
  // uniform lean is what separates this from the Vortex Glacier before it,
  // which is jagged, cold-dark and under failing light in exactly the same
  // way but whose pressure ridges are random and vertical.
  hillColor: 0x2e3a34,
  hillAlpha: 0.45,
  ground: 0x121517,
  path: 0x3a3f40,
  fogTarget: 0x16241d,
  clouds: false,
  cloudDrift: 0,
  decoration: 'ripples',
  decorationChance: 0.55,
  wallTheme: 'shards',
  bands: null,
};

// World 7, the Entangled Web (entanglement, tensor networks): no sky, no
// ground, only the network -- taut white-gold filaments strung as the ladder
// of lanes and rungs the generator builds, hanging in true void.
//
// In a tensor network the geometry *is* the entanglement: outside the network
// there is no space. Rendering the surround as actual nothing is the honest
// picture rather than a mood choice, and this world holds the monopoly on it,
// which is why nowhere else in the game spends it.
//
// The game's one warm glow before the Defect Scars burn. Kept still and
// structural: "shifting and alive" belongs entirely to the Devouring Mirror.
const ENTANGLED_WEB: Biome = {
  name: 'entangledWeb',
  skyTop: 0x000000,
  skyBottom: 0x000000,
  hillColor: 0x3a2f18,
  // Swallowed: this world's impassable is nothing, so it has no surround to
  // restate at horizon scale. Its distant self is an absence with structure
  // instead -- the sky ending, with filament glints hanging in blackness
  // (art/horizons.ts). The Iron Steppe looking forward into a horizon that
  // empties out is exactly the tell its false calm needs, and the composition
  // system supplies it for free.
  hillAlpha: 0,
  ground: 0x000000,
  path: 0xefdaa4,
  fogTarget: 0x050505,
  clouds: false,
  cloudDrift: 0,
  decoration: 'networkNodes',
  decorationChance: 1,
  // Bare, and bare means black here: the void needs no accent drawn over it,
  // because there is nothing there to draw.
  wallTheme: 'rock',
  bands: null,
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
  cloudDrift: 0,
  decoration: 'mistMotes',
  decorationChance: 0.16,
  wallTheme: 'rock',
  bands: null,
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
  cloudDrift: 0,
  decoration: 'cracks',
  decorationChance: 0.16,
  // The world's own "scorched"/"damaged" theme made literal underfoot: a
  // glowing molten crust, not a stacked stone wall.
  wallTheme: 'lava',
  bands: null,
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
  cloudDrift: 0,
  decoration: 'crystalGlints',
  decorationChance: 0.16,
  wallTheme: 'rock',
  bands: null,
};

export const BIOMES: Partial<Record<number, Biome>> = {
  1: MEAN_FIELDS,
  2: STONE_LATTICE,
  3: EDGE_CLIFFS,
  4: STORM_FLATS,
  5: VORTEX_GLACIER,
  6: IRON_STEPPE,
  7: ENTANGLED_WEB,
  8: FOGGY_FOREST,
  9: CRACKED_WORLD,
  10: META_WORLD,
};

export function getBiome(world: number): Biome {
  return BIOMES[world] ?? MEAN_FIELDS;
}
