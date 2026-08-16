// World 6 (classical magnetism, magnons): an open plain of black iron-sand
// with the magnetic order standing up out of it. A steppe is a plain by
// definition, so the ground is wide and the shards are what the player walks
// among rather than what lines a route.
//
// The shards stand in transverse wavefronts: a train of bars running across
// the plain, one wavelength apart down its length, each successive front
// offset sideways from the last so the train reads as travelling rather than
// as a fence repeated. That is a spin wave drawn as the thing it is -- a
// periodic disturbance of an ordered medium, moving through it -- and it puts
// the world's own topic in the ground the player crosses instead of in the
// width of a corridor.
//
// The wavelength is a property of the magnet, not of the map (with World 2's
// unit cell, the geometry the world-size setting leaves alone): a bigger
// world is more wave packets at the same wavelength, riding a proportionally
// wider plain.

import {
  GeneratedMap,
  GridPoint,
  WorldScale,
  makeColorGrid,
  makeGrid,
  paintBands,
  punchIslands,
  wanderBands,
  widestRunCenter,
} from './shared';

const FIELD_WIDTH = 14;
const PULSE_PERIOD = 9; // rows between successive wavefronts -- the wavelength
const SHARD_LENGTH = 2; // one clump of shards, in tiles across
const SHARD_SPACING = 4; // clump to clump along a wavefront, leaving 2-tile gaps
const CREST_DRIFT = 2; // how far each wavefront is offset from the one behind it

export function generateWorld6Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const bands = wanderBands(gridW, start.x, start.y, goalY, { width: scale.tiles(FIELD_WIDTH), scale });

  const walkable = makeGrid(gridW, gridH);
  paintBands(walkable, gridW, bands);

  // Settled before anything is punched: the guardian's row is wiped to a
  // three-tile gap by the chokepoint pass, and a shard clump beside that gap
  // would close the doorway.
  const midBand = bands[Math.floor(bands.length / 2)];
  const phase = Math.floor(Math.random() * PULSE_PERIOD);

  const clumps: GridPoint[][] = [];
  for (let i = 0; i < bands.length; i++) {
    if ((i + phase) % PULSE_PERIOD !== 0) continue;
    const band = bands[i];
    if (Math.abs(band.y - midBand.y) <= 2) continue;
    const crest = Math.floor((i + phase) / PULSE_PERIOD);
    const drift = (crest * CREST_DRIFT) % SHARD_SPACING;
    for (let x = band.left + drift; x + SHARD_LENGTH - 1 <= band.right; x += SHARD_SPACING) {
      const clump: GridPoint[] = [];
      for (let dx = 0; dx < SHARD_LENGTH; dx++) clump.push({ x: x + dx, y: band.y });
      clumps.push(clump);
    }
  }
  // Whatever the plain had room for. A wavefront thins where the ground
  // narrows rather than crowding it, which is also what keeps every gap
  // between two clumps walkable.
  punchIslands(walkable, gridW, gridH, clumps);

  const goalBand = bands[bands.length - 1];
  const goal = { x: widestRunCenter(walkable, gridW, goalBand.y) ?? goalBand.center, y: goalBand.y };
  const mid = { x: widestRunCenter(walkable, gridW, midBand.y) ?? midBand.center, y: midBand.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride: makeColorGrid(gridW, gridH), featureCores: [] };
}
