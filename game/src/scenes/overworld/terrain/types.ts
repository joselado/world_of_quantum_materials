import Phaser from 'phaser';
import type { Biome } from '../../../art/biomes';
import type { ProjectedPoint } from '../../../art/perspective';
import type { TileContour } from '../../../art/contours';
import type { GridPoint } from '../../../world/mapgen';
import type { AtmosphereView } from '../sky';

// What a tile's terrain actually is, once the grid has been read: 'path' is
// walkable trail, 'solid' plain bare impassable ground, and every other kind
// an off-path material that lays its own accent over that same ground (see
// materials/), one per world's impassable surround.
export type TerrainKind = 'path' | 'solid' | 'forest' | 'columns' | 'deadFloor' | 'charged' | 'lava' | 'water' | 'void';

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
}

// One impassable tile, ready for its material's accent: the tile's projected
// outline (for a full-tile wash), its centre and depth scale on screen, its
// own grid coordinates, and the scene clock. Built only for a tile whose
// material actually draws an accent, so a bare-ground tile costs nothing
// beyond its fill.
//
// `gx`/`gy` are what make a feature stand still in the world rather than on
// the screen. Anything anchored to the map -- the Iron Steppe's shards
// leaning one way until the domain wall and the other way past it, the
// Vortex Glacier's flow-lines bending around a fixed core -- must derive its
// geometry from these; a feature phased off `cx`/`cy` swims across the ground
// as the camera moves, which is right for a drifting shimmer and wrong for
// anything the world is supposed to *contain*.
export interface AccentTile {
  fill: ProjectedPoint[];
  cx: number;
  cy: number;
  s: number;
  gx: number;
  gy: number;
  // How far out this tile is, 0 at the camera and 1 where the depth fog
  // saturates, and the fog color it is heading toward. An accent that ignores
  // these keeps its full contrast to the last row it is drawn on and stands
  // its world's palette straight up against the mist, undoing for the accent
  // pass what the fill pass is careful to do.
  depth: number;
  haze: number;
  // The detail pass's own falloff, 1 near the camera and reaching 0 at the
  // depth accents stop being drawn at. Fading on this is what keeps a
  // material from ending on a visible line across the middle distance --
  // most obvious with the Mean Fields' trees, where the cutoff would read as
  // the wood simply being mown flat at a fixed range.
  detail: number;
  now: number;
}

export type AccentDraw = (g: Phaser.GameObjects.Graphics, tile: AccentTile) => void;
