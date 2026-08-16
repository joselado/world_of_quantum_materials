// World 5 (superconductivity, Nambu, Majorana): an open ice sheet with one or
// two vortex pits punched clean through it. The sheet is wide and the pits sit
// in the middle of it, so the route parts and rejoins around each one: the
// player winds around a vortex because the geometry leaves no way through it,
// not because a spiral was drawn for them to follow.
//
// That is the physics the world is named for. A supercurrent flows everywhere
// in the condensate and has to circulate around a trapped flux line, and the
// field is expelled from everywhere except the core -- so the sheet is blank
// and open, and the only place anything shows is the pit, which
// scenes/overworld/terrain/materials/ice.ts draws its rim and its cold glow of
// trapped flux on.
//
// The pit centres come back from the shared punch as `featureCores`, which is
// what puts that glow exactly where the physics puts it rather than wherever a
// renderer guessed a hole might be. How many vortices the sheet carries is a
// count, the same one or two at every world size, each of them scaled up with
// the world.

import {
  bandWindow,
  GeneratedMap,
  GridPoint,
  WorldScale,
  clamp,
  discIsland,
  makeColorGrid,
  makeGrid,
  paintBands,
  punchFirst,
  wanderBands,
  widestRunCenter,
} from './shared';

const SHEET_WIDTH = 15;
const VORTEX_RADIUS = 4;
// The smallest a vortex may be shrunk to when the ice leaves no room for a
// full-sized one. A pit still has to be something the route parts around
// rather than a hole to step over.
const VORTEX_RADIUS_MIN = 2;
// The narrowest a passage beside a pit may be built. Two tiles is invariant
// A's own floor; this is what the sheet has to be wider than twice over, or
// the pit is a wall rather than something to wind around.
const PASSAGE_MIN = 2;
// The sheet drifts, but gently: a pit needs the same ground held for every row
// it touches plus its passages, and a corridor that swings hard leaves no
// window wide enough for one anywhere along it. An open sheet has no reason to
// swing hard either.
const SHEET_DRIFT_CHANCE = 0.25;
const SHEET_MAX_STEP = 1;

export function generateWorld5Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const totalRows = start.y - goalY + 1;
  const vortexCount = Math.random() < 0.5 ? 1 : 2;
  const fracs = vortexCount === 1 ? [0.48] : [0.3, 0.68];

  const bands = wanderBands(gridW, start.x, start.y, goalY, {
    width: scale.tiles(SHEET_WIDTH),
    driftChance: SHEET_DRIFT_CHANCE,
    maxStep: SHEET_MAX_STEP,
    scale,
  });
  const walkable = makeGrid(gridW, gridH);
  paintBands(walkable, gridW, bands);

  const midBand = bands[Math.floor(bands.length / 2)];

  // A pit of this size on this row, centred on ground every row it touches
  // holds in common (the sheet drifts, so the row's own span is not enough to
  // place against) and offset off-centre as far as the ice allows -- the two
  // ways around a vortex are not meant to be the same walk.
  const pitAt = (y: number, radius: number): GridPoint[] | null => {
    const index = start.y - y;
    if (index < 0 || index >= bands.length) return null;
    // Never on the guardian's row or within a pit's own reach of it: the
    // chokepoint pass wipes that row to a three-tile gap, and a pit beside the
    // gap would close the only crossing.
    if (Math.abs(y - midBand.y) <= radius + PASSAGE_MIN) return null;
    const reach = radius + PASSAGE_MIN;
    const window = bandWindow(bands, index, reach);
    const lo = window.left + reach;
    const hi = window.right - reach;
    if (hi < lo) return null;
    const cx = clamp(lo + Math.floor(Math.random() * (hi - lo + 1)), radius, gridW - radius - 1);
    return discIsland(cx, y, radius);
  };

  // Every vortex gets placed. This world is named for them, and a glacier that
  // rolled a corridor with no room for a full-sized pit gets a smaller one a
  // few rows along rather than none: the candidates below run from the pit the
  // world wants down to the smallest one still worth winding around.
  const featureCores: GridPoint[] = [];
  const wanted = scale.tiles(VORTEX_RADIUS, 1);
  const floor = scale.tiles(VORTEX_RADIUS_MIN, 1);
  for (const frac of fracs) {
    const targetY = start.y - Math.round(totalRows * frac);
    const candidates: GridPoint[][] = [];
    for (let radius = wanted; radius >= floor; radius--) {
      for (const dy of [0, -2, 2, -5, 5, -8, 8]) {
        const pit = pitAt(targetY + dy, radius);
        if (pit) candidates.push(pit);
      }
    }
    const core = punchFirst(walkable, gridW, gridH, candidates, PASSAGE_MIN);
    if (core) featureCores.push(core);
  }

  const goalBand = bands[bands.length - 1];
  const goal = { x: widestRunCenter(walkable, gridW, goalBand.y) ?? goalBand.center, y: goalBand.y };
  const mid = { x: widestRunCenter(walkable, gridW, midBand.y) ?? midBand.center, y: midBand.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride: makeColorGrid(gridW, gridH), featureCores };
}
