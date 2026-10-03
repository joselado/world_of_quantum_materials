import Phaser from 'phaser';
import { getBiome } from './biomes';
import { blend, hashSeed, seededRandom } from './colors';
import { DISTANT_SELVES, MAX_CREST } from './horizons';
import { CANVAS_W } from './perspective';
import { fillDot } from './shapes';

// A standalone, hand-drawn Finland-coastline map (a Suomi/"Qumatuomi" pun),
// built the same way every other art/ builder in this game is -- Graphics
// shape drawing plus scene.add.container, no image assets. Deliberately has
// no idea who its caller is: it doesn't read scene.game.registry, doesn't
// know about Bloch/travel costs/guardian panels, and wires no interactivity
// of its own. A caller places the returned container wherever it likes and
// reads the returned marker list to attach its own click handling later.
//
// The same coastline has two builds, and they stay separate. `buildQumatuomiMap`
// is the panel one: flat, with markers, in a container to click.
// `drawQumatuomiOverlook` is the land below World 10's cliff: the same country
// drawn straight into a Graphics as a slab standing on the plane down there, in
// the world's own perspective.
// Sharing the land is the point, and sharing it *exactly* is what lets a
// player recognise the country below the cliff as the map they have been
// reading in Bloch's panel all game. Both builds therefore run through the same
// geometry *and* the same region partition and texture scatter (`regionRuns`,
// `drawRegionTextures` below) -- what the two do differently is where each row
// of the land is put on screen and the ink each colour arrives in, which the
// overlook carries into the live fog.
// What is not shared is the markers: those belong to a panel.

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
//       streaks, checkered blocks, cracks -- so the map reads as ten kinds of
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
// All three keep the same coastline, markers and undiscovered shroud.
// drawQumatuomiOverlook below always paints the 'a' treatment -- regions plus
// texture marks -- since that is what the country actually looks like from
// above, and the land past the cliff has to be the land in the panel.
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

// A colour transform a caller can put between the map's own palette and the
// ink that reaches the Graphics. The panel build hands its colours through
// untouched; the overlook (below) carries every one of them into the live fog
// by how far away it lies, which is what puts the land past the cliff in the
// same air as everything else in the frame.
type Tint = (color: number) => number;
const NO_TINT: Tint = (c) => c;

// --- Painted regions, shared by the panel build and the overlook -----------

// Native-px cell size of the region fill, and how wide the soft blend between
// two adjacent regions runs. Cells are painted only when all four corners sit
// inside the coastline, which leaves a thin rim of the shared LAND_FILL along
// every coast -- read as shoreline, and what keeps the paint from ever
// spilling past the stroked outline without a clip mask.
const REGION_CELL = 2;
const REGION_BORDER_SOFT = 6;
// How finely a border cell's blend is rounded before neighbouring cells are
// merged into one run (below). Finer than the cell grid itself resolves, so
// the soft border is unchanged by the rounding and long interior stretches
// still collapse to a single rectangle.
const REGION_MIX_STEPS = 16;

// One horizontal stretch of cells that all take the same colour, in native
// coordinates. `mix` is how far the fill is carried from world `w1` toward
// `w2`, which is only ever non-zero along the soft border between two regions.
interface RegionRun {
  x: number;
  y: number;
  /** Native width of the run -- one or more REGION_CELLs. */
  w: number;
  w1: number;
  w2: number;
  mix: number;
}

let regionRunCache: RegionRun[] | null = null;

