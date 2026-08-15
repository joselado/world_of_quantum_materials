// World 8 (quantum magnetism, spinons, Kondo): peat banks threading between
// pools of open water. The bank occasionally parts into two thin parallel
// banks for a stretch -- fractionalization, one excitation briefly reading as
// two -- before recombining into one, possibly more than once along the same
// journey, unlike world1.ts's single mean-field split (and left untinted,
// since fractionalization isn't picking between two distinct
// broken-symmetry ground states the way world1's split is).
//
// What each split parts *around* is water, and the tile at the middle of that
// pool is returned as a feature core so the surround can burn a local moment
// in it (scenes/overworld/terrain/materials/bog.ts). The split and the
// screening are then one picture: the bank divides because something in the
// water is being put out.

import { GeneratedMap, GridPoint, clamp, makeColorGrid, makeGrid, paintBands, paintSplitMerge, wanderBands } from './shared';

const WIDE_WIDTH = 6;
const BRANCH_WIDTH = 3;
const BRANCH_GAP = 5;
const RAMP_ROWS = 3;

export function generateWorld8Map(gridW: number, gridH: number, start: GridPoint): GeneratedMap {
  const goalY = 1;
  const totalRows = start.y - goalY + 1;
  const splitCount = 2 + (Math.random() < 0.5 ? 1 : 0); // 2 or 3 fractionalization stretches

  // Reserve a real wide stretch just before the goal for Kondo's own
  // guardian tile to stand in -- splitting the whole journey evenly across
  // `splitCount` slots (as if the final stretch were just one more slot)
  // could leave that last stretch only 1-2 rows long, putting `mid` right
  // on top of `goal` instead of a comfortable distance before it.
  const finalStretchRows = clamp(Math.round(totalRows * 0.18), 10, 16);
  const splitZoneFloorY = goalY + finalStretchRows;

  const walkable = makeGrid(gridW, gridH);
  const featureCores: GridPoint[] = [];
  let cursorX = start.x;
  let cursorY = start.y;

  for (let s = 0; s < splitCount; s++) {
    const remainingSlots = splitCount - s;
    const budgetRows = Math.max(1, cursorY - splitZoneFloorY);
    const targetY = clamp(cursorY - Math.round(budgetRows / (remainingSlots + 1)), splitZoneFloorY + 1, cursorY - 6);
    const bands = wanderBands(gridW, cursorX, cursorY, targetY, { width: WIDE_WIDTH });
    paintBands(walkable, gridW, bands);
    const lastBand = bands[bands.length - 1];

    const splitRows = clamp(Math.round(totalRows * 0.1), 2 * RAMP_ROWS + 3, 10);
    const mergedCenter = paintSplitMerge(walkable, gridW, null, lastBand.center, lastBand.y, splitRows, BRANCH_WIDTH, BRANCH_GAP, RAMP_ROWS);

    const core = poolCenter(walkable, gridW, lastBand.y - Math.floor(splitRows / 2));
    if (core) featureCores.push(core);

    cursorX = mergedCenter;
    cursorY = lastBand.y - splitRows;
  }

  const finalBands = wanderBands(gridW, cursorX, cursorY, goalY, { width: WIDE_WIDTH });
  paintBands(walkable, gridW, finalBands);

  const goalBand = finalBands[finalBands.length - 1];
  const goal = { x: Math.round((goalBand.left + goalBand.right) / 2), y: goalBand.y };

  // Picks a row comfortably before the goal rather than a literal midpoint
  // index -- for a short final stretch (a run of bad luck in the split
  // budgeting above), `Math.floor(length/2)` can land on the very last row,
  // putting the guardian's forced chokepoint on top of the goal tile itself.
  const midIdx = Math.max(0, Math.min(Math.floor(finalBands.length / 2), finalBands.length - 3));
  const midBand = finalBands[midIdx];
  const mid = { x: Math.round((midBand.left + midBand.right) / 2), y: midBand.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride: makeColorGrid(gridW, gridH) , featureCores };
}

// The middle of the water a split parts around, read back off the painted
// grid rather than predicted: the two branches wander independently while
// they are apart, so the gap between them is only known once they are drawn.
// Returns nothing for a row whose branches happen to touch -- a pool with no
// water in it has nothing to burn.
function poolCenter(walkable: boolean[][], gridW: number, y: number): GridPoint | null {
  if (y < 0 || y >= walkable.length) return null;
  const row = walkable[y];
  let x = 0;
  while (x < gridW && !row[x]) x++;
  while (x < gridW && row[x]) x++;
  const gapStart = x;
  while (x < gridW && !row[x]) x++;
  if (x === gapStart || x >= gridW) return null;
  return { x: Math.floor((gapStart + x - 1) / 2), y };
}
