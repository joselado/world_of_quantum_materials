import Phaser from 'phaser';
import { getBiome } from './biomes';
import { blend, hashSeed, seededRandom } from './colors';
import { DISTANT_SELVES, MAX_CREST } from './horizons';
import { CANVAS_W } from './perspective';

// A standalone, hand-drawn Finland-coastline map (a Suomi/"Qumatuomi" pun),
// built the same way every other art/ builder in this game is -- Graphics
// shape drawing plus scene.add.container, no image assets. Deliberately has
// no idea who its caller is: it doesn't read scene.game.registry, doesn't
// know about Bloch/travel costs/guardian panels, and wires no interactivity
// of its own. A caller places the returned container wherever it likes and
// reads the returned marker list to attach its own click handling later.
//
// The same coastline has two builds, and they stay separate. `buildQumatuomiMap`
// is the panel one: markers, per-world region terrain (MAP_STYLE below), a
// container to click.
// `drawQumatuomiOverlook` is scenery -- the land below World 10's cliff, drawn
// straight into a Graphics as a hazed record with every affordance stripped.
// Sharing the geometry is the point, and sharing it *exactly* is what lets a
// player recognise the coastline below the cliff as the map they have been
// reading in Bloch's panel all game; sharing the markers would put an
// interface element in the scenery.

// Silhouette authored in a fixed native coordinate space, already in the
// on-screen orientation the design calls "rotated 90 degrees" -- x=0 (left)
// reads as north Finland, x=NATIVE_W (right) reads as south Finland.
// `buildQumatuomiMap` uniformly scales this native space to fit the
// caller's own width/height budget.
//
// Every boundary point below is a real Finnish border/coastline landmark
// pushed through one affine map from geographic coordinates:
//   x = (70.1 - lat) * 20.87        (lat 70.1N at x=0, lat 59.8N at x=215)
//   y = (31.7 - lon) * 9.0          (lon 31.7E at y=0, lon 19.5E at y~110)
// so smaller y reads further east, larger y further west. The two scale
// factors approximate equal ground distance per px at Finland's own
// latitudes (1 deg lon ~ cos(63)*111 km ~ 0.45 * 1 deg lat), so the
// silhouette keeps the country's real elongated proportions instead of
// being stretched to fill the box.
const NATIVE_W = 215;
const NATIVE_H = 110;

// Upper and lower coastline boundaries, both listed north(x=0)->south so
// `topAt`/`bottomAt` below can interpolate either one the same way. The
// top boundary is the eastern border (the Teno valley bump, then the
// Russian border with its inward dip at [108, 18], out to its easternmost
// point at [150, 2], then the southeast border slanting back west to the
// Gulf of Finland at [200, 36], then the south coast's eastern half down
// to the capital's longitude at [208, 61]). The bottom boundary is the
// western side: the northwest border sloping in to the notch corner at
// [32, 70] where the neighbouring country wedges deep between the main
// body and the thin northwestern "arm," the arm itself protruding back
// north-west to its tip at [22, 100], the river border with Sweden, the
// Gulf of Bothnia coast -- whose bay corner indents the silhouette to
// [106, 56], the country's visual "waist" -- the westernmost mainland
// bulge at [146, 91], and the southwest coast curving back east to the
// south coast's western tip at [215, 79]. The fill polygon walks the top
// boundary out and the bottom boundary back, closing the loop; the two
// closing segments are the short north tip (at x=0) and the slanted
// south coast (top-last to bottom-last), whose slant is real -- the south
// coast's western end reaches further south than its eastern end.
//
// The arm makes BOTTOM_BOUNDARY non-monotonic in x ([32, 70] -> [22, 100]
// runs backwards): the fill polygon renders that fine, and `interp` scans
// intervals in list order, so for x under the notch it returns the
// notch-line value and never reaches into the arm -- exactly the
// conservative bound `maxSafeRadius` wants there.
//
// Because y is calibrated against real longitude everywhere (see the
// mapping above), the south-coast stretch in particular carries exact
// east-west meaning: World 10's position (below) is a real value on that
// scale, not an arbitrary one.
const TOP_BOUNDARY: [number, number][] = [
  [0, 35],
  [9, 28],
  [22, 25],
  [34, 30],
  [52, 27],
  [69, 23],
  [86, 14],
  [108, 18],
  [123, 10],
  [150, 2],
  [165, 10],
  [186, 26],
  [200, 36],
  [208, 61],
];
const BOTTOM_BOUNDARY: [number, number][] = [
  [0, 46],
  [10, 50],
  [17, 53],
  [32, 70],
  [22, 100],
  [34, 83],
  [45, 72],
  [69, 70],
  [88, 68],
  [106, 56],
  [113, 65],
  [131, 77],
  [139, 85],
  [146, 91],
  [161, 94],
  [178, 92],
  [194, 92],
  [201, 85],
  [215, 79],
];

const SILHOUETTE_POINTS: [number, number][] = [...TOP_BOUNDARY, ...[...BOTTOM_BOUNDARY].reverse()];

