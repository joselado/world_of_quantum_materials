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

export interface GridPoint {
  x: number;
  y: number;
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
  const width = Math.max(2, opts.width);
  const driftChance = opts.driftChance ?? 0.45;
  const minStraight = opts.minStraight ?? 2;
  const maxStep = opts.maxStep ?? 2;
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
export function scatterTokens(walkable: boolean[][], gridW: number, gridH: number, world: number, exclude: GridPoint[], count: number): number[][] {
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
      if (!walkable[y][x] || excluded.has(key(x, y))) continue;
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
