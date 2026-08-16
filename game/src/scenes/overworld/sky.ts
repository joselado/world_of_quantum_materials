import Phaser from 'phaser';
import { blend } from '../../art/colors';
import { BIOMES, getBiome } from '../../art/biomes';
import type { Biome } from '../../art/biomes';
import { HORIZON_Y, CANVAS_W, CANVAS_H, LANE_PX } from '../../art/perspective';
import { DISTANT_SELVES, MAX_CREST, OVERHEAD_SKIES } from '../../art/horizons';
import { drawQumatuomiOverlook } from '../../art/qumatuomiMap';
import { drawStarNetwork } from '../../art/stars';
import type { HorizonPoint } from '../../art/horizons';
import { DRAW_DISTANCE_TILES, TILE_SCALE, projectTile } from './projection';
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
//
// The feather takes whatever height is left once the full-strength stretch
// and a strip of the world's own untouched sky have been paid for, rather
// than being a number of its own: the sky is a narrow band above a high
// horizon line, and a mist sized independently of it would run off the top of
// the frame and take the world's own sky colour with it.
const SKY_CLEAR_H = 28;
const SKY_BLEND_FULL = MAX_CREST + 2;
const SKY_BLEND_H = HORIZON_Y - SKY_BLEND_FULL - SKY_CLEAR_H;
// How far down the ground plane the wash over the far distance reaches,
// carried as a fraction of the ground's own height so it covers the same
// stretch of *world* whatever the horizon line is. Its cubic falloff has run
// out well before the foot, which is what keeps the near ground the biome's
// own colour.
const GROUND_WASH_H = (CANVAS_H - HORIZON_Y) * 0.83;
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
//
// The whole silhouette is redrawn once per copy on every frame, so the two
// counts multiply into the most-drawn shape in the game and are kept only as
// high as the ramp needs. Each copy carries the alpha that composites to the
// authored swallow (see drawDistantSelf), so raising or lowering them changes
// how finely the ramp is stepped, never how dark the ridge ends up: at these
// counts no pixel differs from a far more finely stepped ramp by more than a
// thirtieth of a value, which is below what the screen can show.
const DISTANT_SWALLOW_STEPS = 4;
const DISTANT_FEATHER_PX = 2;

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

// This world's forward pass, as everything drawing it needs to see it: where
// the throat sits on the grid and in the camera's lane space, how wide its
// walkable aperture is, whether its guard has fallen, and the world beyond.
// One record, read by the aperture in the horizon (drawPassAperture), by the
// ground seam and by the repeated road (terrain/paint.ts), so no two of them
// can disagree about whether the way is open.
export interface GateView {
  /** The throat's grid row -- the northernmost walkable row of the corridor. */
  row: number;
  /** The throat's lane offset from the camera, in tiles. */
  lane: number;
  /** Half the throat's walkable width, in tiles. */
  halfTiles: number;
  /** Whether this world's rival has fallen. */
  open: boolean;
  /** The world on the other side, or null in the last world, which has none. */
  next: Biome | null;
}

// The same, plus the scene's own biome, which is what the whole-screen washes
// (as opposed to the per-tile fills) haze toward, the scene clock, which
// drives the animated half of a neighbour's distant self (the Storm Flats'
// arc-flashes, the Entangled Web's glinting filaments), and this world's
// forward pass.
export interface AtmosphereView extends HazeView {
  biome: Biome;
  now: number;
  gate: GateView | null;
  // The worlds the player has walked, in the order they walked them, for the
  // route traced across the Qumatuomi map below the Devouring Mirror's cliff.
  route: number[];
  // Set only where the world ends at a cliff rather than running on: the
  // Devouring Mirror, once The Adapted has fallen. `lipDepth` is the edge's own
  // depth from the camera in tiles and `lipY` the screen y that projects to, so
  // the drop and the map below it fill exactly the gap between the last ground
  // drawn and the horizon -- a gap that opens up as the player walks toward the
  // edge, which is what makes the view something they walk out to rather than
  // something that is simply on screen. `lane` is the country's own axis as a
  // lane offset from the camera, which is what the land below is centred on:
  // measured from the camera rather than the frame, it holds still against the
  // ground when the player walks along the edge instead of sliding with them.
  overlook: { lipY: number; lipDepth: number; lane: number } | null;
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

