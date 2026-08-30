import Phaser from 'phaser';
import { blend } from '../../../art/colors';
import type { Biome } from '../../../art/biomes';
import { MAX_OFFSET } from '../../../art/contours';
import type { ContourPoint, TileContour } from '../../../art/contours';
import type { ProjectedPoint } from '../../../art/perspective';
import { CAMERA_BACK_TILES, DRAW_DISTANCE_TILES, gridH, gridW, laneClipAt, projectTile } from '../projection';
import { drawDepthHaze, hazeTarget } from '../sky';
import { groundColor } from './color';
import { GROUND_MOTIFS_ENABLED, decorateTile } from './decoration';
import { fillPolygon } from '../../../art/shapes';
import { TERRAIN_ACCENTS } from './materials';
import { drawStormStrikes } from './materials/charged';
import { offPathKindOf } from './plan';
import type { AccentTile, TerrainKind, TerrainTile, TerrainView } from './types';

// Thinnest projected row still worth painting, in screen pixels. The
// projection is asymptotic, so rows keep compressing toward the horizon long
// after they stop being resolvable; below a pixel they only alias and crawl
// as the camera moves, and the horizon band covers that strip instead.
const MIN_ROW_PX = 1;
// Contact-shadow strength per band, darkest first (art/contours.ts's
// FLOOR_SHADOW_BANDS / SOLID_SHADOW_BANDS), and the depth past which the
// junction is too small on screen to be worth the extra fills.
const CONTACT_SHADOW_ALPHA = [0.24, 0.12];
const CONTACT_SHADOW_MAX_DEPTH = 0.7;
// The lit lip along the walkable side of the same boundary -- a pale edge
// against the darker mass beyond it, which also keeps the walkable region's
// own shape readable further into the distance than its fill alone would.
const CONTOUR_RIM_ALPHA = 0.3;
// Depth past which the detail passes (tile decoration, terrain accents) stop:
// distant tiles stay a cheap flat fill rather than paying the animated-detail
// cost for the couple hundred off-path tiles a single frame can contain.
const DETAIL_MAX_DEPTH = 0.75;

