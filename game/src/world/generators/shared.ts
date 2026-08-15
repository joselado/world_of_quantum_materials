// Shared plumbing every per-world map generator (world1.ts .. world10.ts,
// fallback.ts) builds on: grid helpers, a generic wandering-band painter
// (the "corridor that drifts left/right" shape several worlds start from,
// just at whatever width that world's own generator asks for), and the
// post-generation passes mapgen.ts's generateWorldMap runs uniformly on
// every world's output -- forcing the guardian chokepoint (invariant B),
// deriving encounter rows, and scattering qumatessence tokens -- so an
// individual generator only has to produce a walkable shape plus a `mid`
// point roughly on its own spine, not prove connectivity or place rewards
// itself.
//
// Deliberately Math.random()-only, no Phaser import -- keeps this testable
// from a plain Node script (game/scripts/mapgen-check.mjs) the same way
// data/tokens.ts (which this module also imports) already is.

import { pickTokenValue } from '../../data/tokens';
import { BASE_GRID_H } from '../../data/settings';

export interface GridPoint {
  x: number;
  y: number;
}

// The one multiplicative factor the Lab's Settings station's world-size knob
// (data/settings.ts's WORLD_SIZE_PRESETS) turns into an actual map: every
// length a generator is written in -- corridor widths, branch lengths, spiral
// radii, the number of rows a stretch runs for -- goes through `tiles()`
// before it reaches the grid, so a world keeps its shape at every size and
// changes only how big it is.
//
// Two kinds of number deliberately do NOT go through it:
//
//  - Anything that is a *count* rather than a length (how many Voronoi
//    domains, how many defect patches, how many vortices). A count held fixed
//    while the lengths grow is what makes the bigger world the same picture
//    rather than a busier one.
//  - A periodic motif's own period: World 2's unit cell and World 6's magnon
//    wavelength are physical lengths of the material, not of the map, so a
//    bigger crystal is more unit cells at the same lattice constant, not a
//    stretched one.
export interface WorldScale {
  factor: number;
  // A length in tiles, scaled and rounded, never below `min` -- which
  // defaults to the 2-tile floor invariant A puts under every walkable
  // segment (DESIGN.md §2), since a width is the common case and a width
  // scaled below 2 is a corridor a single spawn can cork.
  tiles(n: number, min?: number): number;
}

export const MIN_SEGMENT_WIDTH = 2;

export function worldScale(factor: number): WorldScale {
  return {
    factor,
    tiles: (n: number, min: number = MIN_SEGMENT_WIDTH) => Math.max(min, Math.round(n * factor)),
  };
}

// The scale a map already on the grid was built at, recovered from its own
// dimensions -- for a saved map restored after the setting has since been
// changed (OverworldScene.restoreMap), where the grid in hand, not the
// current setting, is what the pass geometry has to agree with.
export function scaleOfGrid(gridH: number): WorldScale {
  return worldScale(gridH / BASE_GRID_H);
}

export interface CorridorRow {
  y: number;
  left: number;
  right: number;
}

// Per-tile optional decoration the rendering side (OverworldScene.drawWorld)
// consumes on top of the plain walkable/off-path look: a tile's entry is a
// hex color or null (no override). `regionColor` tints a tile (world 1's two
// colored branches, world 3's colored domains, world 8's fractionalized
// split); `biomeOverride` instead swaps which world's whole biome table
// (art/biomes.ts) a tile renders with (world 9's borrowed-look defect
// patches, entry is a world number, not a color, but reuses the same
// nullable-grid shape).
export type NullableNumberGrid = (number | null)[][];

// What one per-world generator (world1.ts .. world10.ts) hands back to
// mapgen.ts -- everything about *that world's own shape*. `tokens`/`rows`
// are deliberately absent here: mapgen.ts derives both centrally from the
// final walkable grid after the shared chokepoint pass runs, so a generator
// never has to reason about encounter-row sampling or token placement itself.
export interface GeneratedMap {
  walkable: boolean[][];
  start: GridPoint;
  goal: GridPoint;
  mid: GridPoint;
  regionColor: NullableNumberGrid;
  biomeOverride: NullableNumberGrid;
  // Impassable tiles the generator deliberately built its shape around, which
  // the world's own off-path material draws its one named feature on: the
  // Vortex Glacier's pits (scenes/overworld/terrain/materials/ice.ts) and the
  // Screened Swamp's local moments (materials/bog.ts). A core is a *known*
  // structure rather than something a renderer could recognise by looking: a
  // blocked tile with a walkable ring is what a lot of ordinary corridor
  // pinches also look like, so inferring it from the neighbourhood puts
  // features where there are none and misses the ones the world is named for.
  // Worlds 5 and 8 are the only generators that place them; World 10 inherits
  // World 5's list along with its shape, and simply never draws anything at
  // them, its surround being a different material.
  featureCores: GridPoint[];
}

