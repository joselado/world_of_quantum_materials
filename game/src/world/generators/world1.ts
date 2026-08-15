// World 1 (mean-field theory, spontaneous symmetry breaking): the corridor
// starts wide, then partway along splits into two thin, distinctly-colored
// parallel branches -- the two degenerate symmetry-broken ground states a
// mean-field/Hubbard-U treatment can settle into -- runs as two branches for
// a stretch, then the two recombine back into one wide corridor before
// continuing on to the goal. Noether (conservation laws) stands in the wide
// section after the branches remerge.

import { GeneratedMap, GridPoint, clamp, makeColorGrid, makeGrid, paintBands, paintSplitMerge, wanderBands } from './shared';

const WIDE_WIDTH = 7;
const BRANCH_WIDTH = 3;
const BRANCH_GAP = 6; // center-to-center separation once fully split
const RAMP_ROWS = 3;
const LEFT_COLOR = 0x5ad9ff; // cool blue -- one broken-symmetry branch
const RIGHT_COLOR = 0xff6a6a; // warm coral -- the other

export function generateWorld1Map(gridW: number, gridH: number, start: GridPoint): GeneratedMap {
  const goalY = 1;
  const totalRows = start.y - goalY + 1;
  const travel = (frac: number) => Math.round(totalRows * frac);

  const splitStartY = start.y - travel(0.22);
  const splitRows = clamp(travel(0.24), 2 * RAMP_ROWS + 4, 18);
  const splitEndY = clamp(splitStartY - splitRows + 1, goalY + travel(0.15), splitStartY - 1);
  const actualRows = splitStartY - splitEndY + 1;

  const walkable = makeGrid(gridW, gridH);
  const regionColor = makeColorGrid(gridW, gridH);

  const preBands = wanderBands(gridW, start.x, start.y, splitStartY, { width: WIDE_WIDTH });
  paintBands(walkable, gridW, preBands);
  const splitCenterStart = preBands[preBands.length - 1].center;

  const mergedCenter = paintSplitMerge(walkable, gridW, regionColor, splitCenterStart, splitStartY, actualRows, BRANCH_WIDTH, BRANCH_GAP, RAMP_ROWS, [
    LEFT_COLOR,
    RIGHT_COLOR,
  ]);

  const postBands = wanderBands(gridW, mergedCenter, splitEndY - 1, goalY, { width: WIDE_WIDTH });
  paintBands(walkable, gridW, postBands);

  const goalBand = postBands[postBands.length - 1];
  const goal = { x: Math.round((goalBand.left + goalBand.right) / 2), y: goalBand.y };

  // Comfortably before the goal, not a literal midpoint index -- see
  // world8.ts's own note on why a short final stretch needs this guard.
  const midIdx = Math.max(0, Math.min(Math.floor(postBands.length / 2), postBands.length - 3));
  const midBand = postBands[midIdx];
  const mid = { x: Math.round((midBand.left + midBand.right) / 2), y: midBand.y };

  return { walkable, start, goal, mid, regionColor, biomeOverride: makeColorGrid(gridW, gridH) , featureCores: [] };
}
