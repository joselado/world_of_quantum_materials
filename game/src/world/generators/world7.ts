// World 7 (entanglement, tensor networks): 3-4 parallel lanes (sites' own
// legs) running most of the corridor's length, linked by periodic cross-link
// "rungs" (bonds) between adjacent lanes -- a ladder that reads as an actual
// tensor-network diagram, not one path with dead-end spurs. Fans out from a
// single corridor near the start, holds the ladder through the middle
// stretch, and fans back into one corridor before the goal; the guardian
// chokepoint forced afterward (mapgen.ts) reads as "compressing the tangled
// network into one walkable path," matching this world's own gate flavor
// (DESIGN.md §2).

import { GeneratedMap, GridPoint, WorldScale, clamp, makeColorGrid, makeGrid, paintBand } from './shared';

const LANE_WIDTH = 3;
const FAN_ROWS = 5;
const RUNG_INTERVAL = 7;
const RUNG_HEIGHT = 2;

export function generateWorld7Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const totalRows = start.y - goalY + 1;
  // How many legs the network has is a count -- the same diagram at every
  // world size, drawn at the size of that world.
  const laneCount = Math.random() < 0.5 ? 3 : 4;
  const baseOffsets = laneCount === 3 ? [-6, 0, 6] : [-9, -3, 3, 9];
  const offsets = baseOffsets.map((off) => off * scale.factor);
  const maxOffset = Math.max(...offsets.map(Math.abs));

  const laneWidth = scale.tiles(LANE_WIDTH);
  const fanRows = scale.tiles(FAN_ROWS);
  const rungInterval = scale.tiles(RUNG_INTERVAL);
  const rungHeight = scale.tiles(RUNG_HEIGHT);
  const holdRows = scale.tiles(3, 1);
  const driftStep = scale.tiles(1, 1);

  const spineHalf = laneWidth / 2;
  const minCenter = maxOffset + spineHalf;
  const maxCenter = gridW - maxOffset - spineHalf;

  const walkable = makeGrid(gridW, gridH);
  // Records the actual painted lane positions per row (not just the shared
  // spine center) -- `goal`/`mid` are picked from these, since the spine
  // center itself only lands on real walkable ground while the lanes are
  // still fanning in/out, not once they're fully separated (an even lane
  // count has no lane sitting exactly on the spine at all).
  const history: { y: number; laneCenters: number[] }[] = [];

  let center = clamp(start.x, minCenter, maxCenter);
  let straight = 0;

  for (let i = 0; i < totalRows; i++) {
    const y = start.y - i;

    if (straight >= holdRows && Math.random() < 0.3 && minCenter < maxCenter) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      center = clamp(center + dir * driftStep, minCenter, maxCenter);
      straight = 0;
    } else {
      straight += 1;
    }

    const fanT = clamp(Math.min(i, totalRows - 1 - i) / fanRows, 0, 1);
    const laneCenters = offsets.map((off) => center + off * fanT);
    history.push({ y, laneCenters });
    laneCenters.forEach((lc) => paintBand(walkable, gridW, y, lc, laneWidth));

    // Rungs only make sense once the lanes are genuinely separate (fanT
    // close to 1) -- bridging adjacent lane pairs with a short walkable
    // span at this row, several rows tall so the crossing itself still
    // clears invariant A.
    if (fanT > 0.85 && i % rungInterval === 0) {
      for (let li = 0; li < laneCenters.length - 1; li++) {
        const leftX = Math.round(laneCenters[li]);
        const rightX = Math.round(laneCenters[li + 1]);
        for (let dy = 0; dy < rungHeight; dy++) {
          const ry = y - dy;
          if (ry < 0) break;
          for (let x = leftX; x <= rightX; x++) walkable[ry][x] = true;
        }
      }
    }
  }

  const goalEntry = history[history.length - 1];
  const goal = { x: Math.round(goalEntry.laneCenters[Math.floor(laneCount / 2)]), y: goalEntry.y };

  const midEntry = history[Math.floor(history.length / 2)];
  const mid = { x: Math.round(midEntry.laneCenters[Math.floor(laneCount / 2)]), y: midEntry.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride: makeColorGrid(gridW, gridH) , featureCores: [] };
}