// The southwest archipelago, as a trail of small separate skerries -- kept
// as their own tiny shapes rather than notches carved into the main
// coastline, so the silhouette polygon itself stays simple to author and
// read. They sit off the southwest corner, past the mainland's own
// `BOTTOM_BOUNDARY` edge (i.e. further west on the longitude scale above),
// thinning from an inner cluster near the coast out to the large main
// island of the outer island group at [207, 104] -- the same
// dense-near-shore, big-island-far-out structure the real archipelago has.
const ARCHIPELAGO_ISLANDS: { x: number; y: number; r: number }[] = [
  { x: 202, y: 90, r: 1.6 },
  { x: 205, y: 88, r: 1.2 },
  { x: 204, y: 94, r: 2.2 },
  { x: 208, y: 92, r: 1.4 },
  { x: 207, y: 98, r: 1.9 },
  { x: 210, y: 96, r: 1.2 },
  { x: 211, y: 101, r: 1.4 },
  { x: 207, y: 104, r: 3.2 },
  { x: 211, y: 106, r: 1.6 },
  { x: 203, y: 106, r: 1.2 },
];

// World-marker positions in the same native coordinate space. Worlds 1-9 are
// a purely aesthetic left-to-right zigzag with no attempt at real-geography
// meaning. World 10 is the one exception: both coordinates are a specific
// real south-coast municipality just west of the country's capital, pushed
// through the same lat/lon mapping the coastline uses --
// (70.1 - 60.21) * 20.87 = 206.4 -> x 206, (31.7 - 24.66) * 9.0 = 63.4 ->
// y 63 -- a quiet easter egg. Nothing in this module ever surfaces that
// real place name to the player; the position alone is the joke.
const WORLD_POSITIONS: Record<number, { x: number; y: number }> = {
  1: { x: 14, y: 40 },
  2: { x: 38, y: 52 },
  3: { x: 54, y: 36 },
  4: { x: 74, y: 58 },
  5: { x: 94, y: 30 },
  6: { x: 114, y: 50 },
  7: { x: 136, y: 22 },
  8: { x: 158, y: 62 },
  9: { x: 180, y: 34 },
  10: { x: 206, y: 63 },
};

const LAND_FILL = 0x37493c;
const LAND_STROKE = 0x1c2a1f;
const UNDISCOVERED_FILL = 0x33394a;
const UNDISCOVERED_STROKE = 0x565f78;
const MIST_COLOR = 0xcfd6e6;

// How the panel build renders each world's region -- one line to flip:
//
//   'a' painted biomes: the landmass is partitioned into ten regions (nearest
//       world position, clipped to the coastline), each flat-filled with its
//       world's own terrain colour and scattered with small texture marks
//       built from that world's surround -- tree crowns, band stripes, flow
//       streaks, leaning shards, cracks -- so the map reads as ten kinds of
//       country rather than ten labelled dots.
//   'b' terrain vignettes: the landmass keeps one shared land colour with a
//       soft per-world tint, and an authored cluster of that world's own
//       features (a stand of trees, a colonnade, reeds in a pool) stands at
//       each world's position like the drawings on an old atlas.
//   'c' regions + horizon miniatures: painted regions as in 'a', but instead
//       of texture marks each world carries its own horizon silhouette
//       (art/horizons.ts's distant self) as a miniature ridge across its
//       region.
//
// All three keep the same coastline, markers and undiscovered shroud;
// drawQumatuomiOverlook below is untouched by this choice (the overlook
// deliberately strips every per-world region treatment).
export type QumatuomiMapStyle = 'a' | 'b' | 'c';
export const MAP_STYLE: QumatuomiMapStyle = 'a';

// A world's region colour: its own ground carried most of the way, lifted
// toward its walkable-path colour just enough that a map of it reads as
// terrain seen from above rather than as the dark impassable surround alone.
function regionColor(world: number): number {
  const b = getBiome(world);
  return blend(b.ground, b.path, 0.35);
}

// Point-in-polygon against the full silhouette (ray cast), rather than the
// topAt/bottomAt interpolators: those scan intervals in list order and are
// deliberately conservative under the northwestern arm, which would leave the
// arm unpainted in a full-region fill.
function insideLand(x: number, y: number): boolean {
  let inside = false;
  const pts = SILHOUETTE_POINTS;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function nearestTwoWorlds(x: number, y: number): { w1: number; d1: number; w2: number; d2: number } {
  let w1 = 1;
  let d1 = Infinity;
  let w2 = 1;
  let d2 = Infinity;
  for (let w = 1; w <= 10; w++) {
    const p = WORLD_POSITIONS[w];
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < d1) {
      w2 = w1;
      d2 = d1;
      w1 = w;
      d1 = d;
    } else if (d < d2) {
      w2 = w;
      d2 = d;
    }
  }
  return { w1, d1, w2, d2 };
}

function interp(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return last[1];
}

function topAt(x: number): number {
  return interp(TOP_BOUNDARY, x);
}
function bottomAt(x: number): number {
  return interp(BOTTOM_BOUNDARY, x);
}

// Caps a region-tint blob's radius so it stays inside the coastline at that
// marker's own position, rather than needing a real clip mask -- the
// silhouette's local vertical margins above/below the marker bound it.
function maxSafeRadius(x: number, y: number, desired: number): number {
  const marginTop = y - topAt(x);
  const marginBottom = bottomAt(x) - y;
  return Math.max(4, Math.min(desired, marginTop * 0.85, marginBottom * 0.85));
}

type ToScreen = (nx: number, ny: number) => { x: number; y: number };

// --- Style 'a' / 'c': painted regions --------------------------------------

// Native-px cell size of the region fill, and how wide the soft blend between
// two adjacent regions runs. Cells are painted only when all four corners sit
// inside the coastline, which leaves a thin rim of the shared LAND_FILL along
// every coast -- read as shoreline, and what keeps the paint from ever
// spilling past the stroked outline without a clip mask.
const REGION_CELL = 2;
const REGION_BORDER_SOFT = 6;

