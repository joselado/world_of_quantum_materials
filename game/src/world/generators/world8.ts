// World 8 (quantum magnetism, spinons, Kondo): a peat shelf with pools of
// black water punched into it. The shelf is the ground that holds and the
// water is what takes you, so the world is walked as a place with hazards in
// it rather than as a bank threaded between them.
//
// **The escalation is the shelf itself.** It enters wide and open and closes
// steadily to a narrow bank by the goal: the water is winning, and further in
// is further screened. That is the world's spine written into the ground the
// player stands on rather than into anything they have to be told, and the
// shelf carries it rather than pool density because a pool needs clear ground
// on every side of it -- past a certain crowding pools start refusing each
// other, and a deep end that cannot fit its own water would read as *safer*
// than the entrance.
//
// **The pools carry the screening and the splitting.** Each pool's centre
// comes back as a feature core, and scenes/overworld/terrain/materials/bog.ts
// burns a local moment there, closing its halo the further in it stands -- so
// the moments are in the water by construction, which is where the medium that
// screens them is. The wide pools are placed first and guaranteed: those are
// the ones the shelf visibly parts around and rejoins past, which is one
// excitation briefly reading as two. The bank divides because something in the
// water is being put out, and here that is one fact about the ground rather
// than two features laid over each other.

import {
  bandWindow,
  GeneratedMap,
  GridPoint,
  WanderBand,
  WorldScale,
  clamp,
  discIsland,
  makeColorGrid,
  makeGrid,
  paintBands,
  punchFirst,
  punchIslands,
  wanderBands,
  widestRunCenter,
} from './shared';

// The shelf at the entrance and at the goal. Both are lengths of the map and
// scale with the world; what does not change with size is that the second is
// much less than the first.
const SHELF_WIDTH_ENTRANCE = 17;
const SHELF_WIDTH_DEEP = 12;
// The shelf drifts gently. A pool needs the same ground held across every row
// it touches plus its passages, and hard swings leave no window wide enough to
// put one in.
const SHELF_DRIFT_CHANCE = 0.25;
const SHELF_MAX_STEP = 1;
// The pools the shelf parts around -- a count, so the same two or three stand
// in a Nano world as in a Macro one, each scaled up with the world.
const WIDE_POOL_COUNT_MIN = 2;
const WIDE_POOL_COUNT_MAX = 3;
const WIDE_POOL_RADIUS = 4;
const WIDE_POOL_RADIUS_MIN = 2;
// The rest of the water, offered along the shelf and taken wherever there is
// room. Two pools cannot stand closer than their own radii plus the passage
// that has to survive between them, so this is spaced against that rather than
// against how much water the world would like to have.
const POOL_SPACING = 8;
const POOL_RADIUS = 2;
const PASSAGE_MIN = 2;

export function generateWorld8Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const totalRows = start.y - goalY + 1;
  // How far into the world a row is, 0 at the entrance and 1 at the goal --
  // the one number the shelf's own width is written against.
  const depthOf = (y: number) => clamp((start.y - y) / Math.max(1, totalRows - 1), 0, 1);

  // The drift comes from the shared wander at the shelf's widest; each row is
  // then narrowed around that same centre by how deep it is, so the shelf
  // closes in without ever changing its mind about which way it is going.
  const entranceWidth = scale.tiles(SHELF_WIDTH_ENTRANCE);
  const deepWidth = scale.tiles(SHELF_WIDTH_DEEP);
  const drifted = wanderBands(gridW, start.x, start.y, goalY, {
    width: entranceWidth,
    driftChance: SHELF_DRIFT_CHANCE,
    maxStep: SHELF_MAX_STEP,
    scale,
  });
  const bands: WanderBand[] = drifted.map((band) => {
    const width = Math.round(entranceWidth + depthOf(band.y) * (deepWidth - entranceWidth));
    const left = clamp(Math.round(band.center - width / 2), 0, gridW - width);
    return { ...band, left, right: left + width - 1 };
  });

  const walkable = makeGrid(gridW, gridH);
  paintBands(walkable, gridW, bands);

  const midBand = bands[Math.floor(bands.length / 2)];
  const pools: GridPoint[][] = [];

  // Where a pool of this size may sit on this row: the ground every row it
  // touches holds in common, inset by the pool's own reach and the passage
  // that has to survive beside it. Nothing comes back where the shelf is too
  // narrow there to take one at all, which is most of the deep end -- by then
  // the bank is the width of a bank.
  const poolAt = (y: number, radius: number): GridPoint[] | null => {
    const index = start.y - y;
    if (index < 0 || index >= bands.length) return null;
    if (y <= goalY || Math.abs(y - midBand.y) <= radius + PASSAGE_MIN) return null;
    const reach = radius + PASSAGE_MIN;
    const window = bandWindow(bands, index, reach);
    const lo = window.left + reach;
    const hi = window.right - reach;
    if (hi < lo) return null;
    const cx = clamp(lo + Math.floor(Math.random() * (hi - lo + 1)), radius, gridW - radius - 1);
    return discIsland(cx, y, radius);
  };

  const featureCores: GridPoint[] = [];
  const widePoolCount = WIDE_POOL_COUNT_MIN + Math.floor(Math.random() * (WIDE_POOL_COUNT_MAX - WIDE_POOL_COUNT_MIN + 1));
  for (let i = 1; i <= widePoolCount; i++) {
    const targetY = start.y - Math.round((totalRows * i) / (widePoolCount + 1));
    const candidates: GridPoint[][] = [];
    for (let radius = scale.tiles(WIDE_POOL_RADIUS, 1); radius >= scale.tiles(WIDE_POOL_RADIUS_MIN, 1); radius--) {
      for (const dy of [0, -3, 3, -6, 6]) {
        const pool = poolAt(targetY + dy, radius);
        if (pool) candidates.push(pool);
      }
    }
    const core = punchFirst(walkable, gridW, gridH, candidates, PASSAGE_MIN);
    if (core) featureCores.push(core);
  }

  const radius = scale.tiles(POOL_RADIUS, 1);
  for (let y = start.y - scale.tiles(POOL_SPACING); y > goalY; y -= scale.tiles(POOL_SPACING)) {
    const pool = poolAt(y, radius);
    if (pool) pools.push(pool);
  }
  featureCores.push(...punchIslands(walkable, gridW, gridH, pools, PASSAGE_MIN));

  const goalBand = bands[bands.length - 1];
  const goal = { x: widestRunCenter(walkable, gridW, goalBand.y) ?? goalBand.center, y: goalBand.y };
  const mid = { x: widestRunCenter(walkable, gridW, midBand.y) ?? midBand.center, y: midBand.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride: makeColorGrid(gridW, gridH), featureCores };
}
