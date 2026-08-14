// Per-world overworld layout: dispatches to one generator file per world
// (generators/world1.ts .. world10.ts, each named after that world's own
// course topic -- see generators/shared.ts's module comment and
// dev_notes/CODEMAP.md) rather than one shape shared by all ten. Every
// generator hands back its own walkable shape plus a `mid` point roughly on
// its own spine; this module then runs the same passes on all ten uniformly:
//
//  1. forceChokepoint -- walls off the guardian's row except a small gap
//     centered on `mid`, so every route from `start` to `goal` is provably
//     forced through it (invariant B, DESIGN.md §2/CODEMAP.md).
//  2. narrowGoalPass/openStartMouth -- the corridor tapers into a pass at the
//     goal and opens out of one at the start, so world N's entry is the same
//     piece of geography as world N-1's exit.
//  3. deriveRows/scatterTokens -- encounter-row sampling and qumatessence
//     placement, computed from whatever the final walkable grid actually
//     looks like rather than something each generator has to reason about,
//     and kept out of both passes.
//
// Generation is randomized and runs on every world entry (a fresh corridor
// each time, same as before per-world generators existed), so a shape that
// fails either invariant just gets regenerated with fresh randomness rather
// than crashing the scene -- see generateWorldMap's retry loop.

import type { MaterialType } from '../data/types';
import { generateFallbackMap } from './generators/fallback';
import {
  CorridorRow,
  GeneratedMap,
  GridPoint,
  NullableNumberGrid,
  deriveRows,
  forceChokepoint,
  narrowGoalPass,
  openStartMouth,
  passZoneRows,
  reachable,
  scatterTokens,
  verifyChokepoint,
} from './generators/shared';
import { generateWorld1Map } from './generators/world1';
import { generateWorld2Map } from './generators/world2';
import { generateWorld3Map } from './generators/world3';
import { generateWorld4Map } from './generators/world4';
import { generateWorld5Map } from './generators/world5';
import { generateWorld6Map } from './generators/world6';
import { generateWorld7Map } from './generators/world7';
import { generateWorld8Map } from './generators/world8';
import { generateWorld9Map } from './generators/world9';
import { generateWorld10Map } from './generators/world10';

export type { GridPoint } from './generators/shared';

export interface WorldMap {
  walkable: boolean[][]; // [y][x] -- every walkable tile, whatever that world's own shape is
  tokens: number[][]; // [y][x] -- qumatessence value at a scattered handful of tiles, 0 = none
  rows: CorridorRow[]; // one entry per occupied grid row, for row-based encounter placement
  start: GridPoint;
  goal: GridPoint;
  mid: GridPoint; // this world's guardian stands here, and every route is forced through it
  regionColor: NullableNumberGrid; // per-tile tint (world 1's/3's/8's colored branches/domains)
  biomeOverride: NullableNumberGrid; // per-tile "render with world K's biome instead" (world 9's patches)
}

const MAX_ATTEMPTS = 10;

function buildWorldShape(gridW: number, gridH: number, start: GridPoint, world: number, playerType?: MaterialType): GeneratedMap {
  switch (world) {
    case 1:
      return generateWorld1Map(gridW, gridH, start);
    case 2:
      return generateWorld2Map(gridW, gridH, start);
    case 3:
      return generateWorld3Map(gridW, gridH, start);
    case 4:
      return generateWorld4Map(gridW, gridH, start);
    case 5:
      return generateWorld5Map(gridW, gridH, start);
    case 6:
      return generateWorld6Map(gridW, gridH, start);
    case 7:
      return generateWorld7Map(gridW, gridH, start);
    case 8:
      return generateWorld8Map(gridW, gridH, start);
    case 9:
      return generateWorld9Map(gridW, gridH, start);
    case 10:
      return generateWorld10Map(gridW, gridH, start, playerType);
    default:
      return generateFallbackMap(gridW, gridH, start);
  }
}

export function generateWorldMap(gridW: number, gridH: number, start: GridPoint, world: number, playerType?: MaterialType): WorldMap {
  let result: GeneratedMap | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS && !result; attempt++) {
    const candidate = buildWorldShape(gridW, gridH, start, world, playerType);
    forceChokepoint(candidate.walkable, gridW, candidate.mid);
    // After the chokepoint, so the pass wins where the two would ever land on
    // the same row; verifyChokepoint below then rejects the shape if the
    // taper cost the guardian its forced crossing, and the retry loop rolls
    // another.
    narrowGoalPass(candidate.walkable, gridW, gridH, candidate.goal, candidate.mid);
    openStartMouth(candidate.walkable, gridW, gridH, candidate.start, candidate.mid);
    if (!reachable(candidate.walkable, gridW, gridH, candidate.start, candidate.goal)) continue;
    if (!verifyChokepoint(candidate.walkable, gridW, gridH, candidate.start, candidate.goal, candidate.mid)) continue;
    result = candidate;
  }

  if (!result) {
    console.error(`mapgen: world ${world} failed to produce a valid chokepointed map after ${MAX_ATTEMPTS} attempts -- falling back to the plain corridor`);
    result = generateFallbackMap(gridW, gridH, start);
    forceChokepoint(result.walkable, gridW, result.mid);
    narrowGoalPass(result.walkable, gridW, gridH, result.goal, result.mid);
    openStartMouth(result.walkable, gridW, gridH, result.start, result.mid);
  }

  // Nothing spawns inside either pass. Encounters are sampled per corridor
  // row, so dropping those rows here keeps them out; tokens are placed by
  // tile and take the same row set.
  const passRows = passZoneRows(result.start, result.goal, result.mid);
  const rows = deriveRows(result.walkable, gridW, gridH).filter((r) => !passRows.has(r.y));
  const tokens = scatterTokens(
    result.walkable,
    gridW,
    gridH,
    world,
    [result.start, result.goal, result.mid],
    5 + Math.floor(Math.random() * 4),
    passRows
  );

  return { ...result, rows, tokens };
}