// Projects and paints the visible slice of the terrain plan every frame
// from the current (possibly mid-tween) camera position -- what makes the
// world scroll continuously rather than snapping tile-by-tile. Only the
// projection, the depth-based fog/detail falloff, and the animated
// (time-driven) accents are computed here; everything that depends on the
// grid rather than the camera comes precomputed in the plan (plan.ts).
export function drawTerrain(view: TerrainView) {
  const g = view.gfx;
  g.clear();
  // The camera has moved since the last frame, so no row's cached colors
  // survive into this one.
  rowGroundRow = NaN;

  const { tiles, farEdgeRow, contours } = view.plan;
  const camX = view.camX;
  const camY = view.camY;
  // The deepest row drawn at all: where the depth fog saturates
  // (depthRatio 1), which is the same bound the depth margin runs to.
  const deepestRow = Math.floor(camY - DRAW_DISTANCE_TILES);
  const minY = Math.max(farEdgeRow, deepestRow);
  // Rows behind the player are still in frame -- the camera stands
  // CAMERA_BACK_TILES behind the player's tile, so the ground the player
  // has already walked over is what fills the bottom of the screen. The
  // per-tile near-plane test below is what actually stops the sweep.
  const maxY = Math.min(gridH() - 1, Math.floor(camY) + 2);
  const cols = gridW();

  // Farthest first, so every nearer row paints over it.
  drawMarginRows(view, deepestRow);

  for (let y = minY; y <= maxY; y++) {
    drawMarginColumns(view, tiles[y], y);
    const laneClip = laneClipAt(camY - y + 0.5);
    // A tile's right lane is the next tile's left lane exactly -- both are
    // `x - camX + 0.5` -- and both sit at this row's two depths, so the pair
    // of points projected for one column's right edge is the pair the next
    // column needs for its left edge. Carried across only while the columns
    // are genuinely adjacent: either clip test below can skip a column, and a
    // carry across a gap would place the tile at its neighbour's edge.
    let carryCol = -2;
    let carryF: ProjectedPoint | null = null;
    let carryN: ProjectedPoint | null = null;
    for (let x = 0; x < cols; x++) {
      const laneL = x - camX - 0.5;
      const laneR = x - camX + 0.5;
      if (laneL > laneClip || laneR < -laneClip) continue;

      const depthFar = camY - y + 0.5;
      const depthNear = camY - y - 0.5;
      if (depthFar + CAMERA_BACK_TILES <= 0) continue;

      const adjacent = carryCol === x - 1 && carryF !== null && carryN !== null;
      const pFL = adjacent ? carryF! : projectTile(laneL, depthFar);
      const pNL = adjacent ? carryN! : projectTile(laneL, depthNear);
      const pFR = projectTile(laneR, depthFar);
      const pNR = projectTile(laneR, depthNear);
      carryCol = x;
      carryF = pFR;
      carryN = pNR;

      const depthRatio = Phaser.Math.Clamp(depthFar / DRAW_DISTANCE_TILES, 0, 1);
      const tile = tiles[y][x];
      const contour = contours[y]?.[x] ?? null;
      const fill = contour ? projectContour(contour.outline, camX, camY) : [pFL, pFR, pNR, pNL];

      if (tile.kind === 'path') {
        const rg = rowGround(view, tile.biome, y, depthRatio);
        let color = rg.path;
        if (tile.regionTint != null) color = blend(color, tile.regionTint, regionTintAt(depthRatio, 0.55));
        color = seamed(view, color, y);
        g.fillStyle(color, 1);
        fillPolygon(g, fill);
        drawBandBoundary(g, tile.biome, y, pFL, pFR, pNR, pNL, depthRatio);
        if (contour) drawContactShadow(g, contour, tile.biome, camX, camY, depthRatio);
        if (GROUND_MOTIFS_ENABLED && depthRatio < DETAIL_MAX_DEPTH && tile.decorate) {
          decorateTile(g, view.biome, accentTile(false, fill, pFL, pFR, pNR, pNL, x, y, depthRatio, rg.haze, view.playerColor, view.now, tile.regionTint));
        }
        if (tile.midHighlight) {
          // The glow falls off radially from the guardian's own tile, so the
          // gate reads as a pool of light: at a uniform alpha the same nine
          // tiles read as a hard rectangle laid over a floor whose every
          // other edge curves.
          const spread = Math.hypot(x - view.midTile.x, y - view.midTile.y);
          drawMidHighlight(g, view, fill, depthRatio, 1 - 0.45 * spread);
        }
      } else {
        drawOffPathTile(view, tile, fill, contour, pFL, pFR, pNR, pNL, x, y, depthRatio);
      }
    }
  }
  drawDepthHaze(g, view);
  // The Storm Flats' strikes cross the air as well as the ground, so they are
  // drawn over the atmosphere rather than as a per-tile accent inside it --
  // a bolt painted under the haze is a bolt the haze puts out.
  if (view.biome.wallTheme === 'charged') drawStormStrikes(g, view);
}

// Projects a cached tile-space outline (art/contours.ts) at the current
// camera position. Each call allocates its own array: Phaser's Graphics is
// retained-mode, so the points handed to fillPoints are read again at flush
// time and cannot be reused across draw calls within a frame.
function projectContour(points: ContourPoint[], camX: number, camY: number): ProjectedPoint[] {
  const out: ProjectedPoint[] = [];
  for (const p of points) out.push(projectTile(p.x - camX, camY - p.y));
  return out;
}