// The nearest-world partition of the landmass, resolved once for the whole
// module and reused by both builds. Nothing here depends on the caller's
// scale, screen position or discovery state, so the point-in-polygon and
// nearest-world work -- thousands of cells' worth -- is done a single time
// rather than per build. The overlook is what forces that: it is redrawn on
// every frame the camera moves, and re-partitioning the country each time
// would be paid for out of the frame budget of the walk up to the cliff.
// Cells are merged into horizontal runs for the same reason: an interior
// stretch of one world's region is a single rectangle instead of fifty.
function regionRuns(): RegionRun[] {
  if (regionRunCache) return regionRunCache;
  const runs: RegionRun[] = [];
  for (let y = 0; y < NATIVE_H; y += REGION_CELL) {
    let run: RegionRun | null = null;
    for (let x = 0; x < NATIVE_W; x += REGION_CELL) {
      if (
        !insideLand(x, y) ||
        !insideLand(x + REGION_CELL, y) ||
        !insideLand(x, y + REGION_CELL) ||
        !insideLand(x + REGION_CELL, y + REGION_CELL)
      ) {
        run = null;
        continue;
      }
      const { w1, w2, d1, d2 } = nearestTwoWorlds(x + REGION_CELL / 2, y + REGION_CELL / 2);
      const margin = d2 - d1;
      const mix =
        margin < REGION_BORDER_SOFT
          ? Math.round((0.5 - (margin / REGION_BORDER_SOFT) * 0.5) * REGION_MIX_STEPS) / REGION_MIX_STEPS
          : 0;
      if (run && run.w1 === w1 && run.mix === mix && (mix === 0 || run.w2 === w2) && run.x + run.w === x) {
        run.w += REGION_CELL;
      } else {
        run = { x, y, w: REGION_CELL, w1, w2: mix === 0 ? w1 : w2, mix };
        runs.push(run);
      }
    }
  }
  regionRunCache = runs;
  return runs;
}

interface RegionPaintOptions {
  discovered: Set<number>;
  toScreen: ToScreen;
  /** Screen px per native px. */
  scale: number;
}

// The flat fill of the ten regions, as the panel build draws them: every run
// is an axis-aligned rectangle at one scale. The overlook paints the same runs
// itself, since there each one is a trapezoid.
function paintRegions(g: Phaser.GameObjects.Graphics, o: RegionPaintOptions) {
  // The palette is ten entries and the partition is several hundred runs, so
  // it is resolved once per call rather than once or twice per run.
  const palette: number[] = [];
  for (let w = 1; w <= 10; w++) palette[w] = o.discovered.has(w) ? regionColor(w) : UNDISCOVERED_FILL;
  const colorOf = (w: number) => palette[w] ?? UNDISCOVERED_FILL;
  // Half a pixel of overlap on each run, so two neighbours drawn at a
  // fractional scale meet rather than leaving a hairline of the land fill
  // between them. Every fill here is opaque, so an overlap costs nothing.
  const bleed = 0.5;
  for (const run of regionRuns()) {
    const col = run.mix > 0 ? blend(colorOf(run.w1), colorOf(run.w2), run.mix) : colorOf(run.w1);
    const p = o.toScreen(run.x, run.y);
    g.fillStyle(col, 1);
    g.fillRect(p.x, p.y, run.w * o.scale + bleed, REGION_CELL * o.scale + bleed);
  }
  // The skerries belong to whichever region their nearest world owns -- a rim
  // of LAND_FILL stays around each, same as the mainland's shoreline.
  ARCHIPELAGO_ISLANDS.forEach((isl) => {
    const { w1 } = nearestTwoWorlds(isl.x, isl.y);
    const p = o.toScreen(isl.x, isl.y);
    g.fillStyle(colorOf(w1), 1);
    fillDot(g, p.x, p.y, Math.max(0.5, (isl.r - 0.6) * o.scale));
  });
}

// --- Per-world texture marks ------------------------------------------------

