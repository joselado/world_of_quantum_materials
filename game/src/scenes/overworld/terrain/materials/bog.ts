import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { LANE_PX } from '../../../../art/perspective';
import { ellipseSteps } from '../../../../art/shapes';
import { GRID_H, TILE_SCALE } from '../../projection';
import type { AccentTile } from '../types';

// 'bog' (the Screened Swamp, world 8): the open water the peat banks thread
// between, the reeds standing out of it, and the local moments burning in it.
//
// **The threat is the water, not the reeds.** Reeds are the Mean Fields'
// "you just would not walk there", and reusing that logic at world eight of
// ten would walk the escalation spine backwards. So the water is drawn as the
// hazard -- mist gathers on it until the pool is barely readable as a
// surface, and it is the medium that absorbs whatever strays into it, which
// is Kondo screening and spinon confinement made into terrain rather than
// into a diagram.
//
// **Screening is drawn as itself.** A lone bright point in the water is a
// local moment, and the ring of small cool counter-lights gathering around it
// is the conduction sea's own carriers crowding in to cancel it -- the Kondo
// screening cloud. Near the entrance the moment still burns through its halo;
// deeper in the halo has closed and the point is out. That is also this
// world's escalation spine: further in is further screened.
//
// The corridor parts around a pool with a moment in it (world8.ts marks those
// tiles as feature cores), so the split and the screening are one picture --
// the path divides because something in the water is being put out.
const TILE_PX = TILE_SCALE * LANE_PX;

// How often a water tile carries a reed clump. Reeds cluster rather than
// carpet, which is what leaves open water between them to be a pool at all.
const REED_RATE = 0.5;

// How often a tile carries a surface glint. Sparser than the reeds: a still
// pool catches the light in patches, and a glint on every tile is a texture
// rather than a surface.
const GLINT_RATE = 0.3;

// How often open water holds a lone moment of its own, beyond the ones the
// generator places in the split pools. Rare: the marked ones carry the
// picture, and these are the world repeating it where the player is not
// being shown anything.
const AMBIENT_MOMENT_RATE = 0.012;

// How often a pool shows the player's own crystal back at them -- rare,
// because it is a hint rather than a feature. This is the recognition seed:
// the first sign that the world contains things like the player, set
// immediately before the last world turns out to be built out of them. A
// suggestion rather than a mirror, per STYLE.md's cost rule -- a few soft
// shapes in the player's colour, wavering on the water.
const REFLECTION_RATE = 0.035;

// Where along the world the halos finish closing. Measured in "deepness",
// zero at the southern entrance row and one at the goal, so the screening
// runs with progress through the world rather than with the camera.
const SCREEN_FROM = 0.12;
const SCREEN_TO = 0.78;

function hash(gx: number, gy: number, salt: number): number {
  const s = Math.sin(gx * 41.7 + gy * 289.1 + salt * 13.3) * 43758.5453;
  return s - Math.floor(s);
}

function smoothstep(from: number, to: number, t: number): number {
  const u = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return u * u * (3 - 2 * u);
}

export function drawBogAccent(g: Phaser.GameObjects.Graphics, tile: AccentTile) {
  const { cx, cy, s, gx, gy, depth, haze, detail, now } = tile;
  if (detail <= 0) return;
  const u = TILE_PX * s;
  const air = depth * 0.8;

  // A glint lying flat on the surface: without one the water is a matte dark
  // fill and reads as mud rather than as a medium something could sink into.
  // Horizontal, always, because a still water surface has no other direction.
  if (hash(gx, gy, 17) < GLINT_RATE) {
    const y = cy + (hash(gx, gy, 19) - 0.5) * 0.5 * u;
    g.lineStyle(1, blend(0x9fb4a6, haze, air), 0.3 * detail);
    g.lineBetween(cx - 0.3 * u, y, cx + 0.28 * u, y);
  }

  if (hash(gx, gy, 11) < REFLECTION_RATE) drawReflection(g, tile, u, air);

  // The generator's own marked pools first, then the scatter the rest of the
  // water carries.
  if (tile.featureCore || hash(gx, gy, 5) < AMBIENT_MOMENT_RATE) drawMoment(g, tile, u, air);

  // The mist, lying on the water rather than through the air: near nothing at
  // the camera, where the water has to hold its near-black, and gathering with
  // distance. Always heavier here than over the peat the player walks, so
  // straying off the bank is visibly walking into the thing rather than merely
  // away from the light.
  const drift = Math.sin(now / 2600 + gx * 0.5 + gy * 0.3);
  g.fillStyle(blend(0xbcc8bc, haze, 0.35), (0.02 + 0.2 * depth + 0.02 * drift) * detail);
  g.fillPoints(tile.fill, true);

  // Reeds last, so they stand out of the mist instead of under it. Stalks
  // only -- a reed is a line, and the clump is what reads, so nothing here is
  // tessellated.
  if (hash(gx, gy, 3) < REED_RATE) drawReeds(g, tile, u, air);
}

