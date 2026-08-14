import Phaser from 'phaser';
import { blend } from '../../art/colors';
import { BIOMES, getBiome } from '../../art/biomes';
import type { Biome } from '../../art/biomes';
import { HORIZON_Y, CANVAS_W, CANVAS_H } from '../../art/perspective';
import { DRAW_DISTANCE_TILES, projectTile } from './projection';
import { groundColor } from './terrain/color';

// Where drawHorizonBand starts thickening the per-tile fog into pure
// atmosphere, as a fraction of the draw distance. It is exactly where the
// detail passes (tile decoration, terrain accents, actor sprites) already
// stop, so the band covers only ground that had nothing left on it.
const HORIZON_BAND_FROM = 0.75;
// How far south of the goal row the next world's fog starts bleeding into
// this one's, in tiles, and how much of it has arrived by the goal row
// itself. Held under 1 so the world keeps some of its own air even standing
// at the gate; the fog target is applied in proportion to depth, so at the
// goal row this recolors the distance and leaves the ground underfoot alone.
const HAZE_INHERIT_TILES = 12;
const HAZE_INHERIT_MAX = 0.8;
// The mist standing in the sky: fully the fog color from SKY_BLEND_FULL
// above the horizon line down to the line itself, feathering out over the
// SKY_BLEND_H above that. This is what makes the horizon a location inside
// one atmosphere instead of the seam between a sky rectangle and a mist
// rectangle -- the sky arrives at the fog color from above at exactly the
// point the ground arrives at it from below.
//
// The full-strength height is not a taste setting: it clears the tallest
// crest a distant self can reach (DISTANT_HEIGHT), so the silhouette stands
// *in* the mist rather than against open sky. A silhouette drowned to within
// a few values of the fog while its backdrop is still forty values off the
// fog is the same slab as an undrowned one -- the value budget below is only
// meaningful because what surrounds the band is the fog color.
const SKY_BLEND_H = 96;
const SKY_BLEND_FULL = 40;
// How far the distant self is carried into the live fog target. The
// silhouette is drowned rather than painted: what is left of its own color
// is a narrow excursion from the mist it stands in, which is the whole
// budget a horizon wearing a neighbour's hue gets (WORLDS.md section 4).
const DISTANT_DROWN = 0.8;
// The placeholder two-sine profile's tallest crest above the horizon line,
// in pixels -- per-world profiles replace the shape, and this becomes their
// authored height. Both the swallow ramp and the polygon read it.
const DISTANT_HEIGHT = 38;
// The silhouette is painted as nested copies of itself, each starting a step
// higher up its own local height, so alpha accumulates from zero at the base
// to the biome's full swallow at the crest -- mist pooling at the foot of a
// distant ridge, and a base that meets the mist with no line in it. Each
// copy is repeated with its crest dropped a pixel at a time, which is the
// softness on the top edge against the sky.
const DISTANT_SWALLOW_STEPS = 6;
const DISTANT_FEATHER_PX = 3;
// Horizontal sampling of the profile. The finest term in the placeholder
// shape runs a ~180px period, so this holds several samples across it.
const DISTANT_SAMPLE_PX = 32;

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
// beyond the drawn tiles still reads as ground rather than void, and this
// biome's clouds. Everything that has to follow the moving fog target -- the
// sky's own bottom, the horizon band, the neighbour's silhouette -- is
// painted per frame instead, from drawDepthHaze.
export function drawSky(scene: Phaser.Scene, biome: Biome) {
  const g = scene.add.graphics();
  g.fillGradientStyle(biome.skyTop, biome.skyTop, biome.skyBottom, biome.skyBottom, 1);
  g.fillRect(0, 0, CANVAS_W, HORIZON_Y);

  g.fillStyle(groundColor(biome.ground, 1, biome.fogTarget), 1);
  g.fillRect(0, HORIZON_Y, CANVAS_W, CANVAS_H - HORIZON_Y);

  if (biome.clouds) {
    [
      [90, 40],
      [230, 65],
      [400, 50],
      [530, 32],
    ].forEach(([x, y]) => drawCloud(scene, x, y));
  }
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
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

// The whole atmosphere pass, drawn into worldGfx after the ground plane and
// so under every actor: a wash over the far reach of the ground, the band
// that owns the last strip up to the horizon line, the sky's own graduation
// down into the same color from above, and the neighbour's silhouette
// standing in it. All four read one `target`, so nothing in the picture can
// disagree about what color the air is -- which is what lets the horizon
// line be a place inside the atmosphere rather than the edge of two.
//
// The ground wash sits on top of the per-tile depth fog rather than instead
// of it: the per-tile blend alone still hands every tile a hard edge against
// its neighbor, and the wash is what turns the far distance into continuous
// atmosphere.
export function drawDepthHaze(g: Phaser.GameObjects.Graphics, view: AtmosphereView) {
  const target = hazeTarget(view, view.biome);
  fillVerticalFade(g, target, HORIZON_Y, 240, (t) => 0.35 * Math.pow(1 - t, 3));
  drawHorizonBand(g, target);
  const mist = SKY_BLEND_H + SKY_BLEND_FULL;
  // Smoothstepped rather than a power curve: the ramp has to arrive at the
  // full-strength zone with its slope already flat, or the point where it
  // stops climbing is itself an edge -- the same rectangle read this pass
  // exists to remove, moved up the sky.
  fillVerticalFade(g, target, HORIZON_Y - mist, mist, (t) =>
    smoothstep(Math.min(1, (t * mist) / SKY_BLEND_H))
  );
  drawDistantSelf(g, view, target);
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
    // The ramp is sampled at each row's far edge, so the last row painted
    // lands on alphaAt(1) exactly. A fade that has to arrive opaque (the sky
    // blend meeting the horizon line) otherwise stops a row short and leaves
    // a sliver of un-hazed sky against fully-hazed mist -- a hairline seam at
    // precisely the join this pass exists to remove.
    g.fillStyle(color, alphaAt((i + 1) / rows));
    g.fillRect(0, top + i * (height / rows), CANVAS_W, height / rows);
  }
}

