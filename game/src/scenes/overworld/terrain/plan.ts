import { getBiome } from '../../../art/biomes';
import type { Biome } from '../../../art/biomes';
import { buildContourGrid } from '../../../art/contours';
import type { GridPoint } from '../../../world/mapgen';
import { GRID_W, GRID_H } from '../projection';
import type { OffPathKind, TerrainPlan, TerrainTile } from './types';

// The grid as the plan pass reads it -- everything OverworldScene knows about
// the map that decides what a tile is made of.
export interface TerrainSource {
  walkable: boolean[][];
  regionColor: (number | null)[][];
  biomeOverride: (number | null)[][];
  vortexCores: GridPoint[];
  flowerMap: boolean[][];
  midTile: GridPoint;
  biome: Biome;
}

// Terrain rendering splits in two: reading the grid (this, cached by the
// scene for as long as the grid stands still) and projecting/painting it
// (paint.ts, every frame). Everything here is camera-independent, so the
// whole grid is classified in one pass rather than just the currently-visible
// window -- a shape that spans the window edge (a wall run, a traced
// boundary) stays one continuous shape instead of being cut at whatever the
// camera happened to see when the plan was built.
export function buildTerrainPlan(src: TerrainSource): TerrainPlan {
  const tiles = classifyTiles(src);
  const farEdgeRow = findFarEdgeRow(src.walkable);
  const contours = buildContourGrid(depthContinuedWalkable(src.walkable, farEdgeRow), GRID_W, GRID_H);
  return { tiles, farEdgeRow, contours };
}

function classifyTiles(src: TerrainSource): TerrainTile[][] {
  // A core only counts where the finished grid actually left it blocked: the
  // shared chokepoint and pass passes run after the generator and could carve
  // one open, and a pit drawn on walkable floor would be a hole in the road.
  const cores = new Set(src.vortexCores.filter((c) => !src.walkable[c.y]?.[c.x]).map((c) => `${c.x},${c.y}`));
  const plan: TerrainTile[][] = [];
  for (let y = 0; y < GRID_H; y++) {
    const row: TerrainTile[] = [];
    for (let x = 0; x < GRID_W; x++) {
      // World 9's defect patches (world/generators/world9.ts) tag a tile
      // with which world's biome table it should render with instead of
      // this scene's own -- every other world leaves this null.
      const overrideWorld = src.biomeOverride[y]?.[x];
      const biome = overrideWorld != null ? getBiome(overrideWorld) : src.biome;
      const regionTint = src.regionColor[y]?.[x] ?? null;
      row.push({
        kind: src.walkable[y]?.[x] ? 'path' : offPathKindOf(biome),
        biome,
        regionTint,
        decorate: !!src.flowerMap[y]?.[x],
        midHighlight: Math.abs(x - src.midTile.x) <= 1 && Math.abs(y - src.midTile.y) <= 1,
        vortexCore: cores.has(`${x},${y}`),
      });
    }
    plan.push(row);
  }
  return plan;
}

// A tile's off-path material is its biome's, whatever else the tile carries.
// A mapgen domain tint (world/mapgen.ts, world3.ts's Voronoi cells) colors
// that material rather than replacing it: the Edge Cliffs' two dead domain
// hues *are* its sunken floors, so the tint supplies the color and the
// material supplies the crystalline stipple over it, and the world needs both
// at once.
export function offPathKindOf(biome: Biome): OffPathKind {
  return biome.wallTheme === 'rock' ? 'solid' : biome.wallTheme;
}

// The northernmost row the corridor reaches -- every generator paints its
// last band on the goal row and leaves the rows north of it unwalkable, so
// this is the last row that carries the path. It is the row the depth
// margin (paint.ts's drawMarginRows) continues toward the horizon, the way
// the lateral margin continues the grid's left/right edge column.
function findFarEdgeRow(walkable: boolean[][]): number {
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (walkable[y]?.[x]) return y;
    }
  }
  return 0;
}

// The walkability the contour trace sees: the real grid, with every row
// north of the far edge row carrying that row's walkability instead of its
// own. The trace treats out-of-grid as impassable, so without this the far
// edge row's path tiles would be traced as bounded on their north side and
// wear a boundary curve, contact shadow and rim light straight across a
// road the depth margin then continues past them. Movement still collides
// against the untouched `walkable` grid, so the repeated road is scenery:
// the player leaves through the goal tile, not by walking up it.
function depthContinuedWalkable(walkable: boolean[][], farEdgeRow: number): boolean[][] {
  if (farEdgeRow <= 0) return walkable;
  const out: boolean[][] = [];
  for (let y = 0; y < GRID_H; y++) out.push(y < farEdgeRow ? [...walkable[farEdgeRow]] : walkable[y]);
  return out;
}