function paintRegions(g: Phaser.GameObjects.Graphics, discovered: Set<number>, toScreen: ToScreen, scale: number) {
  const colorOf = (w: number) => (discovered.has(w) ? regionColor(w) : UNDISCOVERED_FILL);
  for (let x = 0; x < NATIVE_W; x += REGION_CELL) {
    for (let y = 0; y < NATIVE_H; y += REGION_CELL) {
      if (
        !insideLand(x, y) ||
        !insideLand(x + REGION_CELL, y) ||
        !insideLand(x, y + REGION_CELL) ||
        !insideLand(x + REGION_CELL, y + REGION_CELL)
      )
        continue;
      const { w1, w2, d1, d2 } = nearestTwoWorlds(x + REGION_CELL / 2, y + REGION_CELL / 2);
      const margin = d2 - d1;
      const col = margin < REGION_BORDER_SOFT ? blend(colorOf(w1), colorOf(w2), 0.5 - (margin / REGION_BORDER_SOFT) * 0.5) : colorOf(w1);
      const p = toScreen(x, y);
      g.fillStyle(col, 1);
      g.fillRect(p.x, p.y, REGION_CELL * scale, REGION_CELL * scale);
    }
  }
  // The skerries belong to whichever region their nearest world owns -- a rim
  // of LAND_FILL stays around each, same as the mainland's shoreline.
  ARCHIPELAGO_ISLANDS.forEach((isl) => {
    const { w1 } = nearestTwoWorlds(isl.x, isl.y);
    const p = toScreen(isl.x, isl.y);
    g.fillStyle(colorOf(w1), 1);
    g.fillCircle(p.x, p.y, Math.max(0.5, (isl.r - 0.6) * scale));
  });
}

// --- Style 'a': per-world texture marks ------------------------------------

// Deterministically scattered marks, each built from its world's own surround
// (the same identities art/horizons.ts and the wall themes state): crowns for
// the Mean Fields' forest, stone flecks for the Stone Lattice, terrace lines,
// band stripes, flow streaks, leaning shards, gold web nodes, pools and
// reeds, cracks with embers, pale facets. Marks stay off the soft borders and
// off undiscovered regions.
function drawTextureMark(g: Phaser.GameObjects.Graphics, world: number, p: { x: number; y: number }, s: number, rand: () => number) {
  switch (world) {
    case 1: {
      g.fillStyle(0x1e4726, 0.9);
      g.fillCircle(p.x, p.y, (0.8 + rand() * 0.6) * s);
      break;
    }
    case 2: {
      const w = 1.3 * s;
      g.fillStyle(0xdcc9a8, 0.5);
      g.fillRect(p.x - w / 2, p.y - w / 2, w, w);
      break;
    }
    case 3: {
      g.lineStyle(Math.max(0.6, 0.7 * s), 0x2c343a, 0.65);
      g.lineBetween(p.x - 1.8 * s, p.y, p.x + 1.8 * s, p.y);
      break;
    }
    case 4: {
      g.lineStyle(Math.max(0.5, 0.6 * s), 0x8fa8e8, 0.5);
      g.lineBetween(p.x - 2 * s, p.y, p.x + 2 * s, p.y);
      break;
    }
    case 5: {
      g.lineStyle(Math.max(0.5, 0.6 * s), 0xd8ecf4, 0.55);
      g.lineBetween(p.x - 1.6 * s, p.y + 0.6 * s, p.x + 1.6 * s, p.y - 0.6 * s);
      break;
    }
    case 6: {
      g.lineStyle(Math.max(0.6, 0.8 * s), 0x6f9c7e, 0.6);
      g.lineBetween(p.x - 0.6 * s, p.y + 1.1 * s, p.x + 0.6 * s, p.y - 1.1 * s);
      break;
    }
    case 7: {
      g.fillStyle(0xefdaa4, 0.85);
      g.fillCircle(p.x, p.y, 0.55 * s);
      if (rand() < 0.45) {
        g.lineStyle(Math.max(0.4, 0.4 * s), 0xefdaa4, 0.4);
        g.lineBetween(p.x, p.y, p.x + (rand() * 4 - 2) * s, p.y + (rand() * 4 - 2) * s);
      }
      break;
    }
    case 8: {
      if (rand() < 0.5) {
        g.fillStyle(0x0a100c, 0.75);
        g.fillEllipse(p.x, p.y, 2.6 * s, 1.5 * s);
      } else {
        g.lineStyle(Math.max(0.5, 0.6 * s), 0x707a60, 0.8);
        g.lineBetween(p.x, p.y + 0.9 * s, p.x, p.y - 0.9 * s);
      }
      break;
    }
    case 9: {
      g.lineStyle(Math.max(0.5, 0.6 * s), 0x140608, 0.8);
      const dx = (rand() - 0.5) * 2 * s;
      g.lineBetween(p.x - 1.5 * s, p.y - dx, p.x, p.y + dx * 0.5);
      g.lineBetween(p.x, p.y + dx * 0.5, p.x + 1.5 * s, p.y - dx * 0.3);
      if (rand() < 0.4) {
        g.fillStyle(0xff8a3a, 0.7);
        g.fillCircle(p.x, p.y + dx * 0.5, 0.5 * s);
      }
      break;
    }
    case 10: {
      g.fillStyle(0xd8c8ee, 0.4);
      g.fillTriangle(p.x, p.y - 1.1 * s, p.x + 1 * s, p.y + 0.7 * s, p.x - 1 * s, p.y + 0.7 * s);
      break;
    }
  }
}

