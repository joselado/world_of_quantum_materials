import Phaser from 'phaser';
import type { Biome } from '../../../art/biomes';
import type { ProjectedPoint } from '../../../art/perspective';
import type { TileContour } from '../../../art/contours';
import type { GridPoint } from '../../../world/mapgen';
import type { AtmosphereView } from '../sky';

// What a tile's terrain actually is, once the grid has been read: 'path' is
// walkable trail, 'solid' plain impassable ground (rock-theme or
// region-tinted), and 'lava'/'water'/'void' the themes that lay an animated
// accent over that same ground (see materials/).
export type TerrainKind = 'path' | 'solid' | 'lava' | 'water' | 'void';

// The kinds an impassable tile can take -- one per off-path material, each
// with its own module under materials/.
export type OffPathKind = Exclude<TerrainKind, 'path'>;

// One tile's terrain, resolved from the grid (walkable, regionColor,
// biomeOverride, flowerMap, midTile) into everything the paint pass needs
// that doesn't depend on where the camera currently is -- see plan.ts.
export interface TerrainTile {
  kind: TerrainKind;
  biome: Biome;
  regionTint: number | null;
  decorate: boolean;
  midHighlight: boolean;
}

// The whole grid, read once: its per-tile terrain, the northernmost row the
// corridor reaches, and the smoothed walkable/impassable boundary geometry.
// A tile away from any boundary has no contour entry (null) and is drawn as a
// plain quad.
export interface TerrainPlan {
  tiles: TerrainTile[][];
  farEdgeRow: number;
  contours: (TileContour | null)[][];
}

// Everything the per-frame paint pass reads, assembled once per frame by the
// scene (OverworldScene.terrainView) so the drawing code itself never reaches
// back into scene state. `biome` is the scene's own biome, which is what tile
// decoration and the whole-screen haze read -- distinct from a tile's own
// `biome`, which World 9's defect patches override per tile.
export interface TerrainView extends AtmosphereView {
  gfx: Phaser.GameObjects.Graphics;
  plan: TerrainPlan;
  camX: number;
  camY: number;
  midTile: GridPoint;
  // This world's guardian color, for the chokepoint glow (drawMidHighlight).
  chokepointColor: number;
  // The scene clock, driving every animated accent.
  now: number;
}

// One impassable tile, ready for its material's accent: the tile's projected
// outline (for a full-tile wash), its centre and depth scale on screen, and
// the scene clock. Built only for a tile whose material actually draws an
// accent, so a bare-ground tile costs nothing beyond its fill.
export interface AccentTile {
  fill: ProjectedPoint[];
  cx: number;
  cy: number;
  s: number;
  now: number;
}

export type AccentDraw = (g: Phaser.GameObjects.Graphics, tile: AccentTile) => void;
