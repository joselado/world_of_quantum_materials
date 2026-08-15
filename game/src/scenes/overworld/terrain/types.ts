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
export type TerrainKind = 'path' | 'solid' | 'forest' | 'columns' | 'deadFloor' | 'charged' | 'ice' | 'shards' | 'fog' | 'lava' | 'consuming';

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
  // A tile the generator placed as a vortex core -- a hole punched through an
  // otherwise expelling superconductor, which the Vortex Glacier draws as a
  // pit (materials/ice.ts). Handed down from the generator rather than
  // recognised from the shape: a blocked tile ringed by walkable ground is
  // also what an ordinary corridor pinch looks like, so inference puts pits
  // where the world has none.
  vortexCore: boolean;
}

// Where a fight started, read off the same plan the corridor is drawn from
// (plan.ts's sampleBattleLocale) and handed to BattleScene, which colors the
// arena from it. Enough to place the battle on the map without carrying any
// of the projection geometry the overworld's own accents need: the arena is a
// flat near view and re-renders none of that.
export interface BattleLocale {
  // The encounter tile's own grid coordinates -- what gives each spot in a
  // world its own stable skyline (BattleScene.drawBackground's ridge seeds).
  x: number;
  y: number;
  // That tile's own biome, which is the scene's biome everywhere except a
  // World 9 defect patch, where it is the borrowed world's instead.
  biome: Biome;
  // The off-path material that dominates the neighbourhood around the tile,
  // falling back to the tile biome's own where the tile stands too far from
  // anything impassable to see one.
  surround: OffPathKind;
  // The dominant mapgen domain tint around the tile (worlds 1/3/8's colored
  // regions), null where the surround carries none.
  regionTint: number | null;
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
  // The player's current crystal color. The Splitting Hollow's surround
  // carries fragments of it (materials/fog.ts) -- the first hint that the
  // world contains things like the player, immediately before the last world
  // turns out to be one.
  playerColor: number;
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
  // Whether this tile is a vortex core, from its TerrainTile (see above).
  vortexCore: boolean;
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
  // The player's own crystal color, for the recognition seed (see
  // TerrainView.playerColor).
  playerColor: number;
  now: number;
}

export type AccentDraw = (g: Phaser.GameObjects.Graphics, tile: AccentTile) => void;