function drawRegionTextures(g: Phaser.GameObjects.Graphics, discovered: Set<number>, toScreen: ToScreen, scale: number) {
  const rand = seededRandom(hashSeed('qumatuomi-texture'));
  for (let i = 0; i < 560; i++) {
    const x = rand() * NATIVE_W;
    const y = rand() * NATIVE_H;
    if (!insideLand(x, y)) continue;
    const { w1, d1, d2 } = nearestTwoWorlds(x, y);
    if (d2 - d1 < 3) continue;
    if (!discovered.has(w1)) continue;
    drawTextureMark(g, w1, toScreen(x, y), scale, rand);
  }
}

// --- Style 'b': terrain vignettes ------------------------------------------

// One authored cluster per world, standing at the world's own position the
// way an old atlas draws a few trees for a forest and a cone for a volcano.
// Offsets are native px around the marker; every shape is that world's own
// surround in miniature.
function drawVignette(g: Phaser.GameObjects.Graphics, world: number, p: { x: number; y: number }, s: number) {
  switch (world) {
    case 1: {
      // A stand of trees: crown circles on short trunks.
      [
        { x: -6, y: -3, r: 1.7 },
        { x: -1, y: -6, r: 2 },
        { x: 4, y: -2, r: 1.6 },
        { x: 1, y: 2, r: 1.4 },
      ].forEach((t) => {
        g.lineStyle(Math.max(0.6, 0.7 * s), 0x143018, 0.9);
        g.lineBetween(p.x + t.x * s, p.y + t.y * s, p.x + t.x * s, p.y + (t.y + 2.4) * s);
        g.fillStyle(0x1e4726, 1);
        g.fillCircle(p.x + t.x * s, p.y + t.y * s, t.r * s);
        g.fillStyle(0x3f7a4a, 0.7);
        g.fillCircle(p.x + (t.x - 0.4) * s, p.y + (t.y - 0.5) * s, t.r * 0.5 * s);
      });
      break;
    }
    case 2: {
      // A colonnade: three columns under one lintel.
      g.fillStyle(0xdcc9a8, 0.95);
      [-4, 0, 4].forEach((dx) => g.fillRect(p.x + (dx - 0.8) * s, p.y - 4 * s, 1.6 * s, 5 * s));
      g.fillRect(p.x - 5.4 * s, p.y - 5.2 * s, 10.8 * s, 1.2 * s);
      g.fillStyle(0x4a3427, 0.8);
      [-4, 0, 4].forEach((dx) => g.fillRect(p.x + (dx + 0.8) * s, p.y - 4 * s, 0.5 * s, 5 * s));
      break;
    }
    case 3: {
      // Terraced steps: a staircase of ledges with vertical drops.
      g.lineStyle(Math.max(0.7, 0.9 * s), 0xdfe6e2, 0.9);
      g.beginPath();
      g.moveTo(p.x - 6 * s, p.y + 3 * s);
      g.lineTo(p.x - 2 * s, p.y + 3 * s);
      g.lineTo(p.x - 2 * s, p.y);
      g.lineTo(p.x + 2 * s, p.y);
      g.lineTo(p.x + 2 * s, p.y - 3 * s);
      g.lineTo(p.x + 6 * s, p.y - 3 * s);
      g.strokePath();
      g.fillStyle(0x2c343a, 0.6);
      g.fillRect(p.x - 6 * s, p.y + 3.2 * s, 4 * s, 1.2 * s);
      g.fillRect(p.x - 2 * s, p.y + 0.2 * s, 4 * s, 1.2 * s);
      g.fillRect(p.x + 2 * s, p.y - 2.8 * s, 4 * s, 1.2 * s);
      break;
    }
    case 4: {
      // Flat band lines with a lightning fork over them.
      g.lineStyle(Math.max(0.5, 0.7 * s), 0x6272b8, 0.8);
      g.lineBetween(p.x - 6 * s, p.y + 2 * s, p.x + 6 * s, p.y + 2 * s);
      g.lineBetween(p.x - 6 * s, p.y + 3.6 * s, p.x + 6 * s, p.y + 3.6 * s);
      g.lineStyle(Math.max(0.6, 0.8 * s), 0xa8e4ff, 0.95);
      g.beginPath();
      g.moveTo(p.x + 0.5 * s, p.y - 6 * s);
      g.lineTo(p.x - 1.2 * s, p.y - 2.5 * s);
      g.lineTo(p.x + 0.4 * s, p.y - 2.1 * s);
      g.lineTo(p.x - 0.8 * s, p.y + 1.4 * s);
      g.strokePath();
      break;
    }
    case 5: {
      // Pressure ridges: pale upright triangles in a row.
      [
        { x: -4.5, h: 3 },
        { x: 0, h: 4.2 },
        { x: 4.5, h: 2.6 },
      ].forEach((r) => {
        g.fillStyle(0xd8ecf4, 0.95);
        g.fillTriangle(p.x + (r.x - 2) * s, p.y + 2 * s, p.x + r.x * s, p.y + (2 - r.h) * s, p.x + (r.x + 2) * s, p.y + 2 * s);
        g.lineStyle(Math.max(0.4, 0.5 * s), 0x54707e, 0.8);
        g.lineBetween(p.x + r.x * s, p.y + (2 - r.h) * s, p.x + (r.x + 2) * s, p.y + 2 * s);
      });
      break;
    }
    case 6: {
      // Aligned shards, all leaning one way.
      g.fillStyle(0x2c3a34, 1);
      [-4, -0.5, 3].forEach((dx, i) => {
        const h = [3.4, 4.4, 3][i];
        g.fillTriangle(p.x + dx * s, p.y + 2 * s, p.x + (dx + 2.4) * s, p.y + (2 - h) * s, p.x + (dx + 3) * s, p.y + 2 * s);
      });
      g.lineStyle(Math.max(0.4, 0.5 * s), 0x6f9c7e, 0.9);
      [-4, -0.5, 3].forEach((dx, i) => {
        const h = [3.4, 4.4, 3][i];
        g.lineBetween(p.x + dx * s, p.y + 2 * s, p.x + (dx + 2.4) * s, p.y + (2 - h) * s);
      });
      break;
    }
    case 7: {
      // A little web: gold nodes joined by filaments.
      const nodes = [
        { x: -5, y: -2 },
        { x: -1, y: -5 },
        { x: 3.5, y: -1.5 },
        { x: 0.5, y: 2.5 },
        { x: 5, y: 3 },
      ];
      g.lineStyle(Math.max(0.4, 0.5 * s), 0xefdaa4, 0.7);
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [0, 3],
        [2, 4],
      ].forEach(([a, b]) => g.lineBetween(p.x + nodes[a].x * s, p.y + nodes[a].y * s, p.x + nodes[b].x * s, p.y + nodes[b].y * s));
      g.fillStyle(0xefdaa4, 1);
      nodes.forEach((n) => g.fillCircle(p.x + n.x * s, p.y + n.y * s, 0.8 * s));
      break;
    }
    case 8: {
      // A dark pool with reeds standing out of it.
      g.fillStyle(0x0a100c, 0.9);
      g.fillEllipse(p.x, p.y + 1.5 * s, 9 * s, 3.6 * s);
      g.lineStyle(Math.max(0.5, 0.6 * s), 0x707a60, 0.95);
      [-3, -1, 1.5, 3.5].forEach((dx, i) => {
        const h = [3, 4.2, 3.6, 2.6][i];
        g.lineBetween(p.x + dx * s, p.y + 1.2 * s, p.x + (dx + 0.5) * s, p.y + (1.2 - h) * s);
      });
      break;
    }
    case 9: {
      // Open cracks with ember glow.
      g.lineStyle(Math.max(0.6, 0.8 * s), 0x140608, 0.95);
      g.beginPath();
      g.moveTo(p.x - 5 * s, p.y - 1 * s);
      g.lineTo(p.x - 1.5 * s, p.y + 0.6 * s);
      g.lineTo(p.x + 1 * s, p.y - 0.8 * s);
      g.lineTo(p.x + 5 * s, p.y + 0.4 * s);
      g.strokePath();
      g.beginPath();
      g.moveTo(p.x - 1.5 * s, p.y + 0.6 * s);
      g.lineTo(p.x - 0.5 * s, p.y + 3 * s);
      g.strokePath();
      g.fillStyle(0xff8a3a, 0.85);
      g.fillCircle(p.x - 1.5 * s, p.y + 0.6 * s, 0.7 * s);
      g.fillCircle(p.x + 2.8 * s, p.y - 0.1 * s, 0.5 * s);
      g.fillCircle(p.x - 0.8 * s, p.y + 2 * s, 0.4 * s);
      break;
    }
    case 10: {
      // Reconfiguring facets: pale violet shards, one lit.
      g.fillStyle(0x9a86c8, 0.7);
      g.fillTriangle(p.x - 4.5 * s, p.y + 2 * s, p.x - 2.5 * s, p.y - 2 * s, p.x - 0.5 * s, p.y + 1.4 * s);
      g.fillTriangle(p.x + 1 * s, p.y + 2.4 * s, p.x + 3 * s, p.y - 1 * s, p.x + 5 * s, p.y + 1.8 * s);
      g.fillStyle(0xd8c8ee, 0.95);
      g.fillTriangle(p.x - 1 * s, p.y - 0.5 * s, p.x + 1 * s, p.y - 4 * s, p.x + 2.6 * s, p.y - 0.2 * s);
      break;
    }
  }
}