// Columns just past the grid's left/right edges, drawn wherever the camera
// stands close enough to an edge that the lane window reaches past it.
// Each one continues its row's edge tile -- same biome, same region tint,
// same terrain accent -- but always as impassable ground (an edge tile
// that is walkable floor continues as its biome's off-path terrain, never
// as more floor), so the world runs to the frame edge instead of stopping
// on a stair-stepped strip of bare backdrop. Drawn before the row's real
// tiles: the innermost margin column is widened by MAX_OFFSET under an
// adjacent walkable tile so the boundary curve's vacated sliver is covered
// in ground color, and the real fills then paint over the rest of the
// overlap. No contour/contact-shadow work happens out here -- the real
// grid-edge boundary is already part of the traced contour (the trace
// treats out-of-grid as impassable), so the floor side keeps its usual
// curve, shadow and rim.
// `row` supplies the terrain and `y` the depth, which the depth margin
// (drawMarginRows) separates: its rows lie past the grid's far edge and
// take their terrain from the far edge row.
function drawMarginColumns(view: TerrainView, row: TerrainTile[], y: number) {
  const depthFar = view.camY - y + 0.5;
  if (depthFar + CAMERA_BACK_TILES <= 0) return;
  const laneClip = laneClipAt(depthFar);
  for (let gx = Math.floor(view.camX - laneClip); gx < 0; gx++) {
    drawMarginTile(view, row[0], gx, y, gx === -1);
  }
  const rightEnd = Math.ceil(view.camX + laneClip);
  const cols = gridW();
  for (let gx = cols; gx <= rightEnd; gx++) {
    drawMarginTile(view, row[cols - 1], gx, y, gx === cols);
  }
}

// Rows past the grid's far edge, drawn wherever the camera stands close
// enough to that edge that the draw distance reaches beyond it -- the depth
// counterpart of drawMarginColumns, so the ground plane runs to the horizon
// instead of terminating on a strip of bare backdrop. Each one repeats the
// far edge row (plan.ts's findFarEdgeRow) whole, terrain kind included, so
// the walkable path repeats with it and the road continues past the world's
// own end; the haze is what ends it. Two bounds keep that honest: the sweep
// stops where the depth fog saturates (`deepestRow`, the same bound the
// real rows use, beyond which nothing is distinguishable anyway and the
// horizon band takes over), and it stops early on any row whose projected
// thickness has fallen under a pixel, which would alias and crawl as the
// camera moves. No contour, contact shadow or decoration out here: the far
// edge row's own contour already runs unbroken into these rows (see
// plan.ts's depthContinuedWalkable), and every repeat is far enough out that
// the detail passes are already faded off.
//
// The repeated road runs only while the way is actually open. The far edge
// row *is* the pass throat, so repeating it repeats the pass -- a road
// running on to the horizon through a gate whose guard is still standing in
// it. While the rival lives the repeats take the surround's terrain instead,
// and the road ends where the guard does.
function drawMarginRows(view: TerrainView, deepestRow: number) {
  // A world that ends at a cliff has nothing past its last row: no repeated
  // road, no repeated surround, no ground at all. What fills the gap instead
  // is the drop and the map lying below it (sky.ts's drawOverlook), and the
  // gap has to actually be empty for there to be anything to fill.
  if (view.overlook) return;
  const g = view.gfx;
  const camX = view.camX;
  const camY = view.camY;
  const edge = view.plan.tiles[view.plan.farEdgeRow];
  const roadRunsOn = !view.gate || view.gate.open;
  const cols = gridW();
  for (let gy = view.plan.farEdgeRow - 1; gy >= deepestRow; gy--) {
    const depthFar = camY - gy + 0.5;
    const depthNear = camY - gy - 0.5;
    if (projectTile(0, depthNear).y - projectTile(0, depthFar).y < MIN_ROW_PX) break;

    drawMarginColumns(view, edge, gy);
    const depthRatio = Phaser.Math.Clamp(depthFar / DRAW_DISTANCE_TILES, 0, 1);
    const laneClip = laneClipAt(depthFar);
    // Same shared-edge carry as the main sweep above.
    let carryCol = -2;
    let carryF: ProjectedPoint | null = null;
    let carryN: ProjectedPoint | null = null;
    for (let x = 0; x < cols; x++) {
      const laneL = x - camX - 0.5;
      const laneR = x - camX + 0.5;
      if (laneL > laneClip || laneR < -laneClip) continue;

      const adjacent = carryCol === x - 1 && carryF !== null && carryN !== null;
      const pFL = adjacent ? carryF! : projectTile(laneL, depthFar);
      const pNL = adjacent ? carryN! : projectTile(laneL, depthNear);
      const pFR = projectTile(laneR, depthFar);
      const pNR = projectTile(laneR, depthNear);
      carryCol = x;
      carryF = pFR;
      carryN = pNR;
      const fill = [pFL, pFR, pNR, pNL];
      const tile = edge[x];

      if (tile.kind === 'path' && roadRunsOn) {
        let color = rowGround(view, tile.biome, gy, depthRatio).path;
        if (tile.regionTint != null) color = blend(color, tile.regionTint, regionTintAt(depthRatio, 0.55));
        g.fillStyle(color, 1);
        fillPolygon(g, fill);
      } else if (tile.kind === 'path') {
        g.fillStyle(offPathColor(view, tile.biome, tile.regionTint, gy, depthRatio), 1);
        fillPolygon(g, fill);
      } else {
        drawOffPathTile(view, tile, fill, null, pFL, pFR, pNR, pNL, x, gy, depthRatio);
      }
    }
  }
}

