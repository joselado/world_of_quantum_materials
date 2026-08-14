import Phaser from 'phaser';
import { blend } from './colors';
import { CANVAS_W } from './perspective';

// The shape half of each world's distant self -- how that world looks from a
// world away (WORLDS.md section 4). Its base color and swallow live on the
// same world's `Biome` entry (art/biomes.ts's `hillColor`/`hillAlpha`); this
// module owns only the profile, and the two are read together by
// scenes/overworld/sky.ts's drawDistantSelf.
//
// A distant self is that world's own impassable surround restated at horizon
// scale -- the Stone Lattice's colonnade becomes horizon teeth, the Iron
// Steppe's leaning shards become a leaning sawtooth. A rolling hill in ten
// colors is the theming *not* made visible at distance, which is why every
// entry here is built from its world's own surround rather than from a shared
// noise function.
//
// The data belongs to the world depicted and is consumed by its neighbour's
// renderer: standing in world N, the horizon draws world N+1's entry. World
// 1's own entry is therefore never composed into anyone's horizon (nothing
// precedes it, and WORLDS.md section 4 gives World 1 no view behind), and is
// authored for the same reason every other world's is -- one world, one
// statement of how it looks from outside itself.
//
// Nothing here carries atmosphere. The silhouette is drowned at render into
// whatever the live haze target currently is, which is what lets it follow
// the retint as the player nears an open gate.

// A point on the profile: screen x, and crest height in pixels above the
// horizon line. Two points sharing an x is how a vertical edge is written --
// a column's side, a shard's sheared face -- so hard-edged surrounds stay
// hard at any sampling. Authored as an explicit polyline rather than sampled
// from a height function: the sharp profiles need only a handful of points
// where uniform sampling would need hundreds to stop chamfering their edges.
export interface HorizonPoint {
  x: number;
  h: number;
}

// Everything a sky extra draws with. Anything the silhouette cannot say as a
// filled outline goes here instead: the Storm Flats' arc-flashes, whose
// world is flat by locked identity and so carries its distant self in its
// storm, and the Entangled Web's filament glints, whose surround is nothing
// at all. `target` is the live fog color the silhouette beside it is being
// drowned into, so an extra tinted toward it stays inside the same
// atmosphere.
export interface HorizonSky {
  g: Phaser.GameObjects.Graphics;
  horizonY: number;
  target: number;
  now: number;
}

export interface DistantSelf {
  points: HorizonPoint[];
  sky?: (view: HorizonSky) => void;
}

// The tallest crest any profile may reach. The mist band's full-strength
// stretch (sky.ts's SKY_BLEND_FULL) is sized to clear this, so a crest above
// it stands out of the mist against open sky and reads as a slab rather than
// as a horizon.
export const MAX_CREST = 38;

const W = CANVAS_W;

