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
  // The world the player is standing in. Only the overhead motifs read it --
  // a distant self belongs to the world depicted and already knows which one
  // it is, while the last four worlds share one sky whose stage is the world
  // it is drawn in (art/stars.ts).
  world: number;
  // The worlds the player has actually walked, in the order they walked them.
  // Nothing in the sky reads this: the map that carries the route is the one
  // lying below the Devouring Mirror's cliff (scenes/overworld/sky.ts's
  // overlook pass), not a sky motif. Carried here so a sky that wants the
  // player's own history has it.
  route: number[];
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
  // A standing glow over the flat line, present between flashes. The arcs are
  // this world's distant self, and an intermittent asset cannot be the whole
  // of one -- a frame caught between two flashes would leave the Edge Cliffs
  // looking forward at a colour change and nothing else, which is exactly the
  // adjacency failure the arcs exist to prevent.
  for (let i = 0; i < 5; i++) {
    g.fillStyle(blend(0xb9c4ff, target, 0.45), 0.05);
    g.fillRect(0, horizonY - 6 - i * 5, CANVAS_W, 5);
  }

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

// World 8, the Screened Swamp: an open bog seen from a world away, which is a
// low band of standing water with mist glowing off it and reed clumps
// standing in that band. The profile is dead flat, because a bog is: this
// world's silhouette is horizontal by identity, and everything upright in it
// is reed.
//
// The band is the *lit* half and the reeds are the dark half, and neither can
// be said as a filled silhouette, so the whole distant self is a sky extra at
// swallow zero. A silhouette is drowned most of the way into the live haze
// before it is painted (scenes/overworld/sky.ts's DISTANT_DROWN), which would
// leave a dark base against this world's own pale mist surviving as nothing at
// all -- and the pale base that *would* survive is the same `hillColor` the
// battle arena borrows as its ridge tone, where near-white ridges over
// near-black bog floor bury the HP bars. Drawing both halves here keeps each
// consumer's value where it belongs.
const WATER_H = 7;

// How the lit band is painted: abutting one-pixel rows, brightest at the water
// line and thinning upward, so it has no edge anywhere. Rows never share a
// scanline -- two translucent rects over the same row blend twice and stripe
// the band, the trap sky.ts's fillVerticalFade documents.
function waterGlow(g: Phaser.GameObjects.Graphics, horizonY: number, target: number) {
  for (let i = 0; i < WATER_H; i++) {
    const t = i / (WATER_H - 1);
    g.fillStyle(blend(0xc4d4c6, target, 0.35), 0.12 * (1 - 0.6 * t));
    g.fillRect(0, horizonY - i - 1, W, 1);
  }
}

// The reed clumps standing in that band: a handful of short dark strokes per
// clump, still, and the only vertical thing this world shows from outside
// itself. They are what stop the band reading as the Storm Flats' bare line.
const REED_TUFTS = [
  { x: 62, w: 30, h: 22 },
  { x: 148, w: 20, h: 14 },
  { x: 205, w: 36, h: 27 },
  { x: 318, w: 24, h: 17 },
  { x: 396, w: 32, h: 24 },
  { x: 489, w: 18, h: 12 },
  { x: 552, w: 38, h: 29 },
  { x: 671, w: 22, h: 16 },
  { x: 738, w: 30, h: 21 },
];
const STALKS_PER_TUFT = 4;