function drawMarginTile(view: TerrainView, edge: TerrainTile, gx: number, y: number, innermost: boolean) {
  const g = view.gfx;
  const camX = view.camX;
  const camY = view.camY;
  let laneL = gx - camX - 0.5;
  let laneR = gx - camX + 0.5;
  const laneClip = laneClipAt(camY - y + 0.5);
  if (laneL > laneClip || laneR < -laneClip) return;
  if (innermost && edge.kind === 'path') {
    if (gx < 0) laneR += MAX_OFFSET;
    else laneL -= MAX_OFFSET;
  }

  const depthFar = camY - y + 0.5;
  const depthNear = camY - y - 0.5;
  const depthRatio = Phaser.Math.Clamp(depthFar / DRAW_DISTANCE_TILES, 0, 1);
  const pFL = projectTile(laneL, depthFar);
  const pFR = projectTile(laneR, depthFar);
  const pNR = projectTile(laneR, depthNear);
  const pNL = projectTile(laneL, depthNear);
  const fill = [pFL, pFR, pNR, pNL];

  g.fillStyle(offPathColor(view, edge.biome, edge.regionTint, y, depthRatio), 1);
  fillPolygon(g, fill);

  if (depthRatio <= DETAIL_MAX_DEPTH) {
    const kind = edge.kind !== 'path' ? edge.kind : offPathKindOf(edge.biome);
    drawAccent(g, kind, fill, pFL, pFR, pNR, pNL, gx, y, edge.featureCore, depthRatio, rowGround(view, edge.biome, y, depthRatio).haze, view.playerColor, view.now, edge.regionTint);
  }
}

// A soft ambient-occlusion band hugging the walkable/impassable boundary,
// drawn over the ground fill from both sides of the junction, so the floor
// reads as tucking under the terrain beyond it rather than butting flat
// against it. With no per-tile seam stroke, this and the rim light are what
// mark the boundary, so a run of same-kind tiles reads as one continuous
// region while the edge between regions stays sharp.
function drawContactShadow(
  g: Phaser.GameObjects.Graphics,
  contour: TileContour,
  biome: Biome,
  camX: number,
  camY: number,
  depthRatio: number
) {
  if (depthRatio > CONTACT_SHADOW_MAX_DEPTH) return;
  const fade = 1 - depthRatio / CONTACT_SHADOW_MAX_DEPTH;
  for (const strip of contour.shadow) {
    g.fillStyle(0x000000, (CONTACT_SHADOW_ALPHA[strip.band] ?? 0) * fade);
    fillPolygon(g, projectContour(strip.points, camX, camY));
  }
  if (contour.rim.length === 0) return;
  g.lineStyle(1.5, blend(biome.path, 0xffffff, 0.45), CONTOUR_RIM_ALPHA * fade);
  for (const lip of contour.rim) g.strokePoints(projectContour(lip, camX, camY), false);
}

