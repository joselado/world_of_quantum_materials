import Phaser from 'phaser';
import { blend } from '../../art/colors';
import { BIOMES, getBiome } from '../../art/biomes';
import type { Biome } from '../../art/biomes';
import { HORIZON_Y, CANVAS_W, CANVAS_H } from '../../art/perspective';
import { DISTANT_SELVES, MAX_CREST, OVERHEAD_SKIES } from '../../art/horizons';
import type { HorizonPoint } from '../../art/horizons';
import { DRAW_DISTANCE_TILES, projectTile } from './projection';
import { FOG_CLOSE, groundColor } from './terrain/color';

// Where drawHorizonBand starts thickening the per-tile fog into pure
// atmosphere, as a fraction of the draw distance. Derived from the depth at
// which the ground's own fog begins its steep stretch (terrain/color.ts's
// FOG_CLOSE) and held nearer the camera than it, so the wash is already
// carrying weight everywhere the per-row color is moving fastest. Ground
// rows paint as flat fills, so what the eye reads there is the step between
// two rows scaled by how much of the wash sits over them; a band whose foot
// lands on FOG_CLOSE itself is down to a few percent exactly where it is
// needed most.
const HORIZON_BAND_FROM = FOG_CLOSE * 0.65;
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
// crest a distant self can reach (art/horizons.ts's MAX_CREST), so the
// silhouette stands *in* the mist rather than against open sky. A silhouette
// drowned to within a few values of the fog while its backdrop is still forty
// values off the fog is the same slab as an undrowned one -- the value budget
// below is only meaningful because what surrounds the band is the fog color.
const SKY_BLEND_H = 96;
const SKY_BLEND_FULL = MAX_CREST + 2;
// How far the mist drifts back toward this world's own high sky as it climbs
// away from the horizon line, and how much of the fog color washes over the
// whole sky (clouds included) once the forward blend is running.
const MIST_LIFT = 0.3;
const SKY_TINT_MAX = 0.55;
// How far the distant self is carried into the live fog target. The
// silhouette is drowned rather than painted: what is left of its own color
// is a narrow excursion from the mist it stands in, which is the whole
// budget a horizon wearing a neighbour's hue gets (WORLDS.md section 4).
const DISTANT_DROWN = 0.8;
// The silhouette is painted as nested copies of itself, each starting a step
// higher up its own local height, so alpha accumulates from zero at the base
// to the biome's full swallow at the crest -- mist pooling at the foot of a
// distant ridge, and a base that meets the mist with no line in it. Each
// copy is repeated with its crest dropped a pixel at a time, which is the
// softness on the top edge against the sky.
const DISTANT_SWALLOW_STEPS = 6;
const DISTANT_FEATHER_PX = 3;

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
// (as opposed to the per-tile fills) haze toward, and the scene clock, which
// drives the animated half of a neighbour's distant self (the Storm Flats'
// arc-flashes, the Entangled Web's glinting filaments).
export interface AtmosphereView extends HazeView {
  biome: Biome;
  now: number;
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
    ].forEach(([x, y]) => drawCloud(scene, x, y, biome.cloudDrift));
  }
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

// A cloud is drawn at the origin and positioned by the object's own
// transform, so a drifting world can move it without redrawing anything.
// The Edge Cliffs are the world this exists for: wind racing overhead while
// the ground beneath stays perfectly still is that world's horror, and it
// only lands if the sky is visibly the only thing moving.
function drawCloud(scene: Phaser.Scene, x: number, y: number, drift: number) {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.85);
  g.fillEllipse(0, 0, 50, 20);
  g.fillEllipse(-20, 5, 32, 16);
  g.fillEllipse(20, 5, 32, 16);
  g.setPosition(x, y);
  if (drift <= 0) return;

  const span = CANVAS_W + 120;
  scene.tweens.add({
    targets: g,
    x: x + span,
    duration: (span / drift) * 1000,
    repeat: -1,
    onRepeat: () => g.setX(x - 60),
  });
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
  const mist = SKY_BLEND_H + SKY_BLEND_FULL;
  const mistTop = HORIZON_Y - mist;
  // The mist is a column of air seen end-on, not a swatch: it holds the fog
  // color where the sightline through it is longest -- the horizon line and
  // the strip of ground below it -- and thins toward this world's own high
  // sky as it climbs. Without that drift the full-strength stretch reads as
  // a flat panel laid over the picture even with both its edges feathered,
  // because a hundred rows of one exact color is the one thing real air
  // never is.
  const lifted = blend(target, view.biome.skyTop, MIST_LIFT);
  const floorY = projectTile(0, DRAW_DISTANCE_TILES).y;
  const tone = (y: number) => lerpColor(target, lifted, Math.max(0, (floorY - y) / (floorY - mistTop)));

  // The sky wash reaches every cloud too, at a strength that is zero until
  // the forward blend starts: once the air ahead is the next world's air,
  // a bank of this world's untouched daylight clouds over it is the loudest
  // possible statement that the color below them is an overlay. It covers
  // the sky whole, down to the horizon line and under the mist band rather
  // than stopping where the band begins -- a wash that ends anywhere the
  // eye can find it has simply moved the edge it was drawn to remove, and
  // the band's own ramp starts from zero at exactly that height.
  if (view.hazeBlend > 0) {
    g.fillStyle(target, SKY_TINT_MAX * view.hazeBlend);
    g.fillRect(0, 0, CANVAS_W, HORIZON_Y);
  }
  fillVerticalFade(g, () => target, HORIZON_Y, 240, (t) => 0.35 * Math.pow(1 - t, 3));
  drawHorizonBand(g, tone);
  // Smoothstepped rather than a power curve: the ramp has to arrive at the
  // full-strength zone with its slope already flat, or the point where it
  // stops climbing is itself an edge -- the same rectangle read this pass
  // exists to remove, moved up the sky.
  fillVerticalFade(g, tone, mistTop, mist, (t) => smoothstep(Math.min(1, (t * mist) / SKY_BLEND_H)));
  drawDistantSelf(g, view, target);
  // The world's own sky motif, over the mist rather than in it: the Storm
  // Flats' arcs crack across the whole dusk, not just along its horizon.
  OVERHEAD_SKIES[view.world]?.({ g, horizonY: HORIZON_Y, target, now: view.now });
}