// Deterministically scattered marks, each built from its world's own surround
// (the same identities art/horizons.ts and the wall themes state): crowns for
// the Mean Fields' forest, stone flecks for the Stone Lattice, terrace lines,
// band stripes, flow streaks, checkered blocks beside swells, gold web nodes, pools and
// reeds, cracks with embers, pale facets. Marks stay off the soft borders and
// off undiscovered regions.
function drawTextureMark(
  g: Phaser.GameObjects.Graphics,
  world: number,
  p: { x: number; y: number },
  s: number,
  rand: () => number,
  tint: Tint
) {
  const fill = (color: number, alpha: number) => g.fillStyle(tint(color), alpha);
  const line = (width: number, color: number, alpha: number) => g.lineStyle(width, tint(color), alpha);
  switch (world) {
    case 1: {
      fill(0x1e4726, 0.9);
      g.fillCircle(p.x, p.y, (0.8 + rand() * 0.6) * s);
      break;
    }
    case 2: {
      const w = 1.3 * s;
      fill(0xdcc9a8, 0.5);
      g.fillRect(p.x - w / 2, p.y - w / 2, w, w);
      break;
    }
    case 3: {
      line(Math.max(0.6, 0.7 * s), 0x2c343a, 0.65);
      g.lineBetween(p.x - 1.8 * s, p.y, p.x + 1.8 * s, p.y);
      break;
    }
    case 4: {
      line(Math.max(0.5, 0.6 * s), 0x8fa8e8, 0.5);
      g.lineBetween(p.x - 2 * s, p.y, p.x + 2 * s, p.y);
      break;
    }
    case 5: {
      line(Math.max(0.5, 0.6 * s), 0xd8ecf4, 0.55);
      g.lineBetween(p.x - 1.6 * s, p.y + 0.6 * s, p.x + 1.6 * s, p.y - 0.6 * s);
      break;
    }
    case 6: {
      line(Math.max(0.6, 0.8 * s), 0x6f9c7e, 0.6);
      g.lineBetween(p.x - 0.6 * s, p.y + 1.1 * s, p.x + 0.6 * s, p.y - 1.1 * s);
      break;
    }
    case 7: {
      fill(0xefdaa4, 0.85);
      g.fillCircle(p.x, p.y, 0.55 * s);
      if (rand() < 0.45) {
        line(Math.max(0.4, 0.4 * s), 0xefdaa4, 0.4);
        g.lineBetween(p.x, p.y, p.x + (rand() * 4 - 2) * s, p.y + (rand() * 4 - 2) * s);
      }
      break;
    }
    case 8: {
      if (rand() < 0.5) {
        fill(0x0a100c, 0.75);
        g.fillEllipse(p.x, p.y, 2.6 * s, 1.5 * s);
      } else {
        line(Math.max(0.5, 0.6 * s), 0x707a60, 0.8);
        g.lineBetween(p.x, p.y + 0.9 * s, p.x, p.y - 0.9 * s);
      }
      break;
    }
    case 9: {
      line(Math.max(0.5, 0.6 * s), 0x140608, 0.8);
      const dx = (rand() - 0.5) * 2 * s;
      g.lineBetween(p.x - 1.5 * s, p.y - dx, p.x, p.y + dx * 0.5);
      g.lineBetween(p.x, p.y + dx * 0.5, p.x + 1.5 * s, p.y - dx * 0.3);
      if (rand() < 0.4) {
        fill(0xff8a3a, 0.7);
        g.fillCircle(p.x, p.y + dx * 0.5, 0.5 * s);
      }
      break;
    }
    case 10: {
      fill(0xd8c8ee, 0.4);
      g.fillTriangle(p.x, p.y - 1.1 * s, p.x + 1 * s, p.y + 0.7 * s, p.x - 1 * s, p.y + 0.7 * s);
      break;
    }
  }
}

interface RegionTextureOptions {
  discovered: Set<number>;
  toScreen: ToScreen;
  /** Size the marks are drawn at, in screen px per native px. */
  markScale: number;
  tint?: Tint;
  /**
   * Size and ink for one mark, where they are not the same across the land:
   * the overlook draws the country in perspective and hazes it by distance, so
   * both depend on where the mark stands. Overrides `markScale` and `tint`.
   */
  markAt?: (nx: number, ny: number) => { scale: number; tint: Tint };
}

// The surviving scatter, resolved once and replayed after that -- the same
// reasoning as `regionRuns` above, and for the same caller: the overlook is
// redrawn on every frame the camera moves, and 560 point-in-polygon tests plus
// 560 ten-way nearest-world scans is not something to pay for each time. Only
// the screen transform and the tint change between draws, and both are applied
// on replay.
//
// Each mark also carries the random draws its own shape consumed. The scatter
// is one deterministic stream, and a mark in an undiscovered region is skipped
// *before* it draws anything, so which values each surviving mark receives
// depends on which worlds are discovered -- hence a cache keyed on that, not a
// single list. A given viewer's discovery state does not change while they
// stand at the cliff, so the overlook hits one entry on every draw.
interface TextureMark {
  world: number;
  x: number;
  y: number;
  draws: number[];
}

const textureMarkCache = new Map<string, TextureMark[]>();