// Deterministic value noise, so a world's horizon is the same shape in every
// session and every screenshot -- a distant self is an authored asset, and a
// ridge that re-rolls per run cannot be judged against the one beside it.
function hash(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// World 1, the Mean Fields: dense summer forest, so a soft lumpy treeline of
// overlapping crowns with no straight edge anywhere in it. Three octaves at
// once -- the broad swell of the wood, individual crowns, and the ragged tops
// of them -- which is what separates a canopy from a hill.
function treeline(): HorizonPoint[] {
  const pts: HorizonPoint[] = [];
  for (let x = 0; x <= W; x += 8) {
    pts.push({
      x,
      h: 17 + 7 * Math.sin(x * 0.021) + 4 * Math.sin(x * 0.053 + 1.1) + 3 * Math.sin(x * 0.107 + 2.3),
    });
  }
  return pts;
}

// World 2, the Stone Lattice: rows of identical sandstone columns, so
// identical square teeth at one exact period, marching off in both
// directions. Every tooth the same height and width is the point -- a
// colonnade is a one-dimensional lattice, and irregularity here would draw a
// ruin instead.
const COLUMN_PERIOD = 44;
const COLUMN_WIDTH = 26;
const COLUMN_H = 31;
const COLUMN_BASE_H = 5;

function columnTeeth(): HorizonPoint[] {
  const pts: HorizonPoint[] = [];
  for (let x = 0; x <= W + COLUMN_PERIOD; x += COLUMN_PERIOD) {
    pts.push({ x, h: COLUMN_BASE_H }, { x, h: COLUMN_H });
    pts.push({ x: x + COLUMN_WIDTH, h: COLUMN_H }, { x: x + COLUMN_WIDTH, h: COLUMN_BASE_H });
  }
  return pts;
}

// World 3, the Edge Cliffs: a shallow drop onto sunken dead floors, so
// flat-topped plateaus at a few heights with an abrupt vertical step wherever
// two domains meet. Held low, because the drop itself is one storey -- what
// carries the world at distance is the stepping, not the elevation.
const CLIFF_LEVELS = [8, 14, 10, 17, 7, 13, 9, 16, 11, 15];

function cliffPlateaus(): HorizonPoint[] {
  const pts: HorizonPoint[] = [];
  const step = W / (CLIFF_LEVELS.length - 1);
  CLIFF_LEVELS.forEach((h, i) => {
    const x = i * step;
    if (i > 0) pts.push({ x, h: CLIFF_LEVELS[i - 1] });
    pts.push({ x, h });
  });
  pts.push({ x: W, h: CLIFF_LEVELS[CLIFF_LEVELS.length - 1] });
  return pts;
}

// World 4, the Storm Flats: dead flat, because Landau levels are
// dispersionless flat bands and this world is flat by locked identity. Edge
// Cliffs and Storm Flats therefore cannot be told apart on shape at all, so
// the whole distinction is carried by the sky (WORLDS.md section 4's first
// worked example) -- distant lightning over flatness against stepped
// plateaus under racing cloud.
function stormLine(): HorizonPoint[] {
  return [
    { x: 0, h: 5 },
    { x: W, h: 5 },
  ];
}

// Branching arc-flashes over that flat line: a few forked discharges, each
// alive for a fraction of its own cycle so they crack rather than glow. The
// world's identity is its storm, so this is the Storm Flats' distant self
// proper and not decoration on it.
const STORM_ARCS = [
  { x: 120, period: 2600, phase: 0 },
  { x: 470, period: 3400, phase: 900 },
  { x: 700, period: 4100, phase: 2100 },
];

function stormSky({ g, horizonY, target, now }: HorizonSky) {
  STORM_ARCS.forEach((arc, i) => {
    const t = ((now + arc.phase) % arc.period) / arc.period;
    // Alive for the first tenth of the cycle, and fading across it, so the
    // flash has a hard onset and a decaying tail.
    if (t > 0.1) return;
    const flash = 1 - t / 0.1;
    g.lineStyle(1, blend(0xd8dcff, target, 0.35), 0.5 * flash);
    let x = arc.x;
    let y = horizonY - MAX_CREST - 26;
    g.beginPath();
    g.moveTo(x, y);
    for (let seg = 0; seg < 6; seg++) {
      x += (hash(i * 17 + seg) - 0.5) * 26;
      y += (horizonY - 6 - y) / (6 - seg);
      g.lineTo(x, y);
    }
    g.strokePath();
  });
}

// World 5, the Vortex Glacier: pressure ridges, random in width and height
// and standing straight up. Their randomness and their verticality are what
// separate this from the Iron Steppe beyond it, which is jagged and cold-dark
// under failing light in exactly the same way but leans (WORLDS.md section
// 4's second worked example).
function glacierRidges(): HorizonPoint[] {
  const pts: HorizonPoint[] = [{ x: 0, h: 4 }];
  let x = 0;
  let i = 0;
  while (x <= W) {
    const width = 15 + hash(i) * 24;
    const h = 12 + hash(i + 71) * 21;
    pts.push({ x: x + width * 0.5, h }, { x: x + width, h: 4 });
    x += width;
    i++;
  }
  return pts;
}

// World 6, the Iron Steppe: fields of aligned iron shards, every one leaning
// the same way, flipping direction across a single domain wall. The lean is
// written as an asymmetric sawtooth -- a slow rise to a sheared vertical face
// leans one way, a vertical face falling away slowly leans the other -- and
// the wall is the one x where the two patterns meet, so the magnetic order is
// legible from a world away.
const SHARD_PERIOD = 26;
const SHARD_WALL_X = W * 0.63;

function shardRows(): HorizonPoint[] {
  const pts: HorizonPoint[] = [];
  for (let x = 0; x <= W + SHARD_PERIOD; x += SHARD_PERIOD) {
    const h = 23 + 5 * Math.sin(x * 0.031);
    const tip = x + SHARD_PERIOD * 0.78;
    if (x < SHARD_WALL_X) pts.push({ x, h: 3 }, { x: tip, h }, { x: tip, h: 3 });
    else pts.push({ x, h: 3 }, { x, h }, { x: tip, h: 3 });
  }
  return pts;
}

// World 7, the Entangled Web: outside a tensor network there is no space, so
// its impassable is nothing and there is nothing to restate. Its distant self
// is an absence with structure -- the sky simply ending, with thin white-gold
// glints hanging where a horizon should be. Swallow zero (art/biomes.ts), so
// no silhouette is drawn at all and these glints are the whole of it.
const WEB_GLINTS = [
  { x: 96, y: 22, len: 13 },
  { x: 205, y: 9, len: 8 },
  { x: 268, y: 30, len: 17 },
  { x: 389, y: 15, len: 10 },
  { x: 452, y: 27, len: 14 },
  { x: 566, y: 11, len: 9 },
  { x: 631, y: 24, len: 15 },
  { x: 744, y: 18, len: 11 },
  { x: 806, y: 31, len: 8 },
];

function webSky({ g, horizonY, now }: HorizonSky) {
  WEB_GLINTS.forEach((glint, i) => {
    // Each filament breathes on its own slow cycle, never all at once: the
    // network is still and structural, and a synchronized twinkle would make
    // it an effect rather than a place.
    const pulse = 0.35 + 0.3 * Math.sin(now / (900 + i * 130) + i);
    g.lineStyle(1, 0xf0dca0, 0.4 * pulse);
    g.lineBetween(glint.x, horizonY - glint.y, glint.x + glint.len, horizonY - glint.y - glint.len * 0.4);
  });
}

// World 9, the Defect Scars: molten crust seen from a world away -- a broken
// ridge of blocky plateaus with narrow deep notches cut through it, which is
// the wound-still-open half of the world's two-tense damage at horizon scale.
const SCAR_BLOCKS = [
  { w: 74, h: 21 },
  { w: 46, h: 13 },
  { w: 92, h: 27 },
  { w: 38, h: 16 },
  { w: 118, h: 23 },
  { w: 52, h: 30 },
  { w: 86, h: 18 },
  { w: 64, h: 25 },
  { w: 104, h: 14 },
  { w: 44, h: 28 },
  { w: 96, h: 20 },
];
const SCAR_NOTCH = 9;

function scarRidge(): HorizonPoint[] {
  const pts: HorizonPoint[] = [{ x: 0, h: 4 }];
  let x = 0;
  for (const block of SCAR_BLOCKS) {
    pts.push({ x, h: block.h }, { x: x + block.w, h: block.h }, { x: x + block.w, h: 4 });
    x += block.w + SCAR_NOTCH;
    pts.push({ x, h: 4 });
  }
  pts.push({ x: W + SCAR_NOTCH, h: 4 });
  return pts;
}

// The glow veins in that ridge: short hot lines standing in the notches,
// self-luminous per the light rule -- the Splitting Hollow has no sky, so the
// only thing that can announce the world beyond it is light the world emits
// itself.
function scarSky({ g, horizonY, target, now }: HorizonSky) {
  let x = 0;
  SCAR_BLOCKS.forEach((block, i) => {
    x += block.w;
    const pulse = 0.4 + 0.35 * Math.sin(now / 900 + i * 1.7);
    g.lineStyle(1.5, blend(0xff8a3a, target, 0.3), 0.45 * pulse);
    g.lineBetween(x + SCAR_NOTCH / 2, horizonY, x + SCAR_NOTCH / 2, horizonY - block.h * 0.75);
    x += SCAR_NOTCH;
  });
}

// The Storm Flats standing *in* itself: charged field-line arcs cracking
// across the whole sky overhead, far larger and nearer than the flashes its
// distant self shows a world away. Both are the same storm; this is the one
// the player is under.
//
// This is the world's own sky rather than its neighbour's horizon, which is
// why it is a separate table: a distant self is read from world N+1 and
// belongs to the world depicted, while an overhead motif is read from the
// world the player is standing in. The Storm Flats needs both, and the ground
// here is a diagram, so the sky has to be the violence or the world reads as
// a chart.
const OVERHEAD_ARCS = [
  { x: 150, period: 3100, phase: 0 },
  { x: 430, period: 2400, phase: 1300 },
  { x: 690, period: 3800, phase: 2600 },
];

function stormOverhead({ g, horizonY, target, now }: HorizonSky) {
  OVERHEAD_ARCS.forEach((arc, i) => {
    const t = ((now + arc.phase) % arc.period) / arc.period;
    if (t > 0.22) return;
    const flash = 1 - t / 0.22;
    let x = arc.x;
    let y = 4;
    const branch: HorizonPoint[] = [];
    g.lineStyle(1.6, blend(0xc8d4ff, target, 0.2), 0.65 * flash);
    g.beginPath();
    g.moveTo(x, y);
    for (let seg = 0; seg < 8; seg++) {
      x += (hash(i * 31 + seg) - 0.5) * 54;
      y += (horizonY - 30 - y) / (8 - seg);
      g.lineTo(x, y);
      if (seg === 4) branch.push({ x, h: y });
    }
    g.strokePath();

    // One fork off the main channel, which is what makes a discharge read as
    // a discharge rather than as a crack in the screen.
    if (!branch.length) return;
    g.lineStyle(1, blend(0xc8d4ff, target, 0.35), 0.4 * flash);
    g.beginPath();
    g.moveTo(branch[0].x, branch[0].h);
    g.lineTo(branch[0].x + 34, branch[0].h + 28);
    g.lineTo(branch[0].x + 18, branch[0].h + 58);
    g.strokePath();
  });
}

export const OVERHEAD_SKIES: Partial<Record<number, (view: HorizonSky) => void>> = {
  4: stormOverhead,
};

// A world with no distant self at all: the Splitting Hollow, eaten by its own
// fog, and the Devouring Mirror, whose horizon is the Qumatuomi sky rather
// than any silhouette. Both carry swallow zero, so this is what their
// neighbours look forward into.
const NOTHING: DistantSelf = { points: [] };

export const DISTANT_SELVES: Partial<Record<number, DistantSelf>> = {
  1: { points: treeline() },
  2: { points: columnTeeth() },
  3: { points: cliffPlateaus() },
  4: { points: stormLine(), sky: stormSky },
  5: { points: glacierRidges() },
  6: { points: shardRows() },
  7: { points: [], sky: webSky },
  8: NOTHING,
  9: { points: scarRidge(), sky: scarSky },
  10: NOTHING,
};