function swampSky({ g, horizonY, target }: HorizonSky) {
  waterGlow(g, horizonY, target);
  g.lineStyle(1, blend(0x0a0f0b, target, 0.3), 0.55);
  REED_TUFTS.forEach((tuft, i) => {
    for (let s = 0; s < STALKS_PER_TUFT; s++) {
      const t = s / (STALKS_PER_TUFT - 1);
      const x = tuft.x + t * tuft.w;
      // Tallest in the middle of the clump and shorter at its edges, so a
      // clump reads as a clump rather than as a comb.
      const h = tuft.h * (0.45 + 0.55 * Math.sin(t * Math.PI));
      const lean = (hash(i * 13 + s) - 0.5) * 5;
      g.lineBetween(x, horizonY - WATER_H + 2, x + lean, horizonY - h);
    }
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
// The height the ridge never drops below between two plateaus. A notch is cut
// *into* the ridge, not through it: cutting to the ridge's own base separates
// the plateaus completely at horizon scale, and a row of flat-topped shapes
// standing clear of each other in the mist reads as planks floating above the
// land rather than as one broken skyline. Keeping the notch floor tied to the
// shorter of its two neighbours means a deep plateau still gets a deep notch,
// so the ridge stays broken without coming apart.
const SCAR_BASE = 6;
const SCAR_NOTCH_DEPTH = 0.45;

function scarRidge(): HorizonPoint[] {
  const pts: HorizonPoint[] = [{ x: 0, h: SCAR_BASE }];
  let x = 0;
  SCAR_BLOCKS.forEach((block, i) => {
    pts.push({ x, h: block.h }, { x: x + block.w, h: block.h });
    x += block.w;
    const next = SCAR_BLOCKS[i + 1];
    const floor = next ? Math.max(SCAR_BASE, Math.min(block.h, next.h) * SCAR_NOTCH_DEPTH) : SCAR_BASE;
    pts.push({ x: x + SCAR_NOTCH / 2, h: floor });
    x += SCAR_NOTCH;
  });
  pts.push({ x: W + SCAR_NOTCH, h: SCAR_BASE });
  return pts;
}

// The glow veins in that ridge: short hot lines standing in the notches,
// self-luminous per the light rule -- the sun is gone by the Screened Swamp,
// so the only thing that can announce the world beyond it is light that world
// emits itself.
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

// The Iron Steppe's aurora: the sky still exists here, but it is already
// lying about where light comes from -- the sun is gone and everything the
// player can see is emitted by the world itself. That makes this world the
// hinge of the light arc, one world before the sky is taken away entirely.
//
// It stutters. The aurora is genuinely beautiful and the mood genuinely
// relaxes here, so without a tell the false calm is just a pretty world;
// a curtain that drops out for a beat and comes back is the cheapest one
// available, and real aurorae do it.
const AURORA_BANDS = [
  { x: 110, w: 190, phase: 0 },
  { x: 330, w: 240, phase: 1.9 },
  { x: 580, w: 210, phase: 3.4 },
];

function auroraOverhead({ g, horizonY, now }: HorizonSky) {
  const stutter = Math.sin(now / 2300) > 0.93 ? 0.25 : 1;
  AURORA_BANDS.forEach((band, i) => {
    const lift = 14 + Math.sin(now / 2700 + i) * 6;
    const base = horizonY - MAX_CREST - lift;
    // Painted as many thin overlapping slices rather than a few thick ones: a
    // curtain is brightest at its lower edge and dies out upward with no edge
    // anywhere, and any slice tall enough to see is a bar of green glass.
    // Each slice also sways and narrows as it climbs, which is what gives the
    // sheet its fold.
    // The curtain hangs from just clear of the shard crests up to the top of
    // the frame -- an aurora that stops short of the frame edge reads as a
    // painted band, and the sky above a high horizon line is a narrow strip.
    const SLICES = 30;
    const height = 60;
    for (let step = 0; step < SLICES; step++) {
      const t = step / SLICES;
      const y = base - t * height;
      const sway = Math.sin(now / 3100 + band.phase + t * 2.2) * 30 * t;
      // Each slice is painted as three nested widths rather than one rect.
      // A curtain has no vertical edge either -- a single rect gives the band
      // hard sides, which is what makes it read as a pane of green glass
      // rather than as light. Slices abut exactly rather than overlapping:
      // two translucent rects sharing a scanline blend twice there and stripe
      // the curtain, the same trap sky.ts's fillVerticalFade documents.
      const alpha = 0.032 * (1 - t) * (1 - t) * stutter;
      [1, 0.72, 0.4].forEach((w) => {
        g.fillStyle(0x3fd97a, alpha);
        g.fillRect(band.x + sway + (band.w * (1 - w)) / 2, y, band.w * w, height / SLICES);
      });
    }
  });
}

// Motifs read from the world the player is **standing in**, as opposed to the
// distant selves above, which are read from its neighbour and belong to the
// world depicted. The two answer different questions and are deliberately not
// one table. The Storm Flats is not here: its storm is not a sky motif at all
// but an event that lands, so it is drawn with the terrain it strikes
// (scenes/overworld/terrain/materials/charged.ts).
export const OVERHEAD_SKIES: Partial<Record<number, (view: HorizonSky) => void>> = {
  6: auroraOverhead,
};

// A world with no distant self at all: the Devouring Mirror, which has no
// world after it to show and keeps its Qumatuomi map on the ground below its
// cliff rather than in its sky (art/qumatuomiMap.ts's drawQumatuomiOverlook,
// WORLDS.md section 4). It carries swallow zero, so this is what the Defect
// Scars look forward into.
const NOTHING: DistantSelf = { points: [] };

export const DISTANT_SELVES: Partial<Record<number, DistantSelf>> = {
  1: { points: treeline() },
  2: { points: columnTeeth() },
  3: { points: cliffPlateaus() },
  4: { points: stormLine(), sky: stormSky },
  5: { points: glacierRidges() },
  6: { points: shardRows() },
  7: { points: [], sky: webSky },
  8: { points: [], sky: swampSky },
  9: { points: scarRidge(), sky: scarSky },
  10: NOTHING,
};