// How many rows of walkable ground the next world's own floor colour bleeds
// back across, once the pass is open -- the seam the player visibly steps
// over on the way out (WORLDS.md section 4). Short enough to be a threshold
// rather than a gradient across the last stretch of corridor.
const SEAM_ROWS = 3;
const SEAM_STRENGTH = 0.45;

// The ground seam: a short apron of the next world's own floor colour across
// the throat row and the two south of it, strongest at the throat. Short and
// square to the direction of travel on purpose -- a threshold is something
// the player takes in one step, where a long gradient is indistinguishable
// from distance haze and a recolour of the whole far corridor reads as a
// terrain error. Nothing at all while the gate is shut.
function seamed(view: TerrainView, color: number, gy: number): number {
  const gate = view.gate;
  if (!gate?.open || !gate.next) return color;
  const rows = gy - gate.row;
  if (rows < 0 || rows >= SEAM_ROWS) return color;
  return blend(color, gate.next.path, SEAM_STRENGTH * (1 - rows / SEAM_ROWS));
}

// Distant walkable ground hazes toward a lighter target than its
// surroundings do, so the route the player is planning stays readable far
// into the distance -- letting floor and off-path converge on one haze color
// erases the boundary at exactly the range it is being read from. The
// lightening is itself faded out over the last of the draw distance, on a
// curve flat enough to hold the route to nearly the end: every fill has to
// arrive at the same haze color on the deepest row drawn, or the repeated
// road (drawMarginRows) surfaces as a bright stub against the horizon band.
function walkableHazeTarget(view: TerrainView, biome: Biome, depthRatio: number): number {
  return blend(hazeTarget(view, biome), biome.path, 0.35 * (1 - Math.pow(depthRatio, 3)));
}

// The guardian chokepoint (invariant B, world/mapgen.ts's forceChokepoint)
// gets its own floor treatment -- a soft pulsing glow over the same path
// fill, in that world's own guardian color (the same per-guardian color
// coding every panel/pill already uses) -- covering `midTile` and its
// immediate neighbors so the forced pinch reads as a deliberate gate the
// player is walking through, not an arbitrary narrow spot.
function drawMidHighlight(
  g: Phaser.GameObjects.Graphics,
  view: TerrainView,
  fill: ProjectedPoint[],
  depthRatio: number,
  falloff: number
) {
  if (depthRatio > 0.9) return;
  const pulse = 0.5 + 0.5 * Math.sin(view.now / 320);
  g.fillStyle(view.chokepointColor, 0.28 * pulse * (1 - depthRatio) * falloff);
  fillPolygon(g, fill);
}

// Paints one impassable tile. Every off-path tile is flat ground in that
// biome's own off-path color, sitting in the same plane as the walkable
// floor; what its material decides (through the terrain kind resolved in
// plan.ts) is only the accent laid over that fill, so each world's
// impassable terrain still reads as its own material. The "you cannot walk
// here" read comes from the color break plus the contact shadow and rim light
// at the boundary, which every material gets alike. A region-tinted tile
// resolves to 'solid' and so keeps its domain color clean of any accent.
function drawOffPathTile(
  view: TerrainView,
  tile: TerrainTile,
  fill: ProjectedPoint[],
  contour: TileContour | null,
  pFL: ProjectedPoint,
  pFR: ProjectedPoint,
  pNR: ProjectedPoint,
  pNL: ProjectedPoint,
  gx: number,
  gy: number,
  depthRatio: number
) {
  const g = view.gfx;
  g.fillStyle(offPathColor(view, tile.biome, tile.regionTint, gy, depthRatio), 1);
  fillPolygon(g, fill);

  drawBandBoundary(g, tile.biome, gy, pFL, pFR, pNR, pNL, depthRatio);

  if (depthRatio <= DETAIL_MAX_DEPTH) {
    drawAccent(g, tile.kind, fill, pFL, pFR, pNR, pNL, gx, gy, tile.featureCore, depthRatio, rowGround(view, tile.biome, gy, depthRatio).haze, view.playerColor, view.now, tile.regionTint);
  }

  // The impassable side of the contact shadow, over the accent rather than
  // under it, so the junction is shaded from both sides no matter which
  // material this tile draws.
  if (contour) drawContactShadow(g, contour, tile.biome, view.camX, view.camY, depthRatio);
}