// A vertical alpha ramp, painted as abutting one-pixel rows in whatever color
// `colorAt` gives that row. The rows must not overlap: two translucent rects
// sharing a scanline blend twice there, which draws a bright line at every
// seam -- invisible while the color is close to the ground under it, and
// stripes across the whole far distance as soon as it is not (a haze carrying
// the next world's fog color, biomes.ts's note on holding `fogTarget` near
// the floor colors).
function fillVerticalFade(
  g: Phaser.GameObjects.Graphics,
  colorAt: (y: number) => number,
  top: number,
  height: number,
  alphaAt: (t: number) => number
) {
  const rows = Math.max(1, Math.round(height));
  for (let i = 0; i < rows; i++) {
    const y = top + i * (height / rows);
    // The ramp is sampled at each row's far edge, so the last row painted
    // lands on alphaAt(1) exactly. A fade that has to arrive opaque (the sky
    // blend meeting the horizon line) otherwise stops a row short and leaves
    // a sliver of un-hazed sky against fully-hazed mist -- a hairline seam at
    // precisely the join this pass exists to remove.
    g.fillStyle(colorAt(y), alphaAt((i + 1) / rows));
    g.fillRect(0, y, CANVAS_W, height / rows);
  }
}

// Packed-int color lerp. The mist ramp needs one of these per scanline of
// every frame, which is where Phaser's Color objects would start costing
// real allocation -- `blend` stays the right call everywhere it runs once.
function lerpColor(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
  return (r << 16) | (g << 8) | bl;
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
//
// The thinning is smoothstepped, so the band leaves full strength with its
// slope already flat. A ramp that starts falling the instant the opaque
// stretch ends puts a readable line there instead of at the horizon -- the
// eye finds the place where a gradient stops changing just as easily as it
// finds an edge.
function drawHorizonBand(g: Phaser.GameObjects.Graphics, colorAt: (y: number) => number) {
  const solid = projectTile(0, DRAW_DISTANCE_TILES).y;
  const foot = projectTile(0, DRAW_DISTANCE_TILES * HORIZON_BAND_FROM).y;
  const height = foot - HORIZON_Y;
  const solidT = (solid - HORIZON_Y) / height;
  fillVerticalFade(g, colorAt, HORIZON_Y, height, (t) =>
    t <= solidT ? 1 : smoothstep(1 - (t - solidT) / (1 - solidT))
  );
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
// The profile itself comes from art/horizons.ts, keyed by the same depicted
// world -- shape there, color and swallow here, one asset read as a pair. A
// world may carry a sky extra instead of, or as well as, a silhouette: the
// Entangled Web's swallow is zero and its filament glints are the whole of
// its distant self, so the extra is drawn whatever the swallow says.
function drawDistantSelf(g: Phaser.GameObjects.Graphics, view: AtmosphereView, target: number) {
  const world = view.world + 1;
  const depicted = BIOMES[world];
  const self = DISTANT_SELVES[world];
  if (!depicted || !self) return;

  if (depicted.hillAlpha > 0 && self.points.length > 1) {
    // Every copy is painted at the one alpha that composites to the authored
    // swallow where all of them overlap, so the knob means what it says.
    const passes = DISTANT_SWALLOW_STEPS * DISTANT_FEATHER_PX;
    g.fillStyle(blend(depicted.hillColor, target, DISTANT_DROWN), 1 - Math.pow(1 - depicted.hillAlpha, 1 / passes));
    for (let step = 0; step < DISTANT_SWALLOW_STEPS; step++) {
      for (let drop = 0; drop < DISTANT_FEATHER_PX; drop++) {
        fillSilhouette(g, self.points, step / DISTANT_SWALLOW_STEPS, drop);
      }
    }
  }

  self.sky?.({ g, horizonY: HORIZON_Y, target, now: view.now });
}

// One copy of the silhouette: the strip between its crest (dropped `drop`
// pixels) and a floor sitting `foot` of the way up its own local height.
// Measuring the floor against the local height rather than a flat screen
// line is what makes the mist pool -- a shallow dip is swallowed whole while
// a crest beside it still clears the fog. Crests are clamped to MAX_CREST,
// which is the height the mist band is sized to cover; a profile reaching
// past it would stand against open sky.
function fillSilhouette(g: Phaser.GameObjects.Graphics, profile: HorizonPoint[], foot: number, drop: number) {
  const points: Phaser.Types.Math.Vector2Like[] = [];
  const back: Phaser.Types.Math.Vector2Like[] = [];
  for (const p of profile) {
    const h = Math.min(p.h, MAX_CREST);
    const crest = HORIZON_Y - h + drop;
    points.push({ x: p.x, y: crest });
    back.push({ x: p.x, y: Math.max(HORIZON_Y - h * foot, crest) });
  }
  back.reverse();
  g.fillPoints(points.concat(back), true);
}