// The last stretch of ground is painted atmosphere rather than tiles: past
// the fog-saturation depth rows are compressed to nothing and hold nothing
// the haze has not already taken, so the terrain dissolves and meets the sky
// as a gradient instead of on the edge of a final row. The band is fully
// opaque from the horizon line down to that depth, which is the strip the
// projection puts out of the ground plane's reach -- rows approach the
// horizon line asymptotically and never arrive, so something has to own the
// last few pixels of ground. It thins from there toward the camera, running
// out at HORIZON_BAND_FROM of the draw distance. Both ends are fixed depths
// rather than tracked off the deepest row drawn, so the band never slides
// out from under the rows as the camera creeps.
function drawHorizonBand(g: Phaser.GameObjects.Graphics, target: number) {
  const solid = projectTile(0, DRAW_DISTANCE_TILES).y;
  const foot = projectTile(0, DRAW_DISTANCE_TILES * HORIZON_BAND_FROM).y;
  const height = foot - HORIZON_Y;
  const solidT = (solid - HORIZON_Y) / height;
  fillVerticalFade(g, target, HORIZON_Y, height, (t) => (t <= solidT ? 1 : Math.pow((1 - t) / (1 - solidT), 1.5)));
}

// The neighbour's distant self, standing on the horizon line. World N's
// forward horizon is world N+1's own silhouette, so every field read here --
// profile, base color, swallow -- comes off that world's biome entry and
// never off the one the player is standing in (WORLDS.md section 4). Nothing
// is drawn where there is no next world, nor where the next world's authored
// swallow is zero: the Entangled Web has no surround to show, the Splitting
// Hollow's own fog eats its, and the Devouring Mirror's horizon is the
// Qumatuomi sky. World 6's forward horizon emptying out is that rule
// arriving as a story beat rather than as a special case.
//
// The fill is that world's base color drowned into the *live* haze target --
// the same value every other haze in this frame is using, never the
// neighbour's own fog color. That is what welds band and mist together: as
// the player nears an open gate the target lerps toward the next world's
// air, the silhouette lerps with it, and the horizon resolves into the next
// world with nothing anywhere that switches.
function drawDistantSelf(g: Phaser.GameObjects.Graphics, view: AtmosphereView, target: number) {
  const depicted = BIOMES[view.world + 1];
  if (!depicted || depicted.hillAlpha <= 0) return;

  // Every copy is painted at the one alpha that composites to the authored
  // swallow where all of them overlap, so the knob means what it says.
  const passes = DISTANT_SWALLOW_STEPS * DISTANT_FEATHER_PX;
  g.fillStyle(blend(depicted.hillColor, target, DISTANT_DROWN), 1 - Math.pow(1 - depicted.hillAlpha, 1 / passes));
  for (let step = 0; step < DISTANT_SWALLOW_STEPS; step++) {
    for (let drop = 0; drop < DISTANT_FEATHER_PX; drop++) {
      fillSilhouette(g, step / DISTANT_SWALLOW_STEPS, drop);
    }
  }
}

// One copy of the silhouette: the strip between its crest (dropped `drop`
// pixels) and a floor sitting `foot` of the way up its own local height.
// Measuring the floor against the local height rather than a flat screen
// line is what makes the mist pool -- a shallow dip is swallowed whole while
// a crest beside it still clears the fog.
function fillSilhouette(g: Phaser.GameObjects.Graphics, foot: number, drop: number) {
  const points: Phaser.Types.Math.Vector2Like[] = [];
  const back: Phaser.Types.Math.Vector2Like[] = [];
  for (let x = 0; x <= CANVAS_W; x = Math.min(x + DISTANT_SAMPLE_PX, CANVAS_W)) {
    const h = silhouetteHeight(x);
    const crest = HORIZON_Y - h + drop;
    points.push({ x, y: crest });
    back.push({ x, y: Math.max(HORIZON_Y - h * foot, crest) });
    if (x >= CANVAS_W) break;
  }
  back.reverse();
  g.fillPoints(points.concat(back), true);
}

// Placeholder profile: two sine terms, the same shape in every world. Per-
// world profiles replace this -- a world's distant self is its own impassable
// surround restated at horizon scale, and one rolling hill in ten colors is
// the theming not made visible at distance.
function silhouetteHeight(x: number): number {
  return DISTANT_HEIGHT - 18 + Math.sin(x * 0.012) * 12 + Math.sin(x * 0.035) * 6;
}