  // Clouds ride the strip of sky the mist has not reached, so they are read
  // against the world's own high colour rather than against the fog. That
  // strip is narrow and short, and the corner HUD plates own both ends of it,
  // so there are few of them and they start in the window between the plates
  // -- a cloud sitting permanently behind a translucent panel reads as a
  // smudge on the interface rather than as weather. A drifting world carries
  // them out across the whole sky from there.
  if (biome.clouds) {
    [
      [470, 15],
      [600, 26],
    ].forEach(([x, y]) => drawCloud(scene, x, y, biome.cloudDrift));
  }
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

// A cloud is drawn at the origin and positioned by the object's own
// transform, so a drifting world can move it without redrawing anything.
// The Winding Borders are the world this exists for: wind racing overhead while
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
// way, and what its beaten pass opens onto is its own cliff edge rather than
// a neighbour.
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
  // Under the mist band that follows, which is the whole reason the field can
  // use the entire sky: a star low in the frame is seen through more air than
  // one high in it, and the band is already the air. Drawn over the sky tint
  // so the last four worlds' sky is never emptier than the world before them.
  drawStarNetwork({ g, world: view.world, horizonY: HORIZON_Y, target, now: view.now });
  fillVerticalFade(g, () => target, HORIZON_Y, GROUND_WASH_H, (t) => 0.35 * Math.pow(1 - t, 3));
  drawHorizonBand(g, tone);
  // Smoothstepped rather than a power curve: the ramp has to arrive at the
  // full-strength zone with its slope already flat, or the point where it
  // stops climbing is itself an edge -- the same rectangle read this pass
  // exists to remove, moved up the sky.
  fillVerticalFade(g, tone, mistTop, mist, (t) => smoothstep(Math.min(1, (t * mist) / SKY_BLEND_H)));
  // After the horizon band rather than under it, and hazed by its own depth
  // grade instead. The band's job is to wash out the deepest rows of a road
  // running on to the horizon; the land past a cliff edge lies in exactly
  // that stretch of the frame, so under the band it is simply erased, and
  // from a few rows back the world would end in a flat line with nothing
  // beyond it. Its own veil (art/qumatuomiMap.ts) is the atmosphere it
  // answers to -- graded across the land so the far coast dissolves and the
  // near one does not, which is the same thing the band would have done had
  // it been able to do it in depth rather than in screen rows.
  drawOverlook(g, view, target);
  // Under the distant self, never over it: what is visible through a gap in
  // the land cannot pass in front of the ridge behind the gap.
  drawPassAperture(g, view, target);
  drawDistantSelf(g, view, target);
  // The world's own sky motif, over the mist rather than in it: the Storm
  // Flats' arcs crack across the whole dusk, not just along its horizon.
  OVERHEAD_SKIES[view.world]?.({ g, horizonY: HORIZON_Y, target, now: view.now, route: view.route, world: view.world });
}

// How dark the face of the cliff runs directly under the lip, and over how
// many pixels it gives way to the land below. A drop is read from its own
// shadow: the ground the player is standing on has to visibly stop having
// anything under it, or the map beyond simply looks like more of the road.
const DROP_SHADE = 0x000000;
const DROP_ALPHA = 0.42;
// Sized against the gap it falls into rather than fixed, so the shade under
// the lip never grows to swallow the land it is supposed to be in front of.
const DROP_FRACTION = 0.16;
const DROP_MAX_H = 26;

// Where the land below actually lies, in tiles past the cliff lip: its near
// (south) coast and its far (north) one. The map is placed by these two ground
// rows and nothing else, which is what makes it a country lying at a fixed
// distance rather than a backdrop -- walking toward the edge brings it up and
// opens it out exactly as much as ground at that distance opens out, and
// standing still leaves it standing still. The near offset is the stretch of
// ground directly under a cliff that a standing figure cannot see, and the two
// together also bound how wide the land can ever draw: the coastline is scaled
// uniformly off the gap between them, so the country's own proportions turn a
// depth budget into a width.
const OVERLOOK_NEAR_TILES = 1.8;
const OVERLOOK_FAR_TILES = 24;