export function makeGrid(gridW: number, gridH: number): boolean[][] {
  return Array.from({ length: gridH }, () => Array(gridW).fill(false));
}

export function makeNumberGrid(gridW: number, gridH: number): number[][] {
  return Array.from({ length: gridH }, () => Array(gridW).fill(0));
}

export function makeColorGrid(gridW: number, gridH: number): NullableNumberGrid {
  return Array.from({ length: gridH }, () => Array(gridW).fill(null));
}

export function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function inBounds(x: number, y: number, gridW: number, gridH: number): boolean {
  return x >= 0 && x < gridW && y >= 0 && y < gridH;
}

export function shuffled<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Paints an exact-`width` horizontal band of walkable tiles on row `y`,
// centered on `centerX` (rounded) and clamped fully inside the grid -- the
// one building block every generator's "corridor slice" uses, odd or even
// width alike, rather than a half-width-around-center scheme that only
// produces odd widths. Returns the actual painted bounds (post-clamp) so a
// caller can track the band's own edges (e.g. to root a branch off one).
export function paintBand(walkable: boolean[][], gridW: number, y: number, centerX: number, width: number): { left: number; right: number } | null {
  if (y < 0 || y >= walkable.length) return null;
  const w = Math.max(2, Math.round(width));
  let left = Math.round(centerX - w / 2);
  left = clamp(left, 0, gridW - w);
  const right = left + w - 1;
  for (let x = left; x <= right; x++) walkable[y][x] = true;
  return { left, right };
}

// paintBand's mirror image -- paints an exact-`height` *vertical* band of
// walkable tiles in column `x`, centered on `centerY` -- used by branches
// that run mostly horizontally (world4.ts's fractal branches), where the
// thing being widened is the branch's height rather than its width.
export function paintColumnBand(walkable: boolean[][], gridH: number, x: number, centerY: number, height: number): { top: number; bottom: number } | null {
  if (x < 0 || x >= (walkable[0]?.length ?? 0)) return null;
  const h = Math.max(2, Math.round(height));
  let top = Math.round(centerY - h / 2);
  top = clamp(top, 0, gridH - h);
  const bottom = top + h - 1;
  for (let y = top; y <= bottom; y++) walkable[y][x] = true;
  return { top, bottom };
}

export interface WanderBand {
  y: number;
  center: number;
  left: number;
  right: number;
}

export interface WanderOptions {
  width: number;
  driftChance?: number;
  minStraight?: number;
  maxStep?: number;
  // How big this world is (see WorldScale). `width` is the caller's own
  // already-scaled number, but the wander's own shape -- how far it steps
  // sideways and how many rows it holds a line for -- lives in here, so a
  // bigger world drifts by proportionally more over proportionally longer
  // runs instead of jittering at Meso's amplitude across three times the
  // rows.
  scale?: WorldScale;
}

// Builds (without painting) a list of bands from `startY` down to `goalY`
// (row index decreasing, matching every world's south-start/north-goal
// layout), whose center wanders left/right the same way the original single
// shared corridor algorithm did -- just parameterized on width so a caller
// can ask for a wide 7-tile main corridor or a bare-minimum 2-tile lane with
// the same helper. Kept separate from painting so callers can inspect/adjust
// bands (attach a branch, split them into two, etc.) before committing them
// to the grid.
export function wanderBands(gridW: number, startX: number, startY: number, goalY: number, opts: WanderOptions): WanderBand[] {
  const scale = opts.scale ?? worldScale(1);
  const width = Math.max(MIN_SEGMENT_WIDTH, opts.width);
  const driftChance = opts.driftChance ?? 0.45;
  const minStraight = opts.minStraight ?? scale.tiles(2, 1);
  const maxStep = opts.maxStep ?? scale.tiles(2, 1);
  const half = width / 2;
  const minCenter = half;
  const maxCenter = gridW - half;

  const bands: WanderBand[] = [];
  let center = clamp(startX, minCenter, maxCenter);
  let y = startY;
  let straight = 0;

  while (true) {
    const left = clamp(Math.round(center - half), 0, gridW - width);
    const right = left + width - 1;
    bands.push({ y, center, left, right });
    if (y <= goalY) break;

    if (straight >= minStraight && Math.random() < driftChance && minCenter < maxCenter) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const step = Math.random() < 0.3 ? maxStep : 1;
      center = clamp(center + dir * step, minCenter, maxCenter);
      straight = 0;
    } else {
      straight += 1;
    }
    y -= 1;
  }

  return bands;
}

