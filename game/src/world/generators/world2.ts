// World 2 (Bloch's theorem, tight-binding, periodicity): a genuinely
// periodic corridor -- a short motif shape repeats via translation down the
// whole length, and on top of that fixed period, the centerline also
// alternates between two different horizontal offsets every single row (a
// two-atom unit cell, the way a diatomic/dimerized chain's two basis atoms
// sit at two different offsets within one repeated cell rather than one).
// The result reads as a woven, lattice-like path rather than one smoothly
// wandering line.

import { GeneratedMap, GridPoint, WorldScale, makeColorGrid, makeGrid, paintBand } from './shared';

const WIDTH = 5;
// The unit cell, and the only geometry in the game the world-size setting
// leaves alone (with World 6's magnon wavelength). A lattice constant is a
// length of the material, not of the map: a bigger crystal is more unit
// cells, not stretched ones. So the corridor gets wider with the world while
// the weave keeps its own period and amplitude, and a Macro world simply
// contains more of it.
const MOTIF: number[] = [0, 2, 4, 5, 4, 2]; // one periodic unit cell's envelope, period 6
const SUBLATTICE_SHIFT = 2; // the two basis atoms' own offset within a cell

// The narrowest this corridor may be built, which the unit cell decides
// rather than the world size: the centerline moves by up to this much from
// one row to the next (the envelope's own biggest step, plus the sublattice
// flipping sides every row), and a band narrower than that step lands clear
// of the band above it, leaving a lattice of disconnected rungs with no route
// through. The physical reading is the same as the geometric one -- the
// lattice constant is fixed, so a crystal cannot be thinner than its own unit
// cell, however small a world it sits in.
function minLatticeWidth(): number {
  let biggestStep = 0;
  for (let i = 0; i < MOTIF.length; i++) {
    const step = Math.abs(MOTIF[(i + 1) % MOTIF.length] - MOTIF[i]);
    biggestStep = Math.max(biggestStep, step);
  }
  return biggestStep + SUBLATTICE_SHIFT + 1;
}

export function generateWorld2Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const totalRows = start.y - goalY + 1;
  const width = Math.max(scale.tiles(WIDTH), minLatticeWidth());
  const half = width / 2;
  const minCenter = half;
  const maxCenter = gridW - half;
  const baseCenter = Math.min(maxCenter, Math.max(minCenter, start.x));

  const walkable = makeGrid(gridW, gridH);
  const bands: { y: number; left: number; right: number }[] = [];

  for (let i = 0; i < totalRows; i++) {
    const y = start.y - i;
    const envelope = MOTIF[i % MOTIF.length] - MOTIF[Math.floor(MOTIF.length / 2)];
    const sublattice = i % 2 === 0 ? -SUBLATTICE_SHIFT / 2 : SUBLATTICE_SHIFT / 2;
    const center = Math.min(maxCenter, Math.max(minCenter, baseCenter + envelope + sublattice));
    const band = paintBand(walkable, gridW, y, center, width);
    if (band) bands.push({ y, ...band });
  }

  const goalBand = bands[bands.length - 1];
  const goal = { x: Math.round((goalBand.left + goalBand.right) / 2), y: goalBand.y };

  const midBand = bands[Math.floor(bands.length / 2)];
  const mid = { x: Math.round((midBand.left + midBand.right) / 2), y: midBand.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride: makeColorGrid(gridW, gridH) , featureCores: [] };
}