// --- Style 'c': horizon miniatures -----------------------------------------

// Half-width and height budget of a miniature ridge, in native px. Height maps
// the horizon module's own MAX_CREST so the relative scale between worlds'
// silhouettes survives the shrink.
const MINI_HORIZON_HALF_W = 13;
const MINI_HORIZON_H = 6.5;

function drawMiniHorizon(g: Phaser.GameObjects.Graphics, world: number, toScreen: ToScreen, scale: number) {
  const pos = WORLD_POSITIONS[world];
  const baseY = pos.y + 4;
  const left = pos.x - MINI_HORIZON_HALF_W;
  const shade = blend(regionColor(world), 0x000000, 0.45);
  const self = DISTANT_SELVES[world];
  if (self && self.points.length > 0) {
    const pts = [
      toScreen(left, baseY),
      ...self.points.map((pt) => toScreen(left + (pt.x / CANVAS_W) * MINI_HORIZON_HALF_W * 2, baseY - (pt.h / MAX_CREST) * MINI_HORIZON_H)),
      toScreen(pos.x + MINI_HORIZON_HALF_W, baseY),
    ];
    g.fillStyle(shade, 0.85);
    g.fillPoints(pts, true);
    return;
  }
  // Worlds whose distant self is not a silhouette (WORLDS.md section 4): the
  // Entangled Web's glints, the Screened Swamp's waterline and reeds. The
  // Devouring Mirror has no distant self at all and draws nothing here.
  if (world === 7) {
    g.lineStyle(Math.max(0.5, 0.6 * scale), 0xefdaa4, 0.85);
    [-8, -2, 4].forEach((dx, i) => {
      const a = toScreen(pos.x + dx, baseY - 2 - i);
      const b = toScreen(pos.x + dx + 4, baseY - 3.4 - i);
      g.lineBetween(a.x, a.y, b.x, b.y);
    });
  } else if (world === 8) {
    const a = toScreen(left, baseY);
    const b = toScreen(pos.x + MINI_HORIZON_HALF_W, baseY);
    g.lineStyle(Math.max(0.5, 0.7 * scale), 0xb8c4b0, 0.6);
    g.lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(Math.max(0.5, 0.6 * scale), 0x707a60, 0.9);
    [-6, -2, 2, 6].forEach((dx, i) => {
      const t = toScreen(pos.x + dx, baseY);
      const tip = toScreen(pos.x + dx + 0.5, baseY - [2.4, 3.4, 2.8, 2][i]);
      g.lineBetween(t.x, t.y, tip.x, tip.y);
    });
  }
}