function drawRegionTextures(g: Phaser.GameObjects.Graphics, o: RegionTextureOptions) {
  const tint = o.tint ?? NO_TINT;
  const key = Array.from(o.discovered).sort((a, b) => a - b).join(',');
  const cached = textureMarkCache.get(key);
  if (cached) {
    for (const m of cached) {
      let i = 0;
      const at = o.markAt?.(m.x, m.y);
      drawTextureMark(g, m.world, o.toScreen(m.x, m.y), at?.scale ?? o.markScale, () => m.draws[i++] ?? 0, at?.tint ?? tint);
    }
    return;
  }

  // First pass for this discovery state: draw exactly as before, recording
  // each surviving mark and the values it took off the stream.
  const rand = seededRandom(hashSeed('qumatuomi-texture'));
  const marks: TextureMark[] = [];
  for (let i = 0; i < 560; i++) {
    const x = rand() * NATIVE_W;
    const y = rand() * NATIVE_H;
    if (!insideLand(x, y)) continue;
    const { w1, d1, d2 } = nearestTwoWorlds(x, y);
    if (d2 - d1 < 3) continue;
    if (!o.discovered.has(w1)) continue;
    const draws: number[] = [];
    const record = () => {
      const v = rand();
      draws.push(v);
      return v;
    };
    const at = o.markAt?.(x, y);
    drawTextureMark(g, w1, o.toScreen(x, y), at?.scale ?? o.markScale, record, at?.tint ?? tint);
    marks.push({ world: w1, x, y, draws });
  }
  textureMarkCache.set(key, marks);
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
      // The coast in miniature: a 2x2 checkerboard of two greys on the left,
      // the antiferromagnet's sublattices, and two swells on the right, one
      // red and one blue, the two signs of the spin a magnon carries.
      [0, 1].forEach((i) =>
        [0, 1].forEach((j) => {
          g.fillStyle((i + j) % 2 ? 0x30363e : 0x1f2429, 1);
          g.fillRect(p.x + (-5 + i * 2.4) * s, p.y + (-2.4 + j * 2.4) * s, 2.4 * s, 2.4 * s);
        })
      );
      [
        { y: -1.2, c: 0xc4483a },
        { y: 1.4, c: 0x3560c8 },
      ].forEach((w) => {
        g.lineStyle(Math.max(0.4, 0.7 * s), w.c, 0.9);
        g.beginPath();
        g.moveTo(p.x + 0.6 * s, p.y + w.y * s);
        g.lineTo(p.x + 2 * s, p.y + (w.y - 1) * s);
        g.lineTo(p.x + 3.4 * s, p.y + w.y * s);
        g.lineTo(p.x + 4.8 * s, p.y + (w.y - 1) * s);
        g.strokePath();
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
    paintRegions(regions, { discovered, toScreen, scale });
    if (MAP_STYLE === 'a') drawRegionTextures(regions, { discovered, toScreen, markScale: scale });
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
// Drawn as a thing that is actually there: a slab of country standing on the
// plane below the cliff, in the same perspective as the ground the player is
// standing on. The caller hands in where each row of the land lies on screen
// (`OverlookRow`), projected through the world's own camera, so the far coast
// is narrower than the near one, the land slides against the cliff edge as the
// player walks, and the edge can stand in front of it. Three things then make
// it an object rather than a picture of one: it has a side (the wall its coast
// drops down), it stands on something (the wall's reflection in the plane),
// and its far coast is further into the air than its near one.
//
// The land itself is the panel's: the same coastline, painted into the same
// ten regions with the same texture marks, so the country below is
// recognisably the map Bloch's panel shows -- that recognition is the point of
// the view. Markers and labels stay out of it. They belong to a panel, and
// what the player is offered here is the land (OverworldScene raises a prompt
// at the edge, the way it does beside a guardian).

export const QUMATUOMI_NATIVE_W = NATIVE_W;
export const QUMATUOMI_NATIVE_H = NATIVE_H;

// The land below is lit by nothing, so it lights itself: the panel's own land
// hue, held at a value that survives the atmosphere stacked over it. The light
// rule is what forces this rather than taste -- the record glows and nothing
// shines on it -- and legibility asks the same, since the whole point of the
// view is the player recognising the coastline they have been travelling.
// Lifted in its own green rather than toward white, which washes the land to
// the same grey as the air it is seen through and loses it.
const OVERLOOK_LAND = 0x6f9e72;
const OVERLOOK_SHORE = 0xe8f2e0;
// How far the land is carried into the live fog target at its near coast and
// at its far one. Enough that the far coast sits visibly deeper in the air
// than the near one -- an edge as crisp at the back as at the front is a decal.
const OVERLOOK_DROWN = 0.08;
const OVERLOOK_FAR_DROWN = 0.46;
// The painted regions, lifted toward the record's own self-lit green so ten
// terrain colours still read as one country glowing in the dark rather than as
// ten saturated swatches. The texture marks take the same transform, since
// they are the most saturated ink on the map.
const OVERLOOK_REGION_LIFT = 0.3;
// How far the land stands proud of the plane it lies on, in native map px. The
// wall is what gives the coast a side.
const OVERLOOK_RELIEF = 3.2;
// The wall is the land's own colour in its own shade: the top glows, the
// sides do not.
const OVERLOOK_WALL_SHADE = 0.66;
// What the plane shows of the land standing on it: the land's own light, lying
// in the plane under every stretch of coast and falling off with distance from
// it. Drawn as a stack of layers, each reaching a step further below the plane
// than the last, so what they add up to is a glow that is brightest against
// the foot of the wall and gone a few native px out. This is what puts a floor
// under the slab -- without it the wall ends in nothing and the land hangs.
const OVERLOOK_GLOW_REACH = 9;
const OVERLOOK_GLOW_LAYERS = 6;
const OVERLOOK_GLOW_ALPHA = 0.05;
// The route traced across it: a mark left on the land, kept well under the
// coastline so it reads as part of the record rather than as a line charted
// over it.
const OVERLOOK_ROUTE = 0xf0e4ff;
// Widths of the two lines drawn on the land -- its coast and the player's own
// route -- in native map px rather than screen px, so both thin as the country
// recedes. A line held at a fixed screen width is drawn on the glass rather
// than on the ground.
const OVERLOOK_SHORE_W = 0.8;
const OVERLOOK_ROUTE_W = 0.7;
const OVERLOOK_ROUTE_GLOW_W = 1.9;

/**
 * Where one east-west row of the land lies on screen: native point `(nx, ny)`
 * is drawn at `(x0 + nx * sx, y)`. A row of the map is a line of constant
 * depth, so it projects to a horizontal run at one scale -- `sx` screen px per
 * native px -- and the whole placement of a row is these three numbers.
 */
export interface OverlookRow {
  y: number;
  x0: number;
  sx: number;
}

export interface QumatuomiOverlookOptions {
  /**
   * The land's placement in the world. `ny` runs from the far coast (0) to the
   * near one (QUMATUOMI_NATIVE_H); `nz` is height above the plane the land
   * stands on, in native px, negative for the reflection below it.
   */
  row: (ny: number, nz: number) => OverlookRow;
  /** The live fog colour everything else in the frame is hazing toward. */
  target: number;
  /** Worlds the player has actually walked, in the order they walked them. */
  route: number[];
}

interface OverlookPoint {
  x: number;
  y: number;
  /** Screen px per native px where this point lies. */
  s: number;
  /** 0 at the far coast, 1 at the near one. */
  t: number;
}

function overlookPoint(o: QumatuomiOverlookOptions, nx: number, ny: number, nz: number): OverlookPoint {
  const r = o.row(ny, nz);
  return { x: r.x0 + nx * r.sx, y: r.y, s: r.sx, t: ny / NATIVE_H };
}

// How deep into the air a row of the land is: the far coast takes the most of
// the fog, the near one almost none.
function overlookDrown(ny: number): number {
  return OVERLOOK_DROWN + (OVERLOOK_FAR_DROWN - OVERLOOK_DROWN) * Math.pow(1 - ny / NATIVE_H, 1.3);
}

function fillQuad(g: Phaser.GameObjects.Graphics, a: OverlookPoint, b: OverlookPoint, c: OverlookPoint, d: OverlookPoint) {
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.lineTo(c.x, c.y);
  g.lineTo(d.x, d.y);
  g.closePath();
  g.fillPath();
}

// A polyline drawn one segment at a time, each at the width the land's own
// scale gives it there and dimmed by how far away that part of the land is.
// Phaser strokes a path at one width and one alpha, so a line lying on ground
// that recedes has to be broken up to recede with it.
function strokeReceding(g: Phaser.GameObjects.Graphics, pts: OverlookPoint[], color: number, widthNative: number, alpha: number) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const fade = 0.4 + 0.6 * ((a.t + b.t) / 2);
    g.lineStyle(Math.max(0.5, widthNative * ((a.s + b.s) / 2)), color, alpha * fade);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
}

// Every world at once is what the view is of, so nothing here is shrouded:
// the mist over an unvisited region is a state of the player's knowledge, and
// the country below the cliff is not.
const ALL_WORLDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

/**
 * Draws the land below the cliff and returns its coastline as drawn, top face,
 * in screen px -- the shape a caller hit-tests a pointer against.
 */
export function drawQumatuomiOverlook(g: Phaser.GameObjects.Graphics, o: QumatuomiOverlookOptions): { x: number; y: number }[] {
  const top = SILHOUETTE_POINTS.map(([x, y]) => overlookPoint(o, x, y, OVERLOOK_RELIEF));
  const base = SILHOUETTE_POINTS.map(([x, y]) => overlookPoint(o, x, y, 0));
  const n = SILHOUETTE_POINTS.length;
  const landAt = (ny: number) => blend(OVERLOOK_LAND, o.target, overlookDrown(ny));

  // Laid down first, so the wall and the land cover every part of the glow
  // that is not actually out in the open.
  for (let layer = OVERLOOK_GLOW_LAYERS; layer >= 1; layer--) {
    const reach = (OVERLOOK_GLOW_REACH * layer) / OVERLOOK_GLOW_LAYERS;
    const mirror = SILHOUETTE_POINTS.map(([x, y]) => overlookPoint(o, x, y, -reach));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ny = (SILHOUETTE_POINTS[i][1] + SILHOUETTE_POINTS[j][1]) / 2;
      g.fillStyle(landAt(ny), OVERLOOK_GLOW_ALPHA * (0.45 + 0.55 * (ny / NATIVE_H)));
      fillQuad(g, base[i], base[j], mirror[j], mirror[i]);
    }
  }
  // The wall the coast drops down, one face per stretch of coastline. Every
  // face is drawn, not only the ones turned toward the camera: the land's own
  // top goes over them next and hides the ones on its far side.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ny = (SILHOUETTE_POINTS[i][1] + SILHOUETTE_POINTS[j][1]) / 2;
    g.fillStyle(blend(landAt(ny), 0x000000, OVERLOOK_WALL_SHADE), 1);
    fillQuad(g, top[i], top[j], base[j], base[i]);
  }

  // A skerry is a disc lying on the same plane, so it is seen as an ellipse:
  // as wide as the land's scale at its row makes it and as tall as that row's
  // own foreshortening leaves it.
  const skerries = ARCHIPELAGO_ISLANDS.map((isl) => {
    const c = overlookPoint(o, isl.x, isl.y, OVERLOOK_RELIEF);
    const squash = Math.abs(o.row(isl.y + 1, OVERLOOK_RELIEF).y - c.y) / c.s;
    return { isl, c, squash, foot: overlookPoint(o, isl.x, isl.y, 0) };
  });
  skerries.forEach(({ isl, c, squash, foot }) => {
    g.fillStyle(blend(landAt(isl.y), 0x000000, OVERLOOK_WALL_SHADE), 1);
    g.fillEllipse(foot.x, foot.y, isl.r * 2 * c.s, isl.r * 2 * c.s * squash);
    g.fillRect(c.x - isl.r * c.s, c.y, isl.r * 2 * c.s, foot.y - c.y);
  });

  g.fillStyle(landAt(NATIVE_H * 0.6), 1);
  g.fillPoints(top, true);

  // The same ten painted regions the panel build draws, over the base land and
  // under the coastline, each row of them at its own place in the perspective.
  // Every colour is lifted into the record's own light and carried into the
  // live fog by how far away its row lies.
  const lifted: number[] = [];
  for (let w = 1; w <= 10; w++) lifted[w] = blend(regionColor(w), OVERLOOK_LAND, OVERLOOK_REGION_LIFT);
  const rows: OverlookRow[] = [];
  for (let ny = 0; ny <= NATIVE_H; ny += REGION_CELL) rows.push(o.row(ny, OVERLOOK_RELIEF));
  // Half a pixel of overlap on each run, so two neighbours meet rather than
  // leaving a hairline of the land fill between them.
  const bleed = 0.5;
  for (const run of regionRuns()) {
    const a = rows[run.y / REGION_CELL];
    const b = rows[run.y / REGION_CELL + 1];
    const drown = overlookDrown(run.y);
    const c1 = blend(lifted[run.w1], o.target, drown);
    g.fillStyle(run.mix > 0 ? blend(c1, blend(lifted[run.w2], o.target, drown), run.mix) : c1, 1);
    g.beginPath();
    g.moveTo(a.x0 + run.x * a.sx, a.y);
    g.lineTo(a.x0 + (run.x + run.w) * a.sx + bleed, a.y);
    g.lineTo(b.x0 + (run.x + run.w) * b.sx + bleed, b.y + bleed);
    g.lineTo(b.x0 + run.x * b.sx, b.y + bleed);
    g.closePath();
    g.fillPath();
  }
  skerries.forEach(({ isl, c, squash }) => {
    g.fillStyle(landAt(isl.y), 1);
    g.fillEllipse(c.x, c.y, isl.r * 2 * c.s, isl.r * 2 * c.s * squash);
    const { w1 } = nearestTwoWorlds(isl.x, isl.y);
    g.fillStyle(blend(lifted[w1], o.target, overlookDrown(isl.y)), 1);
    g.fillEllipse(c.x, c.y, Math.max(1, (isl.r - 0.6) * 2 * c.s), Math.max(1, (isl.r - 0.6) * 2 * c.s * squash));
  });
  drawRegionTextures(g, {
    discovered: ALL_WORLDS,
    toScreen: (nx, ny) => overlookPoint(o, nx, ny, OVERLOOK_RELIEF),
    markScale: 1,
    markAt: (_nx, ny) => {
      const drown = overlookDrown(ny);
      return { scale: o.row(ny, OVERLOOK_RELIEF).sx, tint: (c) => blend(blend(c, OVERLOOK_LAND, OVERLOOK_REGION_LIFT), o.target, drown) };
    },
  });

  // The coastline, self-luminous per the light rule: the record glows,
  // nothing shines on it. It is the rim of the slab's top face, and the line
  // the player recognises the map by.
  strokeReceding(g, top.concat(top[0]), blend(OVERLOOK_SHORE, o.target, OVERLOOK_DROWN), OVERLOOK_SHORE_W, 0.8);

  // *It has your whole walk.* The one thing no other copy of this map carries:
  // a dim luminous trace of the player's own route across it, world by world
  // in the order they were walked. No marker sits at either end of it; it is a
  // mark left on the land, not a pointer to anything.
  const legs = o.route.map((w) => WORLD_POSITIONS[w]).filter(Boolean);
  if (legs.length >= 2) {
    // Sampled along each leg rather than drawn corner to corner, so the trace
    // thins and dims as the land under it recedes.
    const trace: OverlookPoint[] = [];
    for (let i = 0; i < legs.length - 1; i++) {
      for (let k = 0; k < 6; k++) {
        const f = k / 6;
        trace.push(overlookPoint(o, legs[i].x + (legs[i + 1].x - legs[i].x) * f, legs[i].y + (legs[i + 1].y - legs[i].y) * f, OVERLOOK_RELIEF));
      }
    }
    trace.push(overlookPoint(o, legs[legs.length - 1].x, legs[legs.length - 1].y, OVERLOOK_RELIEF));
    strokeReceding(g, trace, OVERLOOK_ROUTE, OVERLOOK_ROUTE_GLOW_W, 0.1);
    strokeReceding(g, trace, OVERLOOK_ROUTE, OVERLOOK_ROUTE_W, 0.34);
  }

  return top;
}