// What lies past the edge of a world that ends at one: the drop under the
// lip, and the Qumatuomi map lying on the ground far below it (art/
// qumatuomiMap.ts's drawQumatuomiOverlook, WORLDS.md section 4). Everything
// between the horizon line and the lip belongs to this pass -- the terrain
// sweep draws nothing past a cliff (terrain/paint.ts's drawMarginRows), so
// this is what fills the gap it leaves.
function drawOverlook(g: Phaser.GameObjects.Graphics, view: AtmosphereView, target: number) {
  if (!view.overlook) return;
  const { lipY, lipDepth, lane } = view.overlook;
  if (lipY <= HORIZON_Y) return;

  // The land's two coasts are two ground rows, projected the same way every
  // tile in the world is; its middle row is what it is centred on sideways.
  // Depth alone decides the screen y, so both edges are read at the country's
  // own lane without that changing where they sit vertically.
  drawQumatuomiOverlook(g, {
    cx: projectTile(lane, lipDepth + (OVERLOOK_NEAR_TILES + OVERLOOK_FAR_TILES) / 2).x,
    top: projectTile(lane, lipDepth + OVERLOOK_FAR_TILES).y,
    bottom: projectTile(lane, lipDepth + OVERLOOK_NEAR_TILES).y,
    target,
    now: view.now,
    route: view.route,
  });

  // The shadow under the lip, painted last of the three so it sits over the
  // land's near edge: what is directly below a cliff is in the cliff's own
  // shade, and the deepest part of it is right against the rock. Abutting
  // rows, so no two share a scanline and double-blend.
  const dropH = Math.min(DROP_MAX_H, (lipY - HORIZON_Y) * DROP_FRACTION);
  const rows = 16;
  for (let i = 0; i < rows; i++) {
    const t = i / rows;
    const y = lipY - dropH + t * dropH;
    if (y < HORIZON_Y) continue;
    g.fillStyle(DROP_SHADE, DROP_ALPHA * Math.pow(t, 1.6));
    g.fillRect(0, y, CANVAS_W, dropH / rows + 1);
  }
}

// How far above the horizon line an open pass reaches, and the depth its
// aperture is measured at. The far part of a pass is the next world's
// interior, not this world's geography, so it lives in the fixed band the
// projection never reaches (WORLDS.md section 4's far/near split) -- which
// means its width is a chosen reading distance rather than a projected one.
// The band's own foot is that distance: the aperture is exactly as wide as
// the throat would be if it stood where the horizon band begins.
// How far above the horizon line the opening reaches. Only a sliver of the
// far world's sky is drawn up there: the far part of a pass belongs to the
// fixed band around the horizon line (WORLDS.md section 4's far/near split),
// a tall shape standing out of the line reads as a beam of light rather than
// as a gap, and the neighbour's own silhouette is drawn over this and has to
// keep the sky it stands in.
const APERTURE_H = 10;
// The depth the opening's base and width are both taken at: the foot of the
// horizon band, which is where the road last *reads*. The band washes the
// deepest rows to nothing well before the terrain sweep actually stops, so an
// opening anchored on the last row drawn hangs above a road the player can no
// longer see -- and a gap the road does not visibly run into is a beam.
// Taking the width here too means the base matches the road's own width
// there exactly, since both are the same three tiles at the same depth.
const APERTURE_DEPTH = DRAW_DISTANCE_TILES * HORIZON_BAND_FROM;
// What sits inside the opening is the far world itself, split at the horizon
// line: its low sky above, its walkable ground below. An opening filled with
// one flat glow is a lamp; an opening with a horizon in it is a place.
//
// Painted as abutting rows, each exactly as tall as its own step so no two
// ever share a scanline (the trap fillVerticalFade's comment describes). Rows
// are what let the strength fall to nothing at both ends: strongest at the
// horizon line, where the sightline through the gap is longest, and gone by
// the top and again well before the road below is still clearly this world's.
// So the opening has no edge anywhere, and spills onto the road rather than
// standing on it as a slab.
const APERTURE_ROWS = 48;
const APERTURE_PEAK = 0.5;
// How far the view through the gap is carried into the live fog target. It is
// scenery seen at the limit of the draw distance, so it obeys the same
// atmosphere as everything else out there -- an unhazed one would read as an
// interface element cut into the sky.
const APERTURE_DROWN = 0.35;