export function paintBands(walkable: boolean[][], gridW: number, bands: WanderBand[]) {
  bands.forEach((b) => paintBand(walkable, gridW, b.y, b.center, b.right - b.left + 1));
}

// Paints a stretch that splits from one wide-ish center into two thinner
// parallel lanes, holds the split for the run, then ramps back together --
// shared by world1.ts (mean-field symmetry breaking, tinted) and world8.ts
// (spinon fractionalization, untinted, and possibly repeated a few times
// along the same corridor). `colors`, if given, tints the two lanes'
// regionColor distinctly (left, right) for the duration of the split; pass
// nothing for an untinted split. Returns the merged centerX a caller should
// continue building from.
export function paintSplitMerge(
  walkable: boolean[][],
  gridW: number,
  regionColor: NullableNumberGrid | null,
  startCenter: number,
  startY: number,
  rows: number,
  laneWidth: number,
  gap: number,
  rampRows: number,
  colors?: [number, number]
): number {
  let leftCenter = startCenter;
  let rightCenter = startCenter;
  for (let i = 0; i < rows; i++) {
    const y = startY - i;
    if (y < 0) break;
    const rampT = clamp(Math.min(i, rows - 1 - i) / rampRows, 0, 1);
    const targetOffset = (rampT * gap) / 2;

    if (Math.random() < 0.3) leftCenter += Math.random() < 0.5 ? -1 : 1;
    if (Math.random() < 0.3) rightCenter += Math.random() < 0.5 ? -1 : 1;
    const mid = (leftCenter + rightCenter) / 2;
    leftCenter = clamp(mid - targetOffset, laneWidth / 2, gridW - laneWidth / 2);
    rightCenter = clamp(mid + targetOffset, laneWidth / 2, gridW - laneWidth / 2);

    const leftBand = paintBand(walkable, gridW, y, leftCenter, laneWidth);
    const rightBand = paintBand(walkable, gridW, y, rightCenter, laneWidth);
    if (regionColor && colors) {
      if (leftBand) for (let x = leftBand.left; x <= leftBand.right; x++) regionColor[y][x] = colors[0];
      if (rightBand) for (let x = rightBand.left; x <= rightBand.right; x++) regionColor[y][x] = colors[1];
    }
  }
  return (leftCenter + rightCenter) / 2;
}

// Derives one CorridorRow per occupied grid row from the *final* walkable
// grid, after every shape-specific pass (including the chokepoint force)
// has already run -- so encounter placement always lands on an actually
// walkable tile regardless of how exotic that world's shape is. A row with
// more than one disjoint walkable run (a split branch, a ladder's several
// lanes, a domain boundary crossing itself) still yields exactly one entry,
// picked at random weighted by run length, matching the existing "one wild
// encounter roll per corridor row, not per tile, so density stays roughly
// constant regardless of width" rule -- multiple entries per row would
// multiply that density for exactly the worlds with genuine alternate
// routes, the opposite of what that rule wants.
export function deriveRows(walkable: boolean[][], gridW: number, gridH: number): CorridorRow[] {
  const rows: CorridorRow[] = [];
  for (let y = 0; y < gridH; y++) {
    const runs: { left: number; right: number }[] = [];
    let runStart = -1;
    for (let x = 0; x < gridW; x++) {
      if (walkable[y][x]) {
        if (runStart === -1) runStart = x;
      } else if (runStart !== -1) {
        runs.push({ left: runStart, right: x - 1 });
        runStart = -1;
      }
    }
    if (runStart !== -1) runs.push({ left: runStart, right: gridW - 1 });
    if (runs.length === 0) continue;

    if (runs.length === 1) {
      rows.push({ y, ...runs[0] });
      continue;
    }
    const totalLen = runs.reduce((s, r) => s + (r.right - r.left + 1), 0);
    let r = Math.random() * totalLen;
    let chosen = runs[0];
    for (const run of runs) {
      const len = run.right - run.left + 1;
      if (r < len) {
        chosen = run;
        break;
      }
      r -= len;
    }
    rows.push({ y, ...chosen });
  }
  return rows;
}