export interface QumatuomiWorldMarker {
  world: number;
  marker: Phaser.GameObjects.Shape;
}

export interface QumatuomiMapBuild {
  container: Phaser.GameObjects.Container;
  markers: QumatuomiWorldMarker[];
  /** Actual rendered width/height in px -- uniform scale-to-fit means these are usually smaller than the requested budget on one axis. */
  width: number;
  height: number;
}

export interface QumatuomiMapOptions {
  /** Target width budget in px -- the silhouette is scaled uniformly (never stretched) to fit within width x height. */
  width: number;
  /** Target height budget in px. */
  height: number;
  /** World numbers (1-10) that currently count as discovered; every other world renders shrouded. */
  discoveredWorlds: Set<number> | number[];
}

/**
 * Builds the Qumatuomi map -- a hand-drawn, simplified Finland coastline
 * with one small circle marker per world (1-10), each tinted with that
 * world's own biome palette once discovered, or rendered shrouded in mist
 * otherwise. Returns a container (positioned with its own local origin at
 * the silhouette's center, so the caller can `setPosition` it anywhere), the
 * actual rendered width/height (uniform scale-to-fit means these are often
 * smaller than the requested budget on one axis), and the individual marker
 * shapes, each tagged with `setData('world', n)`, so a future caller can
 * attach its own click handling/tooltips/travel logic -- this module wires
 * none of that itself.
 */
export function buildQumatuomiMap(scene: Phaser.Scene, opts: QumatuomiMapOptions): QumatuomiMapBuild {
  const discovered = opts.discoveredWorlds instanceof Set ? opts.discoveredWorlds : new Set(opts.discoveredWorlds);
  const scale = Math.min(opts.width / NATIVE_W, opts.height / NATIVE_H);

  const container = scene.add.container(0, 0);

  const toScreen = (nx: number, ny: number) => ({
    x: (nx - NATIVE_W / 2) * scale,
    y: (ny - NATIVE_H / 2) * scale,
  });

  // Base landmass -- one flat fill plus a stroked coastline, same "flat
  // fill, no per-shape faceted shading" treatment the overworld's own ground
  // tiles use, since this is map terrain, not a crystal facet.
  const land = scene.add.graphics();
  const silhouettePts = SILHOUETTE_POINTS.map(([x, y]) => toScreen(x, y));
  land.fillStyle(LAND_FILL, 1);
  land.fillPoints(silhouettePts, true);
  land.lineStyle(Math.max(1, 1.5 * scale), LAND_STROKE, 1);
  land.strokePoints(silhouettePts, true);
  ARCHIPELAGO_ISLANDS.forEach((isl) => {
    const p = toScreen(isl.x, isl.y);
    land.fillStyle(LAND_FILL, 1);
    land.fillCircle(p.x, p.y, isl.r * scale);
    land.lineStyle(Math.max(1, scale), LAND_STROKE, 1);
    land.strokeCircle(p.x, p.y, isl.r * scale);
  });
  container.add(land);

  // Per-world region treatment (MAP_STYLE above), drawn beneath the markers
  // themselves. Styles 'a'/'c' paint the whole landmass as ten regions first;
  // style 'b' keeps the shared land colour and works per marker below.
  const regions = scene.add.graphics();
  container.add(regions);

  if (MAP_STYLE === 'a' || MAP_STYLE === 'c') {
    paintRegions(regions, discovered, toScreen, scale);
    if (MAP_STYLE === 'a') drawRegionTextures(regions, discovered, toScreen, scale);
    else for (let world = 1; world <= 10; world++) if (discovered.has(world)) drawMiniHorizon(regions, world, toScreen, scale);
  }

  const markers: QumatuomiWorldMarker[] = [];

  for (let world = 1; world <= 10; world++) {
    const pos = WORLD_POSITIONS[world];
    const isDiscovered = discovered.has(world);
    const radiusNative = maxSafeRadius(pos.x, pos.y, 16);
    const p = toScreen(pos.x, pos.y);
    const radius = radiusNative * scale;

    if (MAP_STYLE === 'b' && isDiscovered) {
      const biome = getBiome(world);
      [1, 0.66, 0.36].forEach((f, i) => {
        const col = blend(biome.hillColor, biome.path, 1 - f);
        regions.fillStyle(col, 0.16 + i * 0.14);
        regions.fillCircle(p.x, p.y, radius * f);
      });
      // The cluster stands above the marker (which stays at the world's
      // exact position for Bloch's click handling) the way an atlas icon
      // stands above its label, and is drawn a step larger than the marker
      // so it, not the circle, is what the eye reads as the place.
      drawVignette(regions, world, { x: p.x, y: p.y - 3 * scale }, scale * 1.35);
    } else if (!isDiscovered) {
      // Shrouded: a flat dim patch (same undiscovered grey the Materialdex
      // uses for an unmet compound; styles 'a'/'c' have already painted the
      // whole region that grey) plus a few soft, deterministically jittered
      // mist puffs so it reads as fog rather than just "off."
      if (MAP_STYLE === 'b') {
        regions.fillStyle(UNDISCOVERED_FILL, 0.55);
        regions.fillCircle(p.x, p.y, radius);
      }
      const rand = seededRandom(hashSeed(`qumatuomi-mist-${world}`));
      for (let i = 0; i < 3; i++) {
        const ang = rand() * Math.PI * 2;
        const dist = rand() * radius * 0.5;
        const puffR = radius * (0.45 + rand() * 0.35);
        regions.fillStyle(MIST_COLOR, 0.12 + rand() * 0.1);
        regions.fillCircle(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, puffR);
      }
    }

    const markerRadius = Math.max(2.5, 3.6 * scale);
    const fillColor = isDiscovered ? getBiome(world).path : UNDISCOVERED_FILL;
    const strokeColor = isDiscovered ? LAND_STROKE : UNDISCOVERED_STROKE;
    const marker = scene.add.circle(p.x, p.y, markerRadius, fillColor, 1);
    marker.setStrokeStyle(Math.max(1, scale), strokeColor, 1);
    marker.setData('world', world);
    container.add(marker);
    markers.push({ world, marker });
  }

  return { container, markers, width: NATIVE_W * scale, height: NATIVE_H * scale };
}

