// World 5 (superconductivity, Majorana): the main corridor spirals briefly
// around one or two fixed, permanently-blocked "vortex core" points at a
// few rows along its length -- a literal Abrikosov vortex the supercurrent
// has to wind around -- before straightening back out and continuing on to
// the goal.
//
// The cores are returned in `featureCores` and cleared back to blocked after
// every band, spiral and join has been painted. Both matter. The spiral's own
// brush and the join carve out of the last core each pass close enough to the
// centre to fill it, so a core protected only where it is placed is a core the
// next stroke walks over; and the renderer is told which tiles are cores
// rather than guessing from the shape, since that is what puts the pit exactly
// where the physics puts it (materials/ice.ts).

import { GeneratedMap, GridPoint, carveThickPath, clamp, inBounds, makeColorGrid, makeGrid, paintBands, wanderBands } from './shared';
import type { WanderBand } from './shared';

const TRUNK_WIDTH = 6;
const SPIRAL_WIDTH = 4;
const SPIRAL_R_MAX = 8;
const SPIRAL_R_MIN = 2.2;
const SPIRAL_TURNS = 1.3;

function paintSpiral(walkable: boolean[][], gridW: number, gridH: number, core: GridPoint, direction: 1 | -1): { entry: GridPoint; exit: GridPoint } {
  const steps = Math.round(SPIRAL_TURNS * 48);
  const half = Math.floor(SPIRAL_WIDTH / 2);
  let entry: GridPoint = core;
  let exit: GridPoint = core;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = direction * t * SPIRAL_TURNS * 2 * Math.PI;
    const r = SPIRAL_R_MAX - (SPIRAL_R_MAX - SPIRAL_R_MIN) * t;
    const px = Math.round(core.x + r * Math.cos(theta));
    const py = Math.round(core.y + r * Math.sin(theta));
    for (let dx = -half; dx < SPIRAL_WIDTH - half; dx++) {
      for (let dy = -half; dy < SPIRAL_WIDTH - half; dy++) {
        const xx = px + dx;
        const yy = py + dy;
        if (inBounds(xx, yy, gridW, gridH)) walkable[yy][xx] = true;
      }
    }
    if (i === 0) entry = { x: px, y: py };
    if (i === steps) exit = { x: px, y: py };
  }
  return { entry, exit };
}

export function generateWorld5Map(gridW: number, gridH: number, start: GridPoint): GeneratedMap {
  const goalY = 1;
  const totalRows = start.y - goalY + 1;
  const vortexCount = Math.random() < 0.5 ? 1 : 2;
  const fracs = vortexCount === 1 ? [0.48] : [0.28, 0.66];

  const walkable = makeGrid(gridW, gridH);
  const allBands: WanderBand[] = [];
  const featureCores: GridPoint[] = [];

  let segStartX = start.x;
  let segStartY = start.y;

  fracs.forEach((frac) => {
    const targetY = start.y - Math.round(totalRows * frac);
    const approachY = clamp(targetY + 6, goalY + 4, segStartY - 1);
    const segBands = wanderBands(gridW, segStartX, segStartY, approachY, { width: TRUNK_WIDTH });
    paintBands(walkable, gridW, segBands);
    allBands.push(...segBands);

    const lastBand = segBands[segBands.length - 1];
    const side = Math.random() < 0.5 ? 1 : -1;
    const core = { x: clamp(lastBand.center + side * (SPIRAL_R_MAX + 2), SPIRAL_R_MAX + 2, gridW - SPIRAL_R_MAX - 2), y: targetY };
    featureCores.push(core);
    const { entry, exit } = paintSpiral(walkable, gridW, gridH, core, side as 1 | -1);
    carveThickPath(walkable, gridW, gridH, { x: lastBand.center, y: approachY }, entry, SPIRAL_WIDTH);

    segStartX = exit.x;
    segStartY = exit.y - 1;
  });

  const finalBands = wanderBands(gridW, segStartX, segStartY, goalY, { width: TRUNK_WIDTH });
  paintBands(walkable, gridW, finalBands);
  if (finalBands.length) carveThickPath(walkable, gridW, gridH, { x: segStartX, y: segStartY + 1 }, { x: finalBands[0].center, y: finalBands[0].y }, TRUNK_WIDTH - 2);
  allBands.push(...finalBands);

  for (const core of featureCores) walkable[core.y][core.x] = false;

  const goalBand = finalBands[finalBands.length - 1] ?? allBands[allBands.length - 1];
  const goal = { x: Math.round((goalBand.left + goalBand.right) / 2), y: goalBand.y };

  // Comfortably before the goal, not a literal midpoint index -- see
  // world8.ts's own note on why a short final stretch needs this guard.
  const midIdx = Math.max(0, Math.min(Math.floor(allBands.length / 2), allBands.length - 3));
  const midBand = allBands[midIdx] ?? goalBand;
  const mid = { x: Math.round((midBand.left + midBand.right) / 2), y: midBand.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride: makeColorGrid(gridW, gridH), featureCores };
}
