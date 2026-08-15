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

import { GeneratedMap, GridPoint, WorldScale, clamp, makeColorGrid, makeGrid, paintBands, paintSplitMerge, wanderBands } from './shared';

const WIDE_WIDTH = 6;
const BRANCH_WIDTH = 3;
const BRANCH_GAP = 5;
const RAMP_ROWS = 3;

export function generateWorld8Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const totalRows = start.y - goalY + 1;
  // How many times the bank fractionalizes is a count, the same in a Nano
  // world as in a Macro one -- each stretch is simply longer.
  const splitCount = 2 + (Math.random() < 0.5 ? 1 : 0); // 2 or 3 fractionalization stretches
  const rampRows = scale.tiles(RAMP_ROWS);

  // Reserve a real wide stretch just before the goal for Kondo's own
  // guardian tile to stand in -- splitting the whole journey evenly across
  // `splitCount` slots (as if the final stretch were just one more slot)
  // could leave that last stretch only 1-2 rows long, putting `mid` right
  // on top of `goal` instead of a comfortable distance before it.
  const finalStretchRows = clamp(Math.round(totalRows * 0.18), scale.tiles(10), scale.tiles(16));
  const splitZoneFloorY = goalY + finalStretchRows;

  // What one fractionalization stretch costs at the least: the rows the split
  // itself needs to part and recombine, plus a run of joined bank to reach it
  // along. Both are what the shape means rather than tuning -- a split with no
  // room to ramp is not two banks, and two splits with no bank between them
  // are not two splits.
  const minSplitRows = 2 * rampRows + scale.tiles(3);
  const minSegmentRows = scale.tiles(6);

  const walkable = makeGrid(gridW, gridH);
  const featureCores: GridPoint[] = [];
  let cursorX = start.x;
  let cursorY = start.y;

  for (let s = 0; s < splitCount; s++) {
    const remainingSlots = splitCount - s;
    const room = cursorY - splitZoneFloorY;
    // Splits are taken while there is journey left to take them in, and the
    // reserved final stretch is never spent. A world that has run out of room
    // fractionalizes fewer times rather than splitting past its own goal --
    // which is what leaves `mid` and `goal` off the north edge of the grid
    // entirely, and no map at all once the shared verification rejects it.
    if (room < minSegmentRows + minSplitRows) break;

    const targetY = clamp(
      cursorY - Math.round(room / (remainingSlots + 1)),
      splitZoneFloorY + minSplitRows,
      cursorY - minSegmentRows
    );
    const bands = wanderBands(gridW, cursorX, cursorY, targetY, { width: scale.tiles(WIDE_WIDTH), scale });
    paintBands(walkable, gridW, bands);
    const lastBand = bands[bands.length - 1];

    const splitRows = clamp(Math.round(totalRows * 0.1), minSplitRows, Math.min(scale.tiles(10), lastBand.y - splitZoneFloorY));
    const mergedCenter = paintSplitMerge(
      walkable,
      gridW,
      null,
      lastBand.center,
      lastBand.y,
      splitRows,
      scale.tiles(BRANCH_WIDTH),
      scale.tiles(BRANCH_GAP),
      rampRows
    );

    const core = poolCenter(walkable, gridW, lastBand.y - Math.floor(splitRows / 2));
    if (core) featureCores.push(core);

    cursorX = mergedCenter;
    cursorY = lastBand.y - splitRows;
  }

  const finalBands = wanderBands(gridW, cursorX, cursorY, goalY, { width: scale.tiles(WIDE_WIDTH), scale });
  paintBands(walkable, gridW, finalBands);

  const goalBand = finalBands[finalBands.length - 1];
  const goal = { x: Math.round((goalBand.left + goalBand.right) / 2), y: goalBand.y };

  // Picks a row comfortably before the goal rather than a literal midpoint
  // index -- for a short final stretch (a run of bad luck in the split
  // budgeting above), `Math.floor(length/2)` can land on the very last row,
  // putting the guardian's forced chokepoint on top of the goal tile itself.
  const midIdx = Math.max(0, Math.min(Math.floor(finalBands.length / 2), finalBands.length - scale.tiles(3)));
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
