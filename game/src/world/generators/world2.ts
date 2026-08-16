// World 2 (Bloch's theorem, tight-binding, periodicity): an open cloister
// floor with the lattice standing in it. The walkable ground is a
// straight-walled hall running the length of the world, and the columns are
// impassable tiles on a strictly periodic lattice inside that hall, so the
// player walks *through* a periodic array of scatterers rather than along a
// path drawn beside one. That is what tight-binding motion is, and it is why
// this world's ground can be open without giving up its physics: the
// periodicity is carried by what stands in the floor, not by the outline of a
// corridor.
//
// The lattice carries a two-atom basis across the hall: each cell holds a pair
// of columns with a narrow aisle between them and a wide one through to the
// next pair -- the short and long bonds of a dimerized chain, walkable instead
// of drawn. Along the hall it is a simple period, so the basis reads on the
// one axis the player can see across.
//
// Every wall of this world is itself colonnade: the impassable ground beyond
// the hall renders as the same columns at the same spacing
// (scenes/overworld/terrain/materials/columns.ts), so the hall is an aisle
// through a column field that continues in both directions rather than a room
// with sides.
//
// What varies per visit is the lattice phase and nothing else -- where in the
// crystal the player entered. A perfect crystal is the same everywhere, and
// translating it by a lattice vector is the exact symmetry this world is named
// for, so a fresh map is a fresh entry point rather than a different building.

import {
  GeneratedMap,
  GridPoint,
  MIN_SEGMENT_WIDTH,
  WorldScale,
  clamp,
  makeColorGrid,
  makeGrid,
  punchIslands,
  widestRunCenter,
} from './shared';

// The hall is a length of the map, so it scales with the world.
const HALL_WIDTH = 14;
// How much colonnade is kept standing beyond the hall on either side. The
// surround is where this world's identity lives (WORLDS.md), and a hall run
// out to the grid edge would leave the columns only in the distance, where the
// projection has already shrunk them to nothing.
const SURROUND_MIN = 3;

// The unit cell, and the one geometry here the world-size setting leaves alone
// (with World 6's magnon wavelength). A lattice constant is a length of the
// material, not of the map: a bigger crystal is more unit cells, not stretched
// ones. So the hall gets wider with the world while the lattice keeps its own
// period, and a Macro world simply holds more columns across the same aisles.
const CELL_WIDTH = 8; // one unit cell across the hall
const BASIS_OFFSET = 3; // the cell's second atom -- aisles of 2 and 4 tiles
const ROW_PERIOD = 3; // lattice rows along the hall's length

// Landmarks stand in open floor, not in an aisle a column has just narrowed,
// and the tiles around the entrance stay clear so the player never arrives
// inside the lattice.
const LANDMARK_CLEARANCE = 3;

export function generateWorld2Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const walkable = makeGrid(gridW, gridH);

  // The hall: straight-walled and constant-width, the one built thing in the
  // game. Every other world's ground wanders, and this one deliberately does
  // not -- WORLDS.md's contrast against World 1 is organic against geometric,
  // and a cloister that drifts is a ruin.
  const hallWidth = clamp(scale.tiles(HALL_WIDTH), MIN_SEGMENT_WIDTH, gridW - 2 * SURROUND_MIN);
  const left = clamp(start.x - Math.floor(hallWidth / 2), SURROUND_MIN, gridW - SURROUND_MIN - hallWidth);
  const right = left + hallWidth - 1;
  for (let y = goalY; y <= start.y; y++) {
    for (let x = left; x <= right; x++) walkable[y][x] = true;
  }

  // The lattice phase -- which part of the crystal this visit walks into.
  const phaseX = Math.floor(Math.random() * CELL_WIDTH);
  const phaseY = Math.floor(Math.random() * ROW_PERIOD);

  const bases: GridPoint[][] = [];
  for (let y = goalY + phaseY; y <= start.y; y += ROW_PERIOD) {
    // Every column is one tile, so a candidate is a one-tile island; the
    // shared pass is what keeps the aisles between them walkable and drops
    // the ones the hall had no room for, including any that would stand on
    // the player's own entrance.
    for (let cell = left - CELL_WIDTH; cell <= right; cell += CELL_WIDTH) {
      for (const offset of [0, BASIS_OFFSET]) {
        const x = cell + ((phaseX + offset) % CELL_WIDTH);
        if (x < left || x > right) continue;
        if (Math.abs(x - start.x) <= LANDMARK_CLEARANCE && Math.abs(y - start.y) <= LANDMARK_CLEARANCE) continue;
        bases.push([{ x, y }]);
      }
    }
  }
  const featureCores = punchIslands(walkable, gridW, gridH, bases);

  // Both landmarks are read back off the finished floor rather than predicted
  // from the lattice: the widest run on a row is open aisle whatever the
  // columns did to it, which is where a boss and a guardian belong.
  const goalX = widestRunCenter(walkable, gridW, goalY) ?? Math.round((left + right) / 2);
  const goal = { x: goalX, y: goalY };

  // The guardian stands on a row the lattice skipped, so the chokepoint's own
  // wall is the only thing crossing the hall there. Kept clear of both ends,
  // since the shared pass tapers those into the world's entry and exit.
  const midY = midRow(start.y, goalY, phaseY, scale);
  const mid = { x: widestRunCenter(walkable, gridW, midY) ?? goalX, y: midY };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride: makeColorGrid(gridW, gridH), featureCores };
}

// A row roughly halfway along the hall that carries no lattice row, held a
// comfortable distance from both the entrance and the goal.
function midRow(startY: number, goalY: number, phaseY: number, scale: WorldScale): number {
  const margin = scale.tiles(4);
  const target = clamp(Math.round((startY + goalY) / 2), goalY + margin, startY - margin);
  for (let step = 0; step < ROW_PERIOD; step++) {
    const y = target - step;
    if (y > goalY && (y - goalY - phaseY) % ROW_PERIOD !== 0) return y;
  }
  return target;
}
