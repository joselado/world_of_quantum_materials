import Phaser from 'phaser';
import { getBiome } from './biomes';
import { blend, hashSeed, seededRandom } from './colors';
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
// is the panel one: markers, region tints, a container to click. `drawQumatuomiSky`
// is scenery -- World 10's horizon, drawn straight into a Graphics as a hazed
// reflection with every affordance stripped. Sharing the geometry is the point;
// sharing the markers would put an interface element in the sky.

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

  // Per-world region tint / shroud, drawn beneath the markers themselves.
  const regions = scene.add.graphics();
  container.add(regions);

  const markers: QumatuomiWorldMarker[] = [];

  for (let world = 1; world <= 10; world++) {
    const pos = WORLD_POSITIONS[world];
    const isDiscovered = discovered.has(world);
    const radiusNative = maxSafeRadius(pos.x, pos.y, 16);
    const p = toScreen(pos.x, pos.y);
    const radius = radiusNative * scale;

    if (isDiscovered) {
      const biome = getBiome(world);
      [1, 0.66, 0.36].forEach((f, i) => {
        const col = blend(biome.hillColor, biome.path, 1 - f);
        regions.fillStyle(col, 0.16 + i * 0.14);
        regions.fillCircle(p.x, p.y, radius * f);
      });
    } else {
      // Shrouded: a flat dim patch (same undiscovered grey the Materialdex
      // uses for an unmet compound) plus a few soft, deterministically
      // jittered mist puffs so it reads as fog rather than just "off."
      regions.fillStyle(UNDISCOVERED_FILL, 0.55);
      regions.fillCircle(p.x, p.y, radius);
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
// The Devouring Mirror's horizon (WORLDS.md section 4's "The Qumatuomi sky").
//
// Every other world's horizon is the world after it; the Mirror has none, so
// what hangs in its sky is *every* world at once, seen from outside and above
// -- which is precisely the view a trained model has of its training data.
// It can show the whole map because it has consumed all of it.
//
// Rendered as a reflection in a mirrored sky rather than an image pasted flat
// to the screen: foreshortened and tilted away, rippling faintly, silver-
// violet, self-luminous, and dimmed and hazed by the same atmosphere that fogs
// everything else. The haze is what does the work -- fog is the cheapest
// signal that something is scenery, and an interface element is never fogged.
// Rendered screen-parallel and unhazed this reads as a misrendered minimap and
// players try to click it. Every interactive affordance is stripped: no
// markers, no labels, no per-world region tints.

// The reflection's silver-violet, before the haze takes it.
const MIRROR_SILVER = 0xc9b6e8;
const MIRROR_ROUTE = 0xf0e4ff;
// How far the reflection is carried into the live fog target. Bounded from
// above by the light rule, not only by taste: the record glows and nothing
// shines on it, so the reflection has to stay *brighter* than the sky it
// hangs in. Drowned past that it inverts into a silhouette, which reads as a
// solid object rather than as light -- the opposite of a reflection. The
// depth gradient that keeps it hazed is the veil below, which fades its far
// edge without darkening the whole shape.
const MIRROR_DROWN = 0.34;
// The tilt. `v` runs 0 at the reflection's far edge to 1 at its near edge, and
// both the vertical spacing and the width follow the same power schedule, so
// the plane recedes as one piece instead of shearing.
const MIRROR_FORESHORTEN = 1.9;
// Half-width at the far edge as a fraction of the near edge's.
const MIRROR_FAR_NARROW = 0.46;
// The ripple: a mirrored sky is never still. Slow and shallow -- a shimmer
// this map can carry without becoming a flag.
const MIRROR_RIPPLE_PX = 2.4;
const MIRROR_RIPPLE_RATE = 0.00042;

export interface QumatuomiSkyOptions {
  /** Screen x the reflection is centred on. */
  cx: number;
  /** Screen y of the reflection's far edge (its top). */
  top: number;
  /** Screen y of its near edge (its bottom). */
  bottom: number;
  /** Half-width of the near edge, in px. */
  halfWidth: number;
  /** The live fog colour everything else in the frame is hazing toward. */
  target: number;
  /** The scene clock, which drives the ripple. */
  now: number;
  /** Worlds the player has actually walked, in the order they walked them. */
  route: number[];
}

// Projects a point in the map's own native space onto the tilted plane. The
// country's long axis stays horizontal and its short axis becomes depth, so
// the landmass lies flat in the sky and is read at a glancing angle.
function toMirror(nx: number, ny: number, o: QumatuomiSkyOptions): { x: number; y: number; t: number } {
  const u = nx / NATIVE_W - 0.5;
  const v = ny / NATIVE_H;
  const t = Math.pow(v, MIRROR_FORESHORTEN);
  const half = o.halfWidth * (MIRROR_FAR_NARROW + (1 - MIRROR_FAR_NARROW) * t);
  const ripple = Math.sin(v * 7.5 + o.now * MIRROR_RIPPLE_RATE) * MIRROR_RIPPLE_PX * (0.35 + 0.65 * t);
  return { x: o.cx + u * 2 * half + ripple, y: o.top + (o.bottom - o.top) * t, t };
}

// A polyline drawn one segment at a time, each segment's width and alpha
// scaled by how far away that part of the plane is. Phaser strokes a path at
// one width and one alpha, so a line crossing a receding plane has to be
// broken up to recede with it -- and a line that does not is the single thing
// that collapses this whole treatment back into a flat decal with a stroke on
// it. `t` is 0 at the far edge and 1 at the near one.
function strokeReceding(
  g: Phaser.GameObjects.Graphics,
  pts: { x: number; y: number; t: number }[],
  color: number,
  width: number,
  alpha: number
) {
  for (let i = 0; i < pts.length - 1; i++) {
    const t = (pts[i].t + pts[i + 1].t) / 2;
    const fade = 0.08 + 0.92 * t;
    g.lineStyle(Math.max(0.4, width * fade), color, alpha * fade);
    g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  }
}

export function drawQumatuomiSky(g: Phaser.GameObjects.Graphics, o: QumatuomiSkyOptions) {
  const land = blend(MIRROR_SILVER, o.target, MIRROR_DROWN);
  const shore = blend(MIRROR_SILVER, o.target, MIRROR_DROWN * 0.55);

  const outline = SILHOUETTE_POINTS.map(([x, y]) => toMirror(x, y, o));
  g.fillStyle(land, 0.5);
  g.fillPoints(outline, true);
  // A brighter coastline, self-luminous per the light rule: the record glows,
  // nothing shines on it. It is what makes the shape read as a coastline
  // rather than as a torn patch of cloud, so it carries more of the value
  // budget than the fill it encloses -- but it recedes with the plane it is
  // drawn on, thinning and dimming toward the far edge.
  strokeReceding(g, outline.concat(outline[0]), shore, 2.1, 0.95);

  ARCHIPELAGO_ISLANDS.forEach((isl) => {
    const p = toMirror(isl.x, isl.y, o);
    // Radius follows the same foreshortening the plane does, so a skerry near
    // the far edge is smaller as well as fainter.
    g.fillStyle(land, 0.62 * (0.3 + 0.7 * p.t));
    g.fillCircle(p.x, p.y, Math.max(0.6, isl.r * 0.42 * (MIRROR_FAR_NARROW + (1 - MIRROR_FAR_NARROW) * p.t)));
  });

  // The atmosphere over the plane, thickening toward its far edge. This is the
  // load-bearing part: fog is the cheapest signal that something is scenery,
  // and a shape whose far edge is exactly as crisp as its near edge is a decal
  // pasted on the sky however carefully its geometry recedes. Painted as
  // abutting rows so no two of them share a scanline and double-blend.
// Painted the full width of the frame rather than to the reflection's own
  // bounds: a veil with vertical edges of its own would draw two lines down the
  // sky, which is a box around the thing it exists to dissolve.
  const veilRows = 24;
  const veilH = o.bottom - o.top + 8;
  for (let i = 0; i < veilRows; i++) {
    const t = i / veilRows;
    g.fillStyle(o.target, 0.46 * Math.pow(1 - t, 1.6));
    g.fillRect(0, o.top - 6 + t * veilH, CANVAS_W, veilH / veilRows + 1);
  }

  // *It has your whole walk.* The one thing no other copy of this map carries:
  // a dim luminous trace of the player's own route across it, world by world
  // in the order they were walked. Drawn over the landmass and nothing else --
  // no marker sits at either end of it, because a marker is an affordance and
  // this is a record.
  if (o.route.length < 2) return;
  // Subdivided rather than drawn corner to corner: the world positions are a
  // coarse zigzag, and a rigid straight run between two of them across a
  // receding plane is the shape of a chart line. Sampling along each leg lets
  // the trace thin and dim as it goes, which is what makes it a mark left on
  // the map rather than a stroke drawn over it.
  const legs = o.route.map((w) => WORLD_POSITIONS[w]).filter(Boolean);
  if (legs.length < 2) return;
  const trace: { x: number; y: number; t: number }[] = [];
  for (let i = 0; i < legs.length - 1; i++) {
    for (let k = 0; k < 6; k++) {
      const f = k / 6;
      trace.push(toMirror(legs[i].x + (legs[i + 1].x - legs[i].x) * f, legs[i].y + (legs[i + 1].y - legs[i].y) * f, o));
    }
  }
  trace.push(toMirror(legs[legs.length - 1].x, legs[legs.length - 1].y, o));
  strokeReceding(g, trace, blend(MIRROR_ROUTE, o.target, MIRROR_DROWN * 0.2), 3.5, 0.26);
  strokeReceding(g, trace, MIRROR_ROUTE, 1.6, 0.6);
}
