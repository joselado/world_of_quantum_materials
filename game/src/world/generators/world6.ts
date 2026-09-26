// World 6 (classical magnetism, magnons): a coast walked north, with the two
// halves of the topic standing either side of the beach. To the right, the
// sea: the ordered medium, with spin waves running down it as swells whose
// crests and troughs carry the two signs of the transverse spin, red and blue
// (scenes/overworld/terrain/materials/coast.ts). To the left, the rock: an
// antiferromagnet drawn as a checkerboard of two greys, one per sublattice,
// broken every so often by a domain wall where the checkerboard slips by one
// square.
//
// The beach is the only footing. The strand wanders as one band, so its
// shoreline and the foot of the rock drift together and the beach keeps its
// width; tide pools of the same sea lie in it near the water, punched with
// the shared island toolkit so the ground around each holds the two-tile
// clearance every feature keeps.
//
// Which side is which is written into `regionColor`: every tile seaward of
// the beach carries SEA_TINT, every tile landward of it carries none, and
// materials/coast.ts reads that back to decide what to draw on the tile. The
// rule is settled against the *finished* grid (finishWorld6Map, run by
// mapgen.ts after the shared chokepoint and pass tapers), so whatever those
// passes block on the sea side of the beach -- the pass's own flank, the
// guardian row's wall -- is water rather than rock: right of the walkable
// ground there is only the sea. The lateral margins repeat each row's
// outermost tile, so the sea runs to the right-hand horizon and the rock to
// the left-hand one.

import {
  GeneratedMap,
  GridPoint,
  PASS_HALF_WIDTH,
  WanderBand,
  WorldScale,
  bandWindow,
  clamp,
  discIsland,
  makeColorGrid,
  makeGrid,
  paintBands,
  punchIslands,
  wanderBands,
  widestRunCenter,
} from './shared';

// The tint every sea tile carries. Blended into the tile's own fill by the
// paint pass, so open water reads as water even past the range the accent
// pass draws waves at, and read back unblended by materials/coast.ts to tell
// the sea from the rock.
export const SEA_TINT = 0x0a1a3a;

export function isSeaTint(tint: number | null): boolean {
  return tint === SEA_TINT;
}

const BEACH_WIDTH = 13;
// The beach drifts gently: a pool needs the same ground held across every
// row it touches plus its clearance, and hard swings leave no window wide
// enough to put one in.
const BEACH_DRIFT_CHANCE = 0.3;
const BEACH_MAX_STEP = 1;
// Rows between successive pools, a length of the map that scales with the
// world.
const POOL_SPACING = 8;
// How far up from the shoreline a pool is centred.
const POOL_INSET = 3;
const POOL_RADIUS = 1;
const CLEARANCE = 2;

export function generateWorld6Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const bands = wanderBands(gridW, start.x, start.y, goalY, {
    width: scale.tiles(BEACH_WIDTH),
    driftChance: BEACH_DRIFT_CHANCE,
    maxStep: BEACH_MAX_STEP,
    scale,
  });

  const walkable = makeGrid(gridW, gridH);
  paintBands(walkable, gridW, bands);

  // The way back. The rows behind the entrance are inside the grid but
  // below the start tile, and left blocked they end the beach in a point
  // between rock and water the moment the player turns round. Carrying the
  // pass's own throat through them to the grid's near edge is the entry
  // mouth's counterpart to the road that runs on past the far edge: the
  // coast visibly continues toward the world before it. Nothing spawns on
  // these rows (shared.ts's passZoneRows counts every row behind the start
  // as pass), so the stub is a view, not ground the world uses.
  for (let y = start.y + 1; y < gridH; y++) {
    for (let x = start.x - PASS_HALF_WIDTH; x <= start.x + PASS_HALF_WIDTH; x++) {
      if (x >= 0 && x < gridW) walkable[y][x] = true;
    }
  }

  // The shoreline on every row of the grid, the rows beyond the band's own
  // run included, so the sea is continuous from the bottom edge to the top.
  const bandAt = (y: number): WanderBand => bands[clamp(start.y - y, 0, bands.length - 1)];
  const regionColor = makeColorGrid(gridW, gridH);
  for (let y = 0; y < gridH; y++) {
    const shore = bandAt(y).right;
    for (let x = shore + 1; x < gridW; x++) regionColor[y][x] = SEA_TINT;
  }

  // Settled before anything is punched: the guardian's row is wiped to a
  // three-tile gap by the chokepoint pass, and a pool beside that gap would
  // close the doorway.
  const midBand = bands[Math.floor(bands.length / 2)];
  const radius = scale.tiles(POOL_RADIUS, 1);
  const reach = radius + CLEARANCE;

  // Where a pool may lie on this row, against the ground every row it
  // touches holds in common, a few tiles up from the shoreline.
  const poolAt = (y: number): GridPoint[] | null => {
    const index = start.y - y;
    if (index < 0 || index >= bands.length) return null;
    if (y <= goalY || Math.abs(y - midBand.y) <= reach) return null;
    const window = bandWindow(bands, index, reach);
    const lo = window.left + reach;
    const hi = window.right - reach;
    if (hi < lo) return null;
    const cx = clamp(window.right - scale.tiles(POOL_INSET, 1), lo, hi);
    return discIsland(cx, y, radius);
  };

  const pools: GridPoint[][] = [];
  const poolStep = scale.tiles(POOL_SPACING);
  for (let y = start.y - Math.floor(poolStep / 2); y > goalY; y -= poolStep) {
    const pool = poolAt(y);
    if (pool) pools.push(pool);
  }
  // A pool is the sea lying in the beach: its tiles carry the sea's tint, so
  // the same waves run through it.
  for (const core of punchIslands(walkable, gridW, gridH, pools, CLEARANCE)) {
    for (const tile of discIsland(core.x, core.y, radius)) regionColor[tile.y][tile.x] = SEA_TINT;
  }

  const goalBand = bands[bands.length - 1];
  const goal = { x: widestRunCenter(walkable, gridW, goalBand.y) ?? Math.round(goalBand.center), y: goalBand.y };
  const mid = { x: widestRunCenter(walkable, gridW, midBand.y) ?? Math.round(midBand.center), y: midBand.y };

  return { walkable, start, goal, mid, regionColor, biomeOverride: makeColorGrid(gridW, gridH), featureCores: [] };
}

// Settles the sea against the finished grid: on every row, everything right
// of the rightmost walkable tile is sea and everything left of the leftmost
// is rock, whatever the shared passes blocked after the beach was laid; the
// pools inside the beach keep the tint they were punched with. A row with no
// footing at all (the grid's few rows beyond the pass and behind the
// entrance) takes the nearest footed row's edges, so the coast runs unbroken
// to the grid's ends.
export function finishWorld6Map(map: GeneratedMap, gridW: number, gridH: number) {
  const edges: ({ left: number; right: number } | null)[] = [];
  for (let y = 0; y < gridH; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < gridW; x++) {
      if (!map.walkable[y][x]) continue;
      if (left < 0) left = x;
      right = x;
    }
    edges.push(left < 0 ? null : { left, right });
  }
  const nearest = (y: number) => {
    for (let d = 0; d < gridH; d++) {
      const below = edges[y + d];
      if (below) return below;
      const above = edges[y - d];
      if (above) return above;
    }
    return null;
  };
  for (let y = 0; y < gridH; y++) {
    const edge = nearest(y);
    if (!edge) continue;
    for (let x = 0; x < edge.left; x++) map.regionColor[y][x] = null;
    for (let x = edge.right + 1; x < gridW; x++) map.regionColor[y][x] = SEA_TINT;
  }
}
