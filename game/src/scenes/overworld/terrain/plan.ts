import Phaser from 'phaser';
import { getBiome } from '../../../art/biomes';
import type { Biome } from '../../../art/biomes';
import { buildContourGrid } from '../../../art/contours';
import type { FeatureCore, GridPoint } from '../../../world/mapgen';
import { gridW, gridH } from '../projection';
import type { BattleLocale, OffPathKind, TerrainPlan, TerrainTile, TileFeature } from './types';
import type { WallTheme } from '../../../art/biomes';

// The grid as the plan pass reads it -- everything OverworldScene knows about
// the map that decides what a tile is made of.
export interface TerrainSource {
  walkable: boolean[][];
  regionColor: (number | null)[][];
  biomeOverride: (number | null)[][];
  featureCores: FeatureCore[];
  flowerMap: boolean[][];
  midTile: GridPoint;
  biome: Biome;
  // Whether the road stops at this world's far edge instead of running on
  // past it -- the Devouring Mirror's cliff, once The Adapted has fallen. It
  // decides whether the far edge row is drawn as a continuing road or as a
  // real edge with its own boundary curve, contact shadow and rim light.
  endsAtCliff: boolean;
}

// Terrain rendering splits in two: reading the grid (this, cached by the
// scene for as long as the grid stands still) and projecting/painting it
// (paint.ts, every frame). Everything here is camera-independent, so the
// whole grid is classified in one pass rather than just the currently-visible
// window -- a shape that spans the window edge (a wall run, a traced
// boundary) stays one continuous shape instead of being cut at whatever the
// camera happened to see when the plan was built.
export function buildTerrainPlan(src: TerrainSource): TerrainPlan {
  const features = survivingFeatures(src);
  const tiles = classifyTiles(src, features);
  const farEdgeRow = findFarEdgeRow(src.walkable);
  const contours = buildContourGrid(
    src.endsAtCliff ? src.walkable : depthContinuedWalkable(src.walkable, farEdgeRow),
    gridW(),
    gridH()
  );
  return { tiles, farEdgeRow, contours, features };
}

// The generator's features as the finished grid still holds them. A core only
// counts where the grid actually left it blocked, and its reach is the
// largest disc around it the grid still has blocked whole: the shared
// chokepoint and pass passes run after the generator and could carve a pit or
// a pool open, and a feature drawn on walkable floor would be a hole in the
// road -- or, for one drawn whole across its disc, paint on it.
function survivingFeatures(src: TerrainSource): FeatureCore[] {
  const out: FeatureCore[] = [];
  for (const core of src.featureCores) {
    if (src.walkable[core.y]?.[core.x]) continue;
    let radius = 0;
    for (let r = core.radius; r > 0; r--) {
      if (discBlocked(src.walkable, core, r)) {
        radius = r;
        break;
      }
    }
    out.push({ x: core.x, y: core.y, radius });
  }
  return out;
}

// Whether every tile of the disc of this radius around the core (the same
// disc world/generators/shared.ts's discIsland punches) is still blocked.
function discBlocked(walkable: boolean[][], core: GridPoint, radius: number): boolean {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      if (walkable[core.y + dy]?.[core.x + dx]) return false;
    }
  }
  return true;
}

function classifyTiles(src: TerrainSource, features: FeatureCore[]): TerrainTile[][] {
  const cols = gridW();
  const rows = gridH();
  // Every tile of every surviving feature's disc, keyed by position, with
  // its place in the disc -- the core itself at (0, 0).
  const featureAt = new Map<string, TileFeature>();
  for (const f of features) {
    for (let dy = -f.radius; dy <= f.radius; dy++) {
      for (let dx = -f.radius; dx <= f.radius; dx++) {
        if (dx * dx + dy * dy > f.radius * f.radius) continue;
        featureAt.set(`${f.x + dx},${f.y + dy}`, { dx, dy, radius: f.radius });
      }
    }
  }
  const plan: TerrainTile[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: TerrainTile[] = [];
    for (let x = 0; x < cols; x++) {
      // World 9's defect patches (world/generators/world9.ts) tag a tile
      // with which world's biome table it should render with instead of
      // this scene's own -- every other world leaves this null.
      const overrideWorld = src.biomeOverride[y]?.[x];
      const biome = overrideWorld != null ? getBiome(overrideWorld) : src.biome;
      const regionTint = src.regionColor[y]?.[x] ?? null;
      const feature = featureAt.get(`${x},${y}`) ?? null;
      row.push({
        kind: src.walkable[y]?.[x] ? 'path' : offPathKindOf(biome),
        biome,
        regionTint,
        decorate: !!src.flowerMap[y]?.[x],
        midHighlight: Math.abs(x - src.midTile.x) <= 1 && Math.abs(y - src.midTile.y) <= 1,
        featureCore: feature !== null && feature.dx === 0 && feature.dy === 0,
        feature,
      });
    }
    plan.push(row);
  }
  return plan;
}