// Hands one tile to its off-path material's own module (materials/). The
// per-tile geometry every accent works from is derived here, once, and only
// for a material that actually draws something.
function drawAccent(
  g: Phaser.GameObjects.Graphics,
  kind: TerrainKind,
  fill: ProjectedPoint[],
  pFL: ProjectedPoint,
  pFR: ProjectedPoint,
  pNR: ProjectedPoint,
  pNL: ProjectedPoint,
  gx: number,
  gy: number,
  featureCore: boolean,
  depth: number,
  haze: number,
  playerColor: number,
  now: number,
  regionTint: number | null
) {
  if (kind === 'path') return;
  const accent = TERRAIN_ACCENTS[kind];
  if (!accent) return;
  accent(g, accentTile(featureCore, fill, pFL, pFR, pNR, pNL, gx, gy, depth, haze, playerColor, now, regionTint));
}

// The per-tile geometry every accent and every decoration works from: the
// projected outline for a full-tile wash, the tile's centre and depth scale
// on screen, where it sits on the grid, and the clock.
function accentTile(
  featureCore: boolean,
  fill: ProjectedPoint[],
  pFL: ProjectedPoint,
  pFR: ProjectedPoint,
  pNR: ProjectedPoint,
  pNL: ProjectedPoint,
  gx: number,
  gy: number,
  depth: number,
  haze: number,
  playerColor: number,
  now: number,
  regionTint: number | null
): AccentTile {
  return {
    featureCore,
    fill,
    cx: (pFL.x + pFR.x + pNR.x + pNL.x) / 4,
    cy: (pFL.y + pFR.y + pNR.y + pNL.y) / 4,
    s: pNL.scale,
    gx,
    gy,
    depth,
    haze,
    detail: detailFade(depth),
    playerColor,
    now,
    regionTint,
  };
}

// The detail pass fades over its last stretch rather than stopping dead, so
// no material ends on a line drawn across the middle distance.
const DETAIL_FADE_FROM = DETAIL_MAX_DEPTH * 0.62;

function detailFade(depth: number): number {
  return Phaser.Math.Clamp((DETAIL_MAX_DEPTH - depth) / (DETAIL_MAX_DEPTH - DETAIL_FADE_FROM), 0, 1);
}

// Ground colors memoized per row. Everything feeding a tile's base color is
// fixed across one grid row except the tile's own biome: the row index picks
// the band step, and the row index plus the camera fix the depth, so the
// depth fog, the haze target and the walkable haze lightening are all
// constant along the row. Only the region tint and the gate seam are genuinely
// per-tile, and both are applied by the caller on top of what is cached here.
//
// A row spans one or two biomes in practice, so a short linear scan is
// cheaper than hashing, and entries are rewritten in place rather than
// reallocated. The row sweep is strictly row-major (drawMarginRows, then the
// main sweep, each doing its margin columns and its own tiles at one row
// index), so a single row's worth of entries is all that ever needs to be
// live. Keyed on the row index and reset at the top of every frame, because
// the camera moves between frames and the same row index then sits at a
// different depth.
interface RowGround {
  biome: Biome;
  haze: number;
  path: number;
  ground: number;
}

const rowGroundCache: RowGround[] = [];
let rowGroundCount = 0;
let rowGroundRow = NaN;

function rowGround(view: TerrainView, biome: Biome, gy: number, depthRatio: number): RowGround {
  if (gy !== rowGroundRow) {
    rowGroundRow = gy;
    rowGroundCount = 0;
  }
  for (let i = 0; i < rowGroundCount; i++) {
    if (rowGroundCache[i].biome === biome) return rowGroundCache[i];
  }
  let entry = rowGroundCache[rowGroundCount];
  if (!entry) {
    entry = { biome, haze: 0, path: 0, ground: 0 };
    rowGroundCache[rowGroundCount] = entry;
  }
  entry.biome = biome;
  entry.haze = hazeTarget(view, biome);
  entry.path = groundColor(bandBase(biome, biome.path, gy), depthRatio, walkableHazeTarget(view, biome, depthRatio));
  entry.ground = groundColor(bandBase(biome, biome.ground, gy), depthRatio, entry.haze);
  rowGroundCount++;
  return entry;
}