// The light through the doorway: once a world's rival has fallen, the pass
// clears and what stands at the end of the road is the next world's own
// palette -- the brightest thing on screen in the early worlds and the most
// wrongly-coloured in the late ones. Diegetic, because what shows through the
// gap is the destination itself.
//
// Nothing at all is drawn while the gate is shut. A body in the way is a
// plainer statement than any weather over the gap, and a shut pass showing a
// fogged notch would be showing something of a world it is refusing to show.
function drawPassAperture(g: Phaser.GameObjects.Graphics, view: AtmosphereView, target: number) {
  const gate = view.gate;
  if (!gate?.open || !gate.next) return;

  // The road converges toward the vanishing point, so the opening sits where
  // this world's own corridor runs out rather than dead centre of the frame.
  const cx = projectTile(gate.lane, DRAW_DISTANCE_TILES).x;
  const p = projectTile(0, APERTURE_DEPTH);
  const halfW = gate.halfTiles * TILE_SCALE * LANE_PX * p.scale;
  const foot = p.y;
  const top = HORIZON_Y - APERTURE_H;
  // The far world's own sky and ground, read straight off the neighbour's
  // entry and never off this world's -- what makes the opening read is that
  // the palette inside it is foreign. Both drowned into the live fog target,
  // the same way the silhouette beside them is.
  const sky = blend(gate.next.skyBottom, target, APERTURE_DROWN);
  const ground = blend(gate.next.path, target, APERTURE_DROWN);
  const rowH = (foot - top) / APERTURE_ROWS;
  // Where the horizon line falls as a fraction of the whole opening. The two
  // planes are one plane -- the world through the gap stands on the same
  // ground this one does -- so it shares this world's horizon.
  const splitT = (HORIZON_Y - top) / (foot - top);

  for (let i = 0; i < APERTURE_ROWS; i++) {
    const t = i / APERTURE_ROWS;
    const y = top + i * rowH;
    // The road's own convergence: below the line the gap is as wide as the
    // throat is at the depth that row sits at, so the opening *is* the far end
    // of the road rather than a shape standing on it. Floored so the sliver of
    // sky above the line is still a slot rather than a point.
    const w = halfW * Math.max(0.14, (t - splitT) / (1 - splitT));
    const strength = t < splitT ? t / splitT : Math.pow(1 - (t - splitT) / (1 - splitT), 1.4);
    g.fillStyle(t < splitT ? sky : ground, APERTURE_PEAK * strength);
    g.fillRect(cx - w, y, w * 2, rowH);
  }
}

// A vertical alpha ramp, painted as abutting one-pixel rows in whatever color
// `colorAt` gives that row. The rows must not overlap: two translucent rects
// sharing a scanline blend twice there, which draws a bright line at every
// seam -- invisible while the color is close to the ground under it, and
// stripes across the whole far distance as soon as it is not (a haze carrying
// the next world's fog color, biomes.ts's note on holding `fogTarget` near
// the floor colors).
// How tall one band of a vertical fade is. A band interpolates linearly where
// the ramp it stands in may curve, and that error falls with the square of the
// band count -- ten pixels holds it near a thousandth of an alpha step on the
// steepest ramp here, which is well under what a screen can show.
const FADE_BAND_PX = 10;