// Scatters a handful of qumatessence tokens across the final walkable grid,
// preferring degree-1 "dead end" tiles (a branch/spur tip) when the shape
// has any, so the original "reward sits at the end of a detour" flavor
// survives for every generator that still builds literal dead ends --
// falling back to any walkable tile (excluding start/goal/mid, which should
// read as landmarks, not pickup spots) for shapes that don't.
export function scatterTokens(
  walkable: boolean[][],
  gridW: number,
  gridH: number,
  world: number,
  exclude: GridPoint[],
  count: number,
  excludeRows?: Set<number>
): number[][] {
  const tokens = makeNumberGrid(gridW, gridH);
  const excluded = new Set(exclude.map((p) => key(p.x, p.y)));
  const leaves: GridPoint[] = [];
  const all: GridPoint[] = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!walkable[y][x] || excluded.has(key(x, y)) || excludeRows?.has(y)) continue;
      all.push({ x, y });
      const degree = dirs.filter(([dx, dy]) => walkable[y + dy]?.[x + dx]).length;
      if (degree === 1) leaves.push({ x, y });
    }
  }
  const pool = leaves.length >= count ? leaves : all;
  const picked = shuffled(pool).slice(0, count);
  picked.forEach((p) => {
    tokens[p.y][p.x] = pickTokenValue(world);
  });
  return tokens;
}

// Forces every route from `start` to `goal` through a small gap centered on
// `mid` -- invariant B (DESIGN.md §2/CODEMAP.md's mapgen section). Since
// `goal.y` sits strictly north of `start.y` for every world and movement is
// single-step 4-connected (OverworldScene.tryMove), any path between them
// must cross every row value in between at least once, `mid.y` included;
// closing that entire row except a `2*gapHalfWidth+1`-wide gap centered on
// `mid.x` (still >= invariant A's own 2-tile floor) leaves the gap as the
// only crossing, regardless of whatever the rest of that world's shape
// looks like. Run once, centrally, after every per-world generator returns,
// rather than proven per-shape -- turns four separate hard geometric proofs
// (worlds 1/3/7/8's genuine alternate routes) into one shared pass plus the
// reachability/chokepoint checks below.
//
// The gap is the same three tiles at every world size, like the pass throat
// above: what makes a chokepoint one is that it is narrow next to the world
// it interrupts, so a bigger world wants the same pinch, not a bigger one.
// verifyChokepoint below proves invariant B by removing `mid` and its four
// neighbours, which is exactly a `gapHalfWidth = 1` gap -- a wider gap would
// have to be removed in full there or the check would start passing shapes
// whose guardian crossing is not actually forced.
export function forceChokepoint(walkable: boolean[][], gridW: number, mid: GridPoint, gapHalfWidth = 1) {
  const y = mid.y;
  if (!walkable[y]) return;
  for (let x = 0; x < gridW; x++) {
    walkable[y][x] = x >= mid.x - gapHalfWidth && x <= mid.x + gapHalfWidth;
  }
}

// Plain BFS/DFS over the walkable grid, optionally treating a set of tiles
// as removed -- the shared primitive both the ordinary start->goal sanity
// check and the chokepoint verification below are built from.
export function reachable(walkable: boolean[][], gridW: number, gridH: number, from: GridPoint, to: GridPoint, blocked?: Set<string>): boolean {
  const seen = new Set<string>([key(from.x, from.y)]);
  const stack: GridPoint[] = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur.x === to.x && cur.y === to.y) return true;
    const neighbors: [number, number][] = [
      [cur.x + 1, cur.y],
      [cur.x - 1, cur.y],
      [cur.x, cur.y + 1],
      [cur.x, cur.y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (!inBounds(nx, ny, gridW, gridH)) continue;
      const k = key(nx, ny);
      if (seen.has(k) || blocked?.has(k)) continue;
      if (!walkable[ny]?.[nx]) continue;
      seen.add(k);
      stack.push({ x: nx, y: ny });
    }
  }
  return false;
}

