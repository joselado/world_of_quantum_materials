// Plain wide wandering corridor, no per-world physics motif of its own --
// the shape every world used before per-world generators existed. Two
// callers: mapgen.ts's retry loop falls back to this if a world's own
// generator can't produce a valid (reachable, chokepointed) map within its
// attempt budget, and a couple of generators (world6.ts, world9.ts) build
// their own motif as a modification layered on top of this same base shape
// rather than duplicating the wandering-band logic.

import { GeneratedMap, GridPoint, makeColorGrid, makeGrid, paintBands, wanderBands } from './shared';

const CORRIDOR_WIDTH = 7;

export function generateFallbackMap(gridW: number, gridH: number, start: GridPoint): GeneratedMap {
  const goalY = 1;
  const bands = wanderBands(gridW, start.x, start.y, goalY, { width: CORRIDOR_WIDTH });

  const walkable = makeGrid(gridW, gridH);
  paintBands(walkable, gridW, bands);

  const goalBand = bands[bands.length - 1];
  const goal = { x: Math.round((goalBand.left + goalBand.right) / 2), y: goalBand.y };

  const midBand = bands[Math.floor(bands.length / 2)];
  const mid = { x: Math.round((midBand.left + midBand.right) / 2), y: midBand.y };

  return {
    walkable,
    start,
    goal,
    mid,
    regionColor: makeColorGrid(gridW, gridH),
    biomeOverride: makeColorGrid(gridW, gridH),
    vortexCores: [],
  };
}
