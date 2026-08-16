// World 9 (excitations and defects): a wide plain of scorched clay carrying
// two kinds of defect, which is what this world's topic actually is -- a
// defect is a local disturbance in an otherwise good crystal, so the sample
// has to be mostly good crystal for one to read as a defect at all.
//
//  - **Substitutional**: a patch rendered with one of worlds 1-8's own biome
//    look (art/biomes.ts) instead of this world's, so several patches in the
//    same map read as different defect *types* rather than one borrowed look.
//    It changes nothing about the shape -- the wrong atom sits on the right
//    site, and the player walks over it.
//  - **Vacancy**: a hole punched clean out of the plain, molten crust in the
//    gap where the lattice is missing. This one the player has to walk
//    around, which is the difference between a site occupied wrongly and a
//    site not occupied at all.
//
// Both are counts held fixed across world sizes while their radii scale, so
// the defect concentration the player walks through is the same in a Nano
// world as in a Macro one -- which is what makes them defects in a material
// rather than a decoration sprinkled per tile.

import {
  bandWindow,
  GeneratedMap,
  GridPoint,
  WorldScale,
  clamp,
  discIsland,
  inBounds,
  makeColorGrid,
  makeGrid,
  paintBands,
  punchIslands,
  wanderBands,
  widestRunCenter,
} from './shared';

const FIELD_WIDTH = 14;
// The plain drifts gently. A vacancy needs the same ground held across every
// row it touches plus the way around it, and a corridor that swings hard
// leaves no window wide enough to take one -- which would quietly leave the
// Defect Scars with no vacancies in it.
const FIELD_DRIFT_CHANCE = 0.25;
const FIELD_MAX_STEP = 1;
const PASSAGE_MIN = 2;
const PATCH_COUNT_MIN = 3;
const PATCH_COUNT_MAX = 6;
const PATCH_RADIUS_MIN = 2;
const PATCH_RADIUS_MAX = 4;
const VACANCY_COUNT_MIN = 3;
const VACANCY_COUNT_MAX = 5;
const VACANCY_RADIUS_MIN = 2;
const VACANCY_RADIUS_MAX = 3;
const SOURCE_WORLDS = [1, 2, 3, 4, 5, 6, 7, 8];

export function generateWorld9Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const bands = wanderBands(gridW, start.x, start.y, goalY, {
    width: scale.tiles(FIELD_WIDTH),
    driftChance: FIELD_DRIFT_CHANCE,
    maxStep: FIELD_MAX_STEP,
    scale,
  });

  const walkable = makeGrid(gridW, gridH);
  paintBands(walkable, gridW, bands);

  const endClearance = scale.tiles(3);
  const interior = () => bands[endClearance + Math.floor(Math.random() * Math.max(1, bands.length - 2 * endClearance))];

  // The guardian's row is settled before anything is punched, and kept clear
  // of vacancies: the chokepoint pass wipes that row down to a three-tile gap,
  // and a hole beside the gap is what turns the guardian's doorway into a
  // dead end.
  const midBand = bands[Math.floor(bands.length / 2)];

  // A vacancy of this size on this row, centred on ground every row it touches
  // holds in common -- the plain drifts, so the row's own span is not enough to
  // place against, and a hole offered past what its neighbours cover is a hole
  // the shared pass refuses.
  const vacancyAt = (y: number, radius: number): GridPoint[] | null => {
    const index = start.y - y;
    if (index < 0 || index >= bands.length) return null;
    if (Math.abs(y - midBand.y) <= radius + PASSAGE_MIN) return null;
    const reach = radius + PASSAGE_MIN;
    const window = bandWindow(bands, index, reach);
    const lo = window.left + reach;
    const hi = window.right - reach;
    if (hi < lo) return null;
    const cx = clamp(lo + Math.floor(Math.random() * (hi - lo + 1)), radius, gridW - radius - 1);
    return discIsland(cx, y, radius);
  };

  // Spaced along the plain rather than scattered: two holes closer than their
  // own radii plus the way between them cannot both exist, so offering them at
  // random rows mostly offers pairs that refuse each other.
  const vacancies: GridPoint[][] = [];
  const vacancyCount = VACANCY_COUNT_MIN + Math.floor(Math.random() * (VACANCY_COUNT_MAX - VACANCY_COUNT_MIN + 1));
  for (let v = 1; v <= vacancyCount; v++) {
    const targetY = start.y - Math.round((bands.length * v) / (vacancyCount + 1));
    const radius = scale.tiles(VACANCY_RADIUS_MIN + Math.floor(Math.random() * (VACANCY_RADIUS_MAX - VACANCY_RADIUS_MIN + 1)), 1);
    const jitter = Math.floor(Math.random() * 5) - 2;
    const vacancy = vacancyAt(targetY + jitter, radius);
    if (vacancy) vacancies.push(vacancy);
  }
  punchIslands(walkable, gridW, gridH, vacancies, PASSAGE_MIN);

  const biomeOverride = makeColorGrid(gridW, gridH);
  const patchCount = PATCH_COUNT_MIN + Math.floor(Math.random() * (PATCH_COUNT_MAX - PATCH_COUNT_MIN + 1));
  for (let p = 0; p < patchCount; p++) {
    const band = interior();
    if (!band) continue;
    const cx = band.left + Math.floor(Math.random() * (band.right - band.left + 1));
    const radius = scale.tiles(PATCH_RADIUS_MIN + Math.floor(Math.random() * (PATCH_RADIUS_MAX - PATCH_RADIUS_MIN + 1)), 1);
    const source = SOURCE_WORLDS[Math.floor(Math.random() * SOURCE_WORLDS.length)];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const x = cx + dx;
        const y = band.y + dy;
        if (inBounds(x, y, gridW, gridH)) biomeOverride[y][x] = source;
      }
    }
  }

  // Both landmarks come off the finished plain, since a vacancy may have
  // taken the middle of the row they would otherwise have stood on.
  const goalBand = bands[bands.length - 1];
  const goal = { x: widestRunCenter(walkable, gridW, goalBand.y) ?? goalBand.center, y: goalBand.y };
  const mid = { x: widestRunCenter(walkable, gridW, midBand.y) ?? midBand.center, y: midBand.y };

  return { walkable, start, goal, mid, regionColor: makeColorGrid(gridW, gridH), biomeOverride, featureCores: [] };
}