// Finds the walkable tile closest (Manhattan) to `from` -- a full grid scan
// rather than a ring-search outward, since the grid is small (well under
// 2000 tiles) and this only runs a handful of times per map generation
// (world3.ts/world5.ts connecting a fixed point into a network-shaped
// walkable set that doesn't already touch it).
export function nearestWalkable(walkable: boolean[][], gridW: number, gridH: number, from: GridPoint): GridPoint | null {
  let best: GridPoint | null = null;
  let bestDist = Infinity;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!walkable[y][x]) continue;
      const d = Math.abs(x - from.x) + Math.abs(y - from.y);
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
}

// Stamps a `thickness`-wide walkable block at every step of an L-shaped
// (x-then-y) walk from `from` to `to` -- a crude but simple/robust way to
// guarantee two points end up connected (and at invariant A's own width)
// regardless of whatever irregular walkable shape already exists around
// them, used to splice `start`/`goal`/`mid` into a network-shaped layout
// (world3.ts's domain boundaries, world5.ts's vortex spiral) that doesn't
// naturally already touch that exact point.
export function carveThickPath(walkable: boolean[][], gridW: number, gridH: number, from: GridPoint, to: GridPoint, thickness = 2) {
  let x = from.x;
  let y = from.y;
  const stamp = (cx: number, cy: number) => {
    for (let dx = 0; dx < thickness; dx++) {
      for (let dy = 0; dy < thickness; dy++) {
        if (inBounds(cx + dx, cy + dy, gridW, gridH)) walkable[cy + dy][cx + dx] = true;
      }
    }
  };
  stamp(x, y);
  while (x !== to.x || y !== to.y) {
    if (x !== to.x) x += x < to.x ? 1 : -1;
    else y += y < to.y ? 1 : -1;
    stamp(x, y);
  }
}

// Both ends of every world are the same piece of geography seen twice: the
// corridor narrows into a pass at the goal, and the next world opens with the
// mouth of that same pass widening out. World N's start is world N-1's exit,
// so if the player leaves through a chokepoint they have to arrive in one --
// otherwise the seam contradicts itself. Both ends are shaped here, from the
// same taper, which is what keeps them one joint rather than two worlds'
// independently-drawn edges.
//
// The narrowing is permanent geography, not staging: it is there before the
// rival is beaten and after. What changes with the gate is what can be seen
// through the pass, not whether the pass exists.
//
// World 1's *backward* exit is deliberately not one of these. It leads to the
// Lab, which is not a place (WORLDS.md section 4) -- every geographic
// boundary in the game is a pass, and the single non-geographic one is a
// door. That asymmetry is the point and is left alone here.
// The throat itself is one width at every world size. A pass is a doorway
// between two worlds, not a feature of either, and it is the same doorway
// walked twice -- so it is exactly as wide whether the world behind it is
// Nano or Macro. It is also load-bearing beyond its own look: the gate the
// player steps through, the boss preview seen through it and the sign board
// beside it are all placed off this number (OverworldScene), and widening it
// would move all three.
export const PASS_HALF_WIDTH = 1;
// The mouth the taper opens out to, which is a piece of the world rather than
// of the doorway, so it scales with the world's own corridors.
const BASE_PASS_OPEN_HALF_WIDTH = 6;
// How many rows the taper runs over, at each end, where the world gives it
// room. Also the depth of the wild-suppression zone (passZoneRows):
// everything the taper touches is a place nothing may spawn.
const BASE_PASS_ROWS = 6;

function passRows(scale: WorldScale): number {
  return scale.tiles(BASE_PASS_ROWS);
}

// How thick the stitch is that reconnects a world's own corridor to the pass
// mouth (taperPass below). It scales, since it is joining corridors that
// scale, and everything that has to keep clear of it scales with it.
function joinThickness(scale: WorldScale): number {
  return scale.tiles(2);
}

// How deep a taper may actually cut, which is however much of PASS_ROWS fits
// between the throat and the guardian's row. The guardian's chokepoint and
// the pass are two different pieces of geography and must not land on the
// same row: the taper runs after forceChokepoint and would overwrite its gap,
// leaving a world whose every route no longer goes through its guardian.
// Worlds whose generator puts the guardian close to the goal (world8.ts's
// reserved final stretch) get a shorter taper rather than a broken invariant.
// The clearance is the join's own thickness, not one row: the join stamps a
// block past the taper's own last row, and re-opening tiles on the guardian's
// walled row would break the chokepoint just as surely as tapering over it.
function passDepth(throat: GridPoint, mid: GridPoint, scale: WorldScale): number {
  return Math.max(0, Math.min(passRows(scale), Math.abs(mid.y - throat.y) - joinThickness(scale)));
}

