// World 4 (Landau levels, quantum Hall effect): a Hofstadter-butterfly-
// inspired self-similar structure -- a wide main corridor (the field-swept
// trunk) sprouts a mirrored pair of side branches at intervals, each of
// which itself sprouts a smaller mirrored pair perpendicular to it, and so
// on for a few scales, every level's length/width shrinking from its
// parent by the same fixed ratio -- a fractal, roughly mirror-symmetric
// structure layered on the trunk, echoing how the butterfly's own spectrum
// repeats a self-similar pattern across scales.

import { GeneratedMap, GridPoint, clamp, inBounds, makeColorGrid, makeGrid, paintBand, paintBands, paintColumnBand, wanderBands } from './shared';

const TRUNK_WIDTH = 7;
const BASE_BRANCH_LEN = 9;
const BASE_BRANCH_WIDTH = 5;
const SELF_SIMILAR_RATIO = 0.55;
const MAX_DEPTH = 3;
const MIN_WIDTH = 2;

type Orientation = 'horizontal' | 'vertical';

function growFractal(
  walkable: boolean[][],
  gridW: number,
  gridH: number,
  root: GridPoint,
  orientation: Orientation,
  length: number,
  width: number,
  depth: number
) {
  if (depth <= 0 || width < MIN_WIDTH || length < 2) return;
  const len = Math.round(length);
  const w = Math.max(MIN_WIDTH, Math.round(width));

  for (const sign of [1, -1]) {
    for (let i = 1; i <= len; i++) {
      const p = orientation === 'horizontal' ? { x: root.x + sign * i, y: root.y } : { x: root.x, y: root.y + sign * i };
      if (!inBounds(p.x, p.y, gridW, gridH)) break;
      if (orientation === 'horizontal') paintColumnBand(walkable, gridH, p.x, root.y, w);
      else paintBand(walkable, gridW, p.y, root.x, w);
    }
    const mid =
      orientation === 'horizontal'
        ? { x: root.x + sign * Math.round(len / 2), y: root.y }
        : { x: root.x, y: root.y + sign * Math.round(len / 2) };
    if (inBounds(mid.x, mid.y, gridW, gridH)) {
      growFractal(walkable, gridW, gridH, mid, orientation === 'horizontal' ? 'vertical' : 'horizontal', length * SELF_SIMILAR_RATIO, width * SELF_SIMILAR_RATIO, depth - 1);
    }
  }
}

export function generateWorld4Map(gridW: number, gridH: number, start: GridPoint): GeneratedMap {
  const goalY = 1;
  const bands = wanderBands(gridW, start.x, start.y, goalY, { width: TRUNK_WIDTH, driftChance: 0.3 });

  const walkable = makeGrid(gridW, gridH);
  paintBands(walkable, gridW, bands);

  const branchPointCount = clamp(Math.round(bands.length / 9), 3, 6);
  for (let i = 1; i <= branchPointCount; i++) {
    const idx = clamp(Math.round((i / (branchPointCount + 1)) * bands.length), 3, bands.length - 4);
    const band = bands[idx];
    growFractal(walkable, gridW, gridH, { x: band.center, y: band.y }, 'horizontal', BASE_BRANCH_LEN, BASE_BRANCH_WIDTH, MAX_DEPTH);
  }

  const goalBand = bands[bands.length - 1];
  const goal = { x: Math.round((goalBand.left + goalBand.right) / 2), y: goalBand.y };

  const midBand = bands[Math.floor(bands.length / 2)];
  const mid = { x: Math.round((midBand.left + midBand.right) / 2), y: midBand.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride: makeColorGrid(gridW, gridH) , vortexCores: [] };
}
