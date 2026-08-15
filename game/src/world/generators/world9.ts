// World 9 (excitations and defects): an ordinary wide corridor with several
// small patches embedded along it, each patch independently and randomly
// rendered using one of worlds 1-8's own biome look (art/biomes.ts) instead
// of this world's own -- so several impurity patches in the same map read
// as different defect *types*, not one uniform borrowed look. The patch
// itself doesn't change the walkable shape at all (a defect is a local
// texture, not a detour) -- it only tags the tiles it covers with
// `biomeOverride`, consumed on the rendering side (OverworldScene's terrain plan)
// to swap which biome table that tile's fill/wall colors come from.

import { GeneratedMap, GridPoint, WorldScale, inBounds, makeColorGrid, wanderBands, paintBands, makeGrid } from './shared';

const CORRIDOR_WIDTH = 7;
// How many defects the sample carries. A count, held fixed while their radii
// scale with the world: patch area and corridor area then grow together, so
// the defect concentration the player walks through is the same in a Nano
// world as in a Macro one, which is what makes them defects in a material
// rather than a decoration sprinkled per tile.
const PATCH_COUNT_MIN = 3;
const PATCH_COUNT_MAX = 6;
const PATCH_RADIUS_MIN = 2;
const PATCH_RADIUS_MAX = 4;
const SOURCE_WORLDS = [1, 2, 3, 4, 5, 6, 7, 8];

export function generateWorld9Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const bands = wanderBands(gridW, start.x, start.y, goalY, { width: scale.tiles(CORRIDOR_WIDTH), scale });

  const walkable = makeGrid(gridW, gridH);
  paintBands(walkable, gridW, bands);

  const biomeOverride = makeColorGrid(gridW, gridH);
  const patchCount = PATCH_COUNT_MIN + Math.floor(Math.random() * (PATCH_COUNT_MAX - PATCH_COUNT_MIN + 1));
  const endClearance = scale.tiles(2);
  for (let p = 0; p < patchCount; p++) {
    const band = bands[endClearance + Math.floor(Math.random() * Math.max(1, bands.length - 2 * endClearance))];
    if (!band) continue;
    const cx = band.left + Math.floor(Math.random() * (band.right - band.left + 1));
    const cy = band.y;
    const radius = scale.tiles(PATCH_RADIUS_MIN + Math.floor(Math.random() * (PATCH_RADIUS_MAX - PATCH_RADIUS_MIN + 1)), 1);
    const source = SOURCE_WORLDS[Math.floor(Math.random() * SOURCE_WORLDS.length)];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (inBounds(x, y, gridW, gridH)) biomeOverride[y][x] = source;
      }
    }
  }

  const goalBand = bands[bands.length - 1];
  const goal = { x: Math.round((goalBand.left + goalBand.right) / 2), y: goalBand.y };

  const midBand = bands[Math.floor(bands.length / 2)];
  const mid = { x: Math.round((midBand.left + midBand.right) / 2), y: midBand.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride , featureCores: [] };
}
