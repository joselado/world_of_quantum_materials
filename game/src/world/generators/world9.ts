// World 9 (excitations and defects): an ordinary wide corridor with several
// small patches embedded along it, each patch independently and randomly
// rendered using one of worlds 1-8's own biome look (art/biomes.ts) instead
// of this world's own -- so several impurity patches in the same map read
// as different defect *types*, not one uniform borrowed look. The patch
// itself doesn't change the walkable shape at all (a defect is a local
// texture, not a detour) -- it only tags the tiles it covers with
// `biomeOverride`, consumed on the rendering side (OverworldScene's terrain plan)
// to swap which biome table that tile's fill/wall colors come from.

import { GeneratedMap, GridPoint, inBounds, makeColorGrid, wanderBands, paintBands, makeGrid } from './shared';

const CORRIDOR_WIDTH = 7;
const PATCH_COUNT_MIN = 3;
const PATCH_COUNT_MAX = 6;
const PATCH_RADIUS_MIN = 2;
const PATCH_RADIUS_MAX = 4;
const SOURCE_WORLDS = [1, 2, 3, 4, 5, 6, 7, 8];

export function generateWorld9Map(gridW: number, gridH: number, start: GridPoint): GeneratedMap {
  const goalY = 1;
  const bands = wanderBands(gridW, start.x, start.y, goalY, { width: CORRIDOR_WIDTH });

  const walkable = makeGrid(gridW, gridH);
  paintBands(walkable, gridW, bands);

  const biomeOverride = makeColorGrid(gridW, gridH);
  const patchCount = PATCH_COUNT_MIN + Math.floor(Math.random() * (PATCH_COUNT_MAX - PATCH_COUNT_MIN + 1));
  for (let p = 0; p < patchCount; p++) {
    const band = bands[2 + Math.floor(Math.random() * Math.max(1, bands.length - 4))];
    if (!band) continue;
    const cx = band.left + Math.floor(Math.random() * (band.right - band.left + 1));
    const cy = band.y;
    const radius = PATCH_RADIUS_MIN + Math.floor(Math.random() * (PATCH_RADIUS_MAX - PATCH_RADIUS_MIN + 1));
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