// ---------------------------------------------------------------------------
// The Devouring Mirror's overlook (WORLDS.md section 4's "The Qumatuomi map
// below").
//
// The Mirror's world ends at a cliff, and what lies below the edge is *every*
// world at once, seen from above -- which is precisely the view a trained
// model has of its training data. It can show the whole map because it has
// consumed all of it.
//
// Drawn as ground far below rather than as an image pasted to the screen: it
// lies in the gap between the cliff lip and the horizon, is lit only by
// itself, and is dimmed and hazed by the same atmosphere that fogs everything
// else, more heavily toward its far edge. The haze is what does the work --
// fog is the cheapest signal that something is scenery, and an interface
// element is never fogged. Unhazed it reads as a misrendered minimap and
// players try to click it.
//
// The silhouette is drawn through the same uniform scale-to-fit
// `buildQumatuomiMap` uses, in the same colours, so the land below is
// recognisably the same map Bloch's panel shows -- that recognition is the
// whole point of the view, and it is worth more than any amount of
// perspective. The only concession to the viewing angle is a mild vertical
// squash. Every interactive affordance is stripped: no markers, no labels, no
// per-world region tints.

// How much the map is flattened by being looked down on at an angle. Mild on
// purpose: enough that the land reads as lying away from the viewer rather
// than hanging in front of them, not so much that the coastline stops being
// the shape the player knows from Bloch's panel.
const OVERLOOK_SQUASH = 0.82;
// The land below is lit by nothing, so it lights itself: the panel's own land
// hue, held at a value that survives the atmosphere stacked over it. The light
// rule is what forces this rather than taste -- the record glows and nothing
// shines on it -- and legibility asks the same, since the whole point of the
// view is the player recognising the coastline they have been travelling.
// Lifted in its own green rather than toward white, which washes the land to
// the same grey as the air it is seen through and loses it.
const OVERLOOK_LAND = 0x6f9e72;
const OVERLOOK_SHORE = 0xe8f2e0;
// How far the land is carried into the live fog target, and how much more of
// it the far edge takes. Enough that its far coast dissolves and its near one
// does not -- an edge as crisp at the back as at the front is a decal.
const OVERLOOK_DROWN = 0.12;
const OVERLOOK_FAR_DROWN = 0.62;
// How much of the gap between lip and horizon the land is drawn across, and
// how far its near edge is held back from the lip. The ground immediately
// under a cliff is the part a standing figure cannot see, and that unseen
// stretch is what makes the land below read as *below*.
const OVERLOOK_FILL = 0.78;
const OVERLOOK_LIP_GAP = 0.2;
// The route traced across it, and the shimmer over the whole record -- slow
// and shallow, a world that is not quite still rather than a flag.
const OVERLOOK_ROUTE = 0xf0e4ff;
const OVERLOOK_SHIMMER_PX = 1.6;
const OVERLOOK_SHIMMER_RATE = 0.00042;

export interface QumatuomiOverlookOptions {
  /** Screen x the map is centred on. */
  cx: number;
  /** Screen y of its far (top) edge -- the horizon end of the gap. */
  top: number;
  /** Screen y of its near (bottom) edge -- the cliff lip. */
  bottom: number;
  /** The live fog colour everything else in the frame is hazing toward. */
  target: number;
  /** The scene clock, which drives the shimmer. */
  now: number;
  /** Worlds the player has actually walked, in the order they walked them. */
  route: number[];
}

// The map's own native space projected into the gap below the cliff. One
// uniform scale for both axes (times the squash), which is what keeps the
// coastline the same shape as the panel's: the land is placed in the gap and
// sized to it, never stretched to fill it.
function overlookPlacement(o: QumatuomiOverlookOptions) {
  const gap = Math.max(8, o.bottom - o.top);
  const scale = Math.min((CANVAS_W * 0.88) / NATIVE_W, (gap * OVERLOOK_FILL) / (NATIVE_H * OVERLOOK_SQUASH));
  const drawnH = NATIVE_H * scale * OVERLOOK_SQUASH;
  const cy = o.bottom - gap * OVERLOOK_LIP_GAP - drawnH / 2;
  return { scale, cy, drawnH };
}