// The flat fill color of an impassable tile: the biome's own off-path
// ground, stepped onto its band where the biome has bands, hazed for depth,
// and tinted toward a mapgen domain's color where the tile belongs to one.
function offPathColor(view: TerrainView, biome: Biome, regionTint: number | null, gy: number, depthRatio: number): number {
  const base = rowGround(view, biome, gy, depthRatio).ground;
  return regionTint != null ? blend(base, regionTint, regionTintAt(depthRatio, 0.6)) : base;
}

// Which step of the flat-band ramp a row sits on. Applied to walkable and
// impassable ground alike: the bands are a property of the world, not of the
// route through it, so a band that stopped at the corridor's edge would read
// as paint on the road rather than as the ground being stratified.
// The row index is a true modulo, not a remainder. The depth margin
// (drawMarginRows) continues the ground past the grid's far edge on negative
// row numbers, and a remainder there would run the ramp backwards past its
// own base -- which does not merely look wrong, it leaves the blend
// extrapolating outside 0-255 and overflowing one channel into the next.
function bandBase(biome: Biome, base: number, gy: number): number {
  const ramp = biome.bands;
  if (!ramp) return base;
  const step = ((Math.floor(gy / ramp.period) % ramp.steps) + ramp.steps) % ramp.steps;
  return blend(base, ramp.color, step / (ramp.steps - 1));
}

// The boundary between two bands: a glowing channel along it, and a soft dark
// strip on the band's lower side. The channel is the subject -- edge channels
// live between filled Landau levels -- and the strip is what keeps a stack of
// flat fills reading as material rather than as a bar chart. Neither claims
// any elevation; both are lighting on a plane.
const BAND_CHANNEL_ALPHA = 0.8;
const BAND_STRIP_ALPHA = 0.38;

function drawBandBoundary(
  g: Phaser.GameObjects.Graphics,
  biome: Biome,
  gy: number,
  pFL: ProjectedPoint,
  pFR: ProjectedPoint,
  pNR: ProjectedPoint,
  pNL: ProjectedPoint,
  depthRatio: number
) {
  const ramp = biome.bands;
  if (!ramp || ((gy % ramp.period) + ramp.period) % ramp.period !== 0 || depthRatio > DETAIL_MAX_DEPTH) return;
  const fade = 1 - depthRatio / DETAIL_MAX_DEPTH;

  g.fillStyle(0x000000, BAND_STRIP_ALPHA * fade);
  fillPolygon(g, [
    { x: pNL.x, y: pNL.y },
    { x: pNR.x, y: pNR.y },
    { x: pNR.x + (pFR.x - pNR.x) * 0.4, y: pNR.y + (pFR.y - pNR.y) * 0.4 },
    { x: pNL.x + (pFL.x - pNL.x) * 0.4, y: pNL.y + (pFL.y - pNL.y) * 0.4 },
  ]);

  g.lineStyle(1.5, ramp.channel, BAND_CHANNEL_ALPHA * fade);
  g.lineBetween(pNL.x, pNL.y, pNR.x, pNR.y);
}

// A mapgen domain tint drowns with everything else. The tint is mixed over
// ground that has already been hazed, so a fixed strength would carry a raw
// saturated hue all the way to the deepest row and stand the world's own
// palette straight up against the mist -- undoing, for exactly the worlds
// that use domains (world 1's branches, world 3's Voronoi cells), the
// arrival at the haze color the depth fog is built to guarantee. The curve
// is flat until late so a domain keeps its full strength across the range it
// is actually read at.
function regionTintAt(depthRatio: number, strength: number): number {
  return strength * (1 - Math.pow(depthRatio, 3));
}