// The screening cloud. The moment is a bright cold point; the counter-lights
// are a ring of smaller, dimmer ones that draw inward and brighten as the
// halo shuts, until between them there is nothing left burning.
const HALO_LIGHTS = 6;

function drawMoment(g: Phaser.GameObjects.Graphics, tile: AccentTile, u: number, air: number) {
  const { cx, cy, gx, gy, haze, detail, now } = tile;
  // Deepness, with a little per-moment jitter so the world does not close its
  // halos along one line drawn straight across the map.
  const deep = 1 - gy / (GRID_H - 1) + (hash(gx, gy, 23) - 0.5) * 0.12;
  const shut = smoothstep(SCREEN_FROM, SCREEN_TO, deep);
  const burn = 1 - shut;
  const pulse = 0.75 + 0.25 * Math.sin(now / 1300 + gx * 0.7);

  if (burn > 0.02) {
    // What the moment throws onto the water around it, which is the half the
    // halo is visibly taking away. Two nested washes rather than one: a
    // single flat ellipse has an edge, and light on water does not.
    g.fillStyle(blend(0xdff0e0, haze, air), 0.07 * burn * detail);
    g.fillEllipse(cx, cy, 0.7 * u, 0.4 * u, ellipseSteps(0.7 * u, 0.4 * u));
    g.fillEllipse(cx, cy, 0.4 * u, 0.24 * u, ellipseSteps(0.4 * u, 0.24 * u));
    g.fillStyle(blend(0xeaf8ec, haze, air * 0.5), 0.85 * burn * pulse * detail);
    g.fillCircle(cx, cy, 0.085 * u);
  }

  // The counter-lights: out wide and faint while the moment still burns, in
  // close and solid once it is gone.
  const radius = (0.46 - 0.2 * shut) * u;
  g.fillStyle(blend(0x8fb4c8, haze, air), (0.2 + 0.45 * shut) * detail);
  for (let i = 0; i < HALO_LIGHTS; i++) {
    const a = (i * Math.PI * 2) / HALO_LIGHTS + gx * 0.4 + gy * 0.2;
    g.fillCircle(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius * 0.6, (0.035 + 0.02 * shut) * u);
  }
}

// A reflection, not a mirror: three soft shapes in the player's own colour,
// broken apart and sliding against each other the way a shape on moving water
// does. Drowned into the same air as everything else out here, and gone with
// the rest of the detail before the horizon.
function drawReflection(g: Phaser.GameObjects.Graphics, tile: AccentTile, u: number, air: number) {
  const { cx, cy, gx, playerColor, haze, detail, now } = tile;
  const tint = blend(playerColor, haze, 0.35 + air * 0.5);
  for (let i = 0; i < 3; i++) {
    const waver = Math.sin(now / 900 + gx * 0.6 + i * 2.1);
    const w = (0.34 - i * 0.07) * u;
    const h = (0.09 - i * 0.015) * u;
    g.fillStyle(tint, (0.3 - i * 0.07) * detail);
    g.fillEllipse(cx + waver * 0.05 * u, cy + (i - 1) * 0.13 * u, w, h, ellipseSteps(w, h));
  }
}

// A clump of stalks leaning off one another, darker than both the water they
// stand in and the mist they stand through -- this world's only upright
// silhouette, and the reason its skyline stays horizontal.
const REED_STALKS = 5;
// Below this much detail left, the clump is a smudge and only its two tallest
// stalks survive the haze, so the rest cost strokes to change nothing.
const REED_SILHOUETTE_DETAIL = 0.45;

function drawReeds(g: Phaser.GameObjects.Graphics, tile: AccentTile, u: number, air: number) {
  const { cx, cy, gx, gy, haze, detail } = tile;
  const stalks = detail < REED_SILHOUETTE_DETAIL ? 2 : REED_STALKS;
  // Jittered off the tile centre in both axes: clumps pinned to row centres
  // read as planted rows rather than as wild growth.
  const root = cx + (hash(gx, gy, 21) - 0.5) * 0.8 * u;
  const base = cy + (0.1 + hash(gx, gy, 22) * 0.5) * u;
  g.lineStyle(1.2, blend(0x0d120e, haze, air), 0.85 * detail);
  for (let i = 0; i < stalks; i++) {
    const off = (hash(gx, gy, 30 + i) - 0.5) * 0.7 * u;
    const height = (0.4 + hash(gx, gy, 40 + i) * 0.45) * u;
    const lean = (hash(gx, gy, 50 + i) - 0.5) * 0.3 * u;
    g.lineBetween(root + off, base, root + off + lean, base - height);
  }
}