function toOverlook(nx: number, ny: number, o: QumatuomiOverlookOptions, place: ReturnType<typeof overlookPlacement>) {
  const shimmer = Math.sin(ny * 0.06 + o.now * OVERLOOK_SHIMMER_RATE) * OVERLOOK_SHIMMER_PX;
  return {
    x: o.cx + (nx - NATIVE_W / 2) * place.scale + shimmer,
    y: place.cy + (ny - NATIVE_H / 2) * place.scale * OVERLOOK_SQUASH,
    // 0 at the far edge of the drawn land, 1 at its near edge -- what the
    // depth grading below reads, so the far coast hazes out while the near
    // one stays crisp.
    t: ny / NATIVE_H,
  };
}

// A polyline drawn one segment at a time, each segment's width and alpha
// scaled by how far away that part of the land is. Phaser strokes a path at
// one width and one alpha, so a line crossing ground that recedes has to be
// broken up to recede with it. `t` is 0 at the far edge and 1 at the near one.
function strokeReceding(
  g: Phaser.GameObjects.Graphics,
  pts: { x: number; y: number; t: number }[],
  color: number,
  width: number,
  alpha: number
) {
  for (let i = 0; i < pts.length - 1; i++) {
    const t = (pts[i].t + pts[i + 1].t) / 2;
    const fade = 0.45 + 0.55 * t;
    g.lineStyle(Math.max(0.4, width * fade), color, alpha * fade);
    g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  }
}

export function drawQumatuomiOverlook(g: Phaser.GameObjects.Graphics, o: QumatuomiOverlookOptions) {
  const place = overlookPlacement(o);
  const land = blend(OVERLOOK_LAND, o.target, OVERLOOK_DROWN);
  const shore = blend(OVERLOOK_SHORE, o.target, OVERLOOK_DROWN * 0.6);

  const outline = SILHOUETTE_POINTS.map(([x, y]) => toOverlook(x, y, o, place));
  g.fillStyle(land, 1);
  g.fillPoints(outline, true);
  // The coastline, self-luminous per the light rule: the record glows,
  // nothing shines on it. It is what makes the shape read as a coastline
  // rather than as a patch of ground, and it is the line the player actually
  // recognises the map by.
  strokeReceding(g, outline.concat(outline[0]), shore, 2.2, 0.95);

  ARCHIPELAGO_ISLANDS.forEach((isl) => {
    const p = toOverlook(isl.x, isl.y, o, place);
    g.fillStyle(land, 0.95);
    g.fillCircle(p.x, p.y, Math.max(0.6, isl.r * place.scale));
  });

  // *It has your whole walk.* The one thing no other copy of this map carries:
  // a dim luminous trace of the player's own route across it, world by world
  // in the order they were walked. Drawn over the landmass and nothing else --
  // no marker sits at either end of it, because a marker is an affordance and
  // this is a record.
  const legs = o.route.map((w) => WORLD_POSITIONS[w]).filter(Boolean);
  if (legs.length >= 2) {
    // Subdivided rather than drawn corner to corner: the world positions are a
    // coarse zigzag, and a rigid straight run between two of them reads as a
    // chart line. Sampling along each leg lets the trace thin and dim as it
    // goes, which is what makes it a mark left on the map rather than a stroke
    // drawn over it.
    const trace: { x: number; y: number; t: number }[] = [];
    for (let i = 0; i < legs.length - 1; i++) {
      for (let k = 0; k < 6; k++) {
        const f = k / 6;
        trace.push(toOverlook(legs[i].x + (legs[i + 1].x - legs[i].x) * f, legs[i].y + (legs[i + 1].y - legs[i].y) * f, o, place));
      }
    }
    trace.push(toOverlook(legs[legs.length - 1].x, legs[legs.length - 1].y, o, place));
    strokeReceding(g, trace, blend(OVERLOOK_ROUTE, o.target, OVERLOOK_DROWN * 0.2), 3.5, 0.3);
    strokeReceding(g, trace, OVERLOOK_ROUTE, 1.6, 0.65);
  }

  // The air over the land, thickening toward its far edge. This is the
  // load-bearing part: ground whose far edge is exactly as crisp as its near
  // edge is a decal laid on the picture however carefully it is placed.
  // Painted as abutting rows so no two of them share a scanline and
  // double-blend, and the full width of the frame rather than to the map's own
  // bounds -- a veil with vertical edges of its own would draw two lines down
  // the view, which is a box around the thing it exists to dissolve.
  const veilTop = place.cy - place.drawnH / 2 - 4;
  const veilH = place.drawnH + 8;
  // One row per screen pixel, each row drawn from its own rounded top to the
  // next one's, so no two ever share a scanline. Rows that overlap by even a
  // pixel blend twice where they meet and stripe the land with exactly the
  // banding this veil exists to prevent -- and over a shape this small the
  // stripes land inside the coastline, where they read as terrain.
  const veilRows = Math.max(8, Math.round(veilH));
  for (let i = 0; i < veilRows; i++) {
    const t = i / veilRows;
    const y0 = Math.round(veilTop + t * veilH);
    const y1 = Math.round(veilTop + ((i + 1) / veilRows) * veilH);
    if (y1 <= y0) continue;
    g.fillStyle(o.target, OVERLOOK_FAR_DROWN * Math.pow(1 - t, 1.6));
    g.fillRect(0, y0, CANVAS_W, y1 - y0);
  }
}