// A tile's off-path material is its biome's, whatever else the tile carries.
// A mapgen domain tint (world/mapgen.ts, world3.ts's Voronoi cells) colors
// that material rather than replacing it: the Winding Borders' two dead domain
// hues *are* its sunken floors, so the tint supplies the color and the
// material supplies the crystalline stipple over it, and the world needs both
// at once.
export function offPathKindOf(biome: Biome): OffPathKind {
  return biome.wallTheme === 'rock' ? 'solid' : biome.wallTheme;
}

// The same mapping read backwards, for a caller holding a sampled kind and
// needing the theme a biome would have stated it with (BattleScene's
// arena color grade). Kept beside its forward half so the two can't drift.
export function wallThemeOf(kind: OffPathKind): WallTheme {
  return kind === 'solid' ? 'rock' : kind;
}

// How far around the encounter tile counts as "here". Two tiles out matches
// World 9's smallest defect patch (world/generators/world9.ts's
// PATCH_RADIUS_MIN), so a patch the player is standing in carries its own
// tally, while the window stays small enough that two spots a few tiles apart
// read different surroundings.
const LOCALE_RADIUS = 2;

// What the battle arena is told about where the fight started: the tile the
// player stands on, its own biome, and a read of the ground around it. Mid
// corridor there may be no impassable tile within the window at all, in which
// case the surround falls back to what the tile's biome says its off-path
// material is -- the world's own answer, which is the right one for a fight
// in the open.
export function sampleBattleLocale(plan: TerrainPlan, at: GridPoint): BattleLocale {
  const x = Math.min(gridW() - 1, Math.max(0, at.x));
  const y = Math.min(gridH() - 1, Math.max(0, at.y));
  const here = plan.tiles[y][x];
  const kinds = new Map<OffPathKind, number>();
  const tints = new Map<number, number>();
  for (let yy = Math.max(0, y - LOCALE_RADIUS); yy <= Math.min(gridH() - 1, y + LOCALE_RADIUS); yy++) {
    for (let xx = Math.max(0, x - LOCALE_RADIUS); xx <= Math.min(gridW() - 1, x + LOCALE_RADIUS); xx++) {
      const tile = plan.tiles[yy][xx];
      if (tile.kind !== 'path') kinds.set(tile.kind, (kinds.get(tile.kind) ?? 0) + 1);
      if (tile.regionTint != null) tints.set(tile.regionTint, (tints.get(tile.regionTint) ?? 0) + 1);
    }
  }
  const corridorRows = gridH() - 1 - plan.farEdgeRow;
  return {
    x,
    y,
    biome: here.biome,
    surround: dominant(kinds) ?? offPathKindOf(here.biome),
    regionTint: dominant(tints) ?? null,
    rowsToPass: y - plan.farEdgeRow,
    convergence: corridorRows <= 0 ? 1 : Phaser.Math.Clamp((gridH() - 1 - y) / corridorRows, 0, 1),
  };
}

// The most common entry, with ties going to whichever was met first -- the
// window is walked in a fixed order, so the same spot always answers the same
// way.
function dominant<T>(counts: Map<T, number>): T | null {
  let best: T | null = null;
  let bestCount = 0;
  counts.forEach((count, key) => {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  });
  return best;
}

// The northernmost row the corridor reaches -- every generator paints its
// last band on the goal row and leaves the rows north of it unwalkable, so
// this is the last row that carries the path. It is the row the depth
// margin (paint.ts's drawMarginRows) continues toward the horizon, the way
// the lateral margin continues the grid's left/right edge column.
function findFarEdgeRow(walkable: boolean[][]): number {
  for (let y = 0; y < gridH(); y++) {
    for (let x = 0; x < gridW(); x++) {
      if (walkable[y]?.[x]) return y;
    }
  }
  return 0;
}

// The walkability the contour trace sees where the road runs on past the far
// edge: the real grid, with every row north of the far edge row carrying that
// row's walkability instead of its own. A world that ends at a cliff passes
// its grid through untouched, because there the far edge really is one and
// has earned every edge treatment the trace gives a boundary. The trace treats out-of-grid as impassable, so without this the far
// edge row's path tiles would be traced as bounded on their north side and
// wear a boundary curve, contact shadow and rim light straight across a
// road the depth margin then continues past them. Movement still collides
// against the untouched `walkable` grid, so the repeated road is scenery:
// the player leaves through the goal tile, not by walking up it.
function depthContinuedWalkable(walkable: boolean[][], farEdgeRow: number): boolean[][] {
  if (farEdgeRow <= 0) return walkable;
  const out: boolean[][] = [];
  for (let y = 0; y < gridH(); y++) out.push(y < farEdgeRow ? [...walkable[farEdgeRow]] : walkable[y]);
  return out;
}