function fillVerticalFade(
  g: Phaser.GameObjects.Graphics,
  colorAt: (y: number) => number,
  top: number,
  height: number,
  alphaAt: (t: number) => number
) {
  // Painted as a handful of gradient bands rather than a row of flat ones.
  // Phaser interpolates both colour and alpha across a rect's corners, so one
  // band covering ten scanlines carries the same ramp those ten flat rows
  // spelled out one at a time -- and the ramp is what this draws, so a
  // continuous one is if anything truer to it than a staircase was. The whole
  // atmosphere is repainted every frame in every world, and at a row apiece
  // this was the single most numerous thing the game drew.
  //
  // Bands still abut exactly rather than overlapping: two translucent rects
  // sharing a scanline blend twice there and draw a bright line at every seam.
  const bands = Math.max(1, Math.min(Math.round(height), Math.ceil(height / FADE_BAND_PX)));
  for (let i = 0; i < bands; i++) {
    const t0 = i / bands;
    const t1 = (i + 1) / bands;
    const y0 = top + t0 * height;
    const y1 = top + t1 * height;
    // The ramp still arrives at alphaAt(1) exactly on the last band's lower
    // edge. A fade that has to arrive opaque (the sky blend meeting the
    // horizon line) otherwise stops short and leaves a sliver of un-hazed sky
    // against fully-hazed mist -- a hairline seam at precisely the join this
    // pass exists to remove.
    const cTop = colorAt(y0);
    const cBot = colorAt(y1);
    g.fillGradientStyle(cTop, cTop, cBot, cBot, alphaAt(t0), alphaAt(t0), alphaAt(t1), alphaAt(t1));
    g.fillRect(0, y0, CANVAS_W, y1 - y0);
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
// swallow is zero: the Entangled Web has no surround to show, and the
// Devouring Mirror ends at a cliff instead. World 6's forward horizon
// emptying out is that rule arriving as a story beat rather than as a
// special case.
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

  // The world *depicted*, which is the neighbour ahead -- a distant self is
  // that world seen from a world away, not the one being stood in.
  self.sky?.({ g, horizonY: HORIZON_Y, target, now: view.now, route: view.route, world: view.world + 1 });
}

// One copy of the silhouette: the strip between its crest (dropped `drop`
// pixels) and a floor sitting `foot` of the way up its own local height.
// Measuring the floor against the local height rather than a flat screen
// line is what makes the mist pool -- a shallow dip is swallowed whole while
// a crest beside it still clears the fog. Crests are clamped to MAX_CREST,
// which is the height the mist band is sized to cover; a profile reaching
// past it would stand against open sky.
// Painted as one quad per profile segment rather than as a single filled
// path. The floor is clamped up to the crest wherever a dip is swallowed
// whole, so the outline's two sides meet there and the path touches itself --
// and a self-touching path sends Phaser's triangulator down its recovery
// path, which is quadratic in the point count. A profile is a couple of
// hundred points and the whole silhouette is redrawn `passes` times a frame,
// which made this one shape the most expensive thing the game drew.
//
// The strip covers exactly the same region: consecutive quads share an edge,
// and a segment whose floor has already met its crest contributes no area.
function fillSilhouette(g: Phaser.GameObjects.Graphics, profile: HorizonPoint[], foot: number, drop: number) {
  let prevX = 0;
  let prevCrest = 0;
  let prevFloor = 0;
  for (let i = 0; i < profile.length; i++) {
    const p = profile[i];
    const h = Math.min(p.h, MAX_CREST);
    const crest = HORIZON_Y - h + drop;
    const floor = Math.max(HORIZON_Y - h * foot, crest);
    // A segment whose floor has met its crest at both ends is a strip of no
    // height: it covers nothing, and the later swallow steps leave every
    // shallow dip in the profile exactly there.
    if (i > 0 && (floor > crest || prevFloor > prevCrest)) {
      g.fillTriangle(prevX, prevCrest, p.x, crest, p.x, floor);
      g.fillTriangle(prevX, prevCrest, p.x, floor, prevX, prevFloor);
    }
    prevX = p.x;
    prevCrest = crest;
    prevFloor = floor;
  }
}