// Narrows the corridor into the pass over the last rows before the goal.
export function narrowGoalPass(walkable: boolean[][], gridW: number, gridH: number, goal: GridPoint, mid: GridPoint, scale: WorldScale) {
  taperPass(walkable, gridW, gridH, goal, 1, passDepth(goal, mid, scale), scale);
}

// The same taper mirrored at the entry row, so the world opens as a mouth
// widening out of the pass the player just walked through.
export function openStartMouth(walkable: boolean[][], gridW: number, gridH: number, start: GridPoint, mid: GridPoint, scale: WorldScale) {
  taperPass(walkable, gridW, gridH, start, -1, passDepth(start, mid, scale), scale);
}

// `inward` points from the throat toward the world's interior: +1 at the
// goal (which sits at the grid's north edge, so the interior is south), -1 at
// the start.
//
// The taper only ever *removes* tiles outside its band, then re-asserts the
// throat itself, so it can narrow any shape a generator produced without
// knowing anything about that shape. What it cannot guarantee on its own is
// the join: a corridor arriving well off to one side would be severed by the
// widest cut, so the row just past the taper is reconnected explicitly.
function taperPass(walkable: boolean[][], gridW: number, gridH: number, throat: GridPoint, inward: number, rows: number, scale: WorldScale) {
  if (rows < 2) return;
  const openHalf = scale.tiles(BASE_PASS_OPEN_HALF_WIDTH);
  for (let i = 0; i < rows; i++) {
    const y = throat.y + inward * i;
    if (y < 0 || y >= gridH) return;
    const half = Math.round(PASS_HALF_WIDTH + (openHalf - PASS_HALF_WIDTH) * (i / (rows - 1)));
    for (let x = 0; x < gridW; x++) {
      if (Math.abs(x - throat.x) > half) walkable[y][x] = false;
    }
    for (let x = throat.x - PASS_HALF_WIDTH; x <= throat.x + PASS_HALF_WIDTH; x++) {
      if (inBounds(x, y, gridW, gridH)) walkable[y][x] = true;
    }
  }

  const joinY = throat.y + inward * rows;
  const mouthY = throat.y + inward * (rows - 1);
  if (joinY < 0 || joinY >= gridH) return;
  const anchor = nearestWalkableOnRow(walkable, gridW, joinY, throat.x);
  if (anchor == null) return;
  carveThickPath(walkable, gridW, gridH, { x: anchor, y: joinY }, { x: throat.x, y: mouthY }, joinThickness(scale));
}

function nearestWalkableOnRow(walkable: boolean[][], gridW: number, y: number, nearX: number): number | null {
  let best: number | null = null;
  for (let x = 0; x < gridW; x++) {
    if (!walkable[y]?.[x]) continue;
    if (best == null || Math.abs(x - nearX) < Math.abs(best - nearX)) best = x;
  }
  return best;
}

// The rows nothing may spawn on. A pass is a deliberate exception to the rule
// that no walkable segment is ever narrower than 2 tiles -- that rule exists
// so a tile-bound spawn can never fill the route -- so the exception is only
// safe if the narrowed rows are kept clear of everything that spawns on a
// tile: wild encounters and qumatessence alike. Both ends are covered, since
// a throat at the entry is exactly as narrow as one at the goal.
export function passZoneRows(start: GridPoint, goal: GridPoint, mid: GridPoint, scale: WorldScale): Set<number> {
  const rows = new Set<number>();
  for (let i = 0; i < passDepth(goal, mid, scale); i++) rows.add(goal.y + i);
  for (let i = 0; i < passDepth(start, mid, scale); i++) rows.add(start.y - i);
  return rows;
}

// Invariant B's own check: with `mid` and its 4 immediate neighbors removed
// from the walkable set, start must NOT be able to reach goal -- confirming
// forceChokepoint's gap really is the sole crossing (and catching the rare
// case where the gap itself ended up disconnected from the rest of that
// world's shape, which the retry loop in mapgen.ts handles).
export function verifyChokepoint(walkable: boolean[][], gridW: number, gridH: number, start: GridPoint, goal: GridPoint, mid: GridPoint): boolean {
  const blocked = new Set<string>([key(mid.x, mid.y)]);
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].forEach(([dx, dy]) => blocked.add(key(mid.x + dx, mid.y + dy)));
  return !reachable(walkable, gridW, gridH, start, goal, blocked);
}
