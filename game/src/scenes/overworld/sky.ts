import Phaser from 'phaser';
import { blend } from '../../art/colors';
import { BIOMES, getBiome } from '../../art/biomes';
import type { Biome } from '../../art/biomes';
import { HORIZON_Y, CANVAS_W, CANVAS_H } from '../../art/perspective';
import { DRAW_DISTANCE_TILES, projectTile } from './projection';
import { groundColor } from './terrain/color';

// The far quarter of the draw distance is painted as pure atmosphere by
// drawHorizonBand rather than left to the per-tile fog, which caps well short
// of the haze color and would otherwise let the deepest rows surface as a
// visible edge. It is also exactly where the detail passes (tile decoration,
// terrain accents, actor sprites) already stop, so the band covers only
// ground that had nothing left on it.
const HORIZON_BAND_FROM = 0.75;
// How far south of the goal row the next world's fog starts bleeding into
// this one's, in tiles, and how much of it has arrived by the goal row
// itself. Held under 1 so the world keeps some of its own air even standing
// at the gate; the fog target is applied in proportion to depth, so at the
// goal row this recolors the distance and leaves the ground underfoot alone.
const HAZE_INHERIT_TILES = 12;
const HAZE_INHERIT_MAX = 0.8;

// What hazeTarget needs to resolve a biome's haze: which world the player is
// in, how much of the next world's air has arrived (forwardHazeBlend), and a
// per-frame memo keyed by a biome's own fog color -- the blend factor only
// changes between frames, and world 9's defect patches put several biomes on
// screen at once.
export interface HazeView {
  world: number;
  hazeBlend: number;
  hazeCache: Map<number, number>;
}

// The same, plus the scene's own biome, which is what the whole-screen washes
// (as opposed to the per-tile fills) haze toward.
export interface AtmosphereView extends HazeView {
  biome: Biome;
}

// The static backdrop, painted once per world entry into its own Graphics
// under everything else: the sky gradient, a base ground wash so the distance
// beyond the drawn tiles still reads as ground rather than void, a rolling
// hill silhouette on the horizon line, and this biome's clouds.
export function drawSky(scene: Phaser.Scene, biome: Biome) {
  const g = scene.add.graphics();
  g.fillGradientStyle(biome.skyTop, biome.skyTop, biome.skyBottom, biome.skyBottom, 1);
  g.fillRect(0, 0, CANVAS_W, HORIZON_Y);

  g.fillStyle(groundColor(biome.ground, 1, biome.fogTarget), 1);
  g.fillRect(0, HORIZON_Y, CANVAS_W, CANVAS_H - HORIZON_Y);

  g.fillStyle(biome.hillColor, biome.hillAlpha);
  g.beginPath();
  g.moveTo(0, HORIZON_Y);
  for (let x = 0; x <= CANVAS_W; x += 32) {
    g.lineTo(x, HORIZON_Y - 20 - Math.sin(x * 0.012) * 12 - Math.sin(x * 0.035) * 6);
  }
  g.lineTo(CANVAS_W, HORIZON_Y);
  g.closePath();
  g.fillPath();

  if (biome.clouds) {
    [
      [90, 40],
      [230, 65],
      [400, 50],
      [530, 32],
    ].forEach(([x, y]) => drawCloud(scene, x, y));
  }
}

function drawCloud(scene: Phaser.Scene, x: number, y: number) {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.85);
  g.fillEllipse(x, y, 50, 20);
  g.fillEllipse(x - 20, y + 5, 32, 16);
  g.fillEllipse(x + 20, y + 5, 32, 16);
}

// What the distance hazes toward: a biome's own fog color, carried toward
// the next world's fog as the player nears the gate, so the air ahead
// becomes the next world's air. Every haze in the scene reads this, so the
// per-tile fog and the whole-screen wash always agree on where the
// atmosphere is going.
export function hazeTarget(view: HazeView, biome: Biome): number {
  if (view.hazeBlend <= 0) return biome.fogTarget;
  const cached = view.hazeCache.get(biome.fogTarget);
  if (cached != null) return cached;
  const next = getBiome(view.world + 1).fogTarget;
  const mixed = blend(biome.fogTarget, next, view.hazeBlend);
  view.hazeCache.set(biome.fogTarget, mixed);
  return mixed;
}

// How much of the next world's air has arrived, from the camera's distance
// to the goal row. Gated on the goal gate's state: while this world's rival
// still stands the gate is shut, and a shut gate shows nothing of what is
// beyond it. World 10 has no next world -- it keeps its own air the whole
// way, its horizon being the Qumatuomi sky rather than a neighbour.
export function forwardHazeBlend(world: number, gateOpen: boolean, camY: number, goalRow: number): number {
  if (!BIOMES[world + 1]) return 0;
  if (!gateOpen) return 0;
  const rows = camY - goalRow;
  return Phaser.Math.Clamp(1 - rows / HAZE_INHERIT_TILES, 0, 1) * HAZE_INHERIT_MAX;
}

// A wash of the biome's own haze color over the far reach of the ground
// plane, on top of the per-tile depth fog rather than instead of it: the
// per-tile blend alone still hands every tile a hard edge against its
// neighbor, and the wash is what turns the far distance into continuous
// atmosphere. Drawn into worldGfx so it stays under every actor.
export function drawDepthHaze(g: Phaser.GameObjects.Graphics, view: AtmosphereView) {
  const target = hazeTarget(view, view.biome);
  fillVerticalFade(g, target, HORIZON_Y, 240, (t) => 0.35 * Math.pow(1 - t, 3));
  drawHorizonBand(g, target);
}

// A vertical alpha ramp in one flat color, painted as abutting one-pixel
// rows. The rows must not overlap: two translucent rects sharing a scanline
// blend twice there, which draws a bright line at every seam -- invisible
// while the color is close to the ground under it, and stripes across the
// whole far distance as soon as it is not (a haze carrying the next world's
// fog color, biomes.ts's note on holding `fogTarget` near the floor colors).
function fillVerticalFade(
  g: Phaser.GameObjects.Graphics,
  color: number,
  top: number,
  height: number,
  alphaAt: (t: number) => number
) {
  const rows = Math.max(1, Math.round(height));
  for (let i = 0; i < rows; i++) {
    g.fillStyle(color, alphaAt(i / rows));
    g.fillRect(0, top + i * (height / rows), CANVAS_W, height / rows);
  }
}

// The last stretch of ground is painted atmosphere rather than tiles: past
// the fog-saturation depth rows are compressed to nothing and hold nothing
// the haze has not already taken, so the terrain dissolves and meets the sky
// as a gradient instead of on the edge of a final row. The band is fully
// opaque from the horizon line down to that depth -- which is what covers
// the deepest rows, whose own fog caps well short of the haze color and
// would otherwise surface as a visible edge -- and thins from there toward
// the camera, running out at HORIZON_BAND_FROM of the draw distance. Both
// ends are fixed depths rather than tracked off the deepest row drawn, so
// the band never slides out from under the rows as the camera creeps.
function drawHorizonBand(g: Phaser.GameObjects.Graphics, target: number) {
  const solid = projectTile(0, DRAW_DISTANCE_TILES).y;
  const foot = projectTile(0, DRAW_DISTANCE_TILES * HORIZON_BAND_FROM).y;
  const height = foot - HORIZON_Y;
  const solidT = (solid - HORIZON_Y) / height;
  fillVerticalFade(g, target, HORIZON_Y, height, (t) => (t <= solidT ? 1 : Math.pow((1 - t) / (1 - solidT), 1.5)));
}
