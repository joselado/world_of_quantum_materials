// World 6 (classical magnetism, magnons): a mostly steady-width corridor
// whose width periodically bulges wider and narrows back -- a train of
// propagating wave packets laid out along the corridor's length, rather
// than a static sine-offset centerline. Walking the corridor means walking
// through a repeating sequence of pulse crests and troughs.

import { GeneratedMap, GridPoint, clamp, makeColorGrid, makeGrid, paintBand } from './shared';

const BASE_WIDTH = 5;
const BULGE_WIDTH = 5; // extra width added at a pulse's crest
const PULSE_PERIOD = 9; // rows between successive crests
const PULSE_SIGMA = 2.1;

export function generateWorld6Map(gridW: number, gridH: number, start: GridPoint): GeneratedMap {
  const goalY = 1;
  const totalRows = start.y - goalY + 1;
  const half = BASE_WIDTH / 2;
  const minCenter = half;
  const maxCenter = gridW - half;

  const walkable = makeGrid(gridW, gridH);
  const bands: { y: number; left: number; right: number }[] = [];

  let center = clamp(start.x, minCenter, maxCenter);
  let straight = 0;
  for (let i = 0; i < totalRows; i++) {
    const y = start.y - i;

    if (straight >= 3 && Math.random() < 0.35) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      center = clamp(center + dir, minCenter, maxCenter);
      straight = 0;
    } else {
      straight += 1;
    }

    const phase = i % PULSE_PERIOD;
    const distToCrest = Math.min(phase, PULSE_PERIOD - phase);
    const bulge = BULGE_WIDTH * Math.exp(-(distToCrest * distToCrest) / (2 * PULSE_SIGMA * PULSE_SIGMA));
    const width = Math.max(2, Math.round(BASE_WIDTH + bulge));

    const band = paintBand(walkable, gridW, y, center, width);
    if (band) bands.push({ y, ...band });
  }

  const goalBand = bands[bands.length - 1];
  const goal = { x: Math.round((goalBand.left + goalBand.right) / 2), y: goalBand.y };

  const midBand = bands[Math.floor(bands.length / 2)];
  const mid = { x: Math.round((midBand.left + midBand.right) / 2), y: midBand.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride: makeColorGrid(gridW, gridH) , featureCores: [] };
}
