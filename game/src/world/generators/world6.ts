// World 6 (classical magnetism, magnons): a mostly steady-width corridor
// whose width periodically bulges wider and narrows back -- a train of
// propagating wave packets laid out along the corridor's length, rather
// than a static sine-offset centerline. Walking the corridor means walking
// through a repeating sequence of pulse crests and troughs.

import { GeneratedMap, GridPoint, MIN_SEGMENT_WIDTH, WorldScale, clamp, makeColorGrid, makeGrid, paintBand } from './shared';

const BASE_WIDTH = 5;
const BULGE_WIDTH = 5; // extra width added at a pulse's crest
// The wave itself, and (with World 2's unit cell) the geometry the world-size
// setting leaves alone: a magnon's wavelength is a property of the magnet,
// not of how much of it there is. A bigger world is more wave packets at the
// same wavelength, riding a proportionally wider corridor.
const PULSE_PERIOD = 9; // rows between successive crests
const PULSE_SIGMA = 2.1;

export function generateWorld6Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const totalRows = start.y - goalY + 1;
  const baseWidth = scale.tiles(BASE_WIDTH);
  const bulgeWidth = scale.tiles(BULGE_WIDTH);
  const half = baseWidth / 2;
  const minCenter = half;
  const maxCenter = gridW - half;
  const holdRows = scale.tiles(3, 1);
  const driftStep = scale.tiles(1, 1);

  const walkable = makeGrid(gridW, gridH);
  const bands: { y: number; left: number; right: number }[] = [];

  let center = clamp(start.x, minCenter, maxCenter);
  let straight = 0;
  for (let i = 0; i < totalRows; i++) {
    const y = start.y - i;

    if (straight >= holdRows && Math.random() < 0.35) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      center = clamp(center + dir * driftStep, minCenter, maxCenter);
      straight = 0;
    } else {
      straight += 1;
    }

    const phase = i % PULSE_PERIOD;
    const distToCrest = Math.min(phase, PULSE_PERIOD - phase);
    const bulge = bulgeWidth * Math.exp(-(distToCrest * distToCrest) / (2 * PULSE_SIGMA * PULSE_SIGMA));
    const width = Math.max(MIN_SEGMENT_WIDTH, Math.round(baseWidth + bulge));

    const band = paintBand(walkable, gridW, y, center, width);
    if (band) bands.push({ y, ...band });
  }

  const goalBand = bands[bands.length - 1];
  const goal = { x: Math.round((goalBand.left + goalBand.right) / 2), y: goalBand.y };

  const midBand = bands[Math.floor(bands.length / 2)];
  const mid = { x: Math.round((midBand.left + midBand.right) / 2), y: midBand.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride: makeColorGrid(gridW, gridH) , featureCores: [] };
}
