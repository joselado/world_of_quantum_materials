import Phaser from 'phaser';
import type { ContourPoint } from '../../../art/contours';
import { LANE_PX } from '../../../art/perspective';
import type { ProjectedPoint } from '../../../art/perspective';
import { CANVAS_H, CANVAS_W } from '../../../config/screen';
import { TILE_SCALE, projectStanding } from '../projection';
import type { AccentTile, AvatarBox } from './types';

// What every material that stands an object on its tile places the object
// with (materials/index.ts's `standing` draws): the one ground point the
// object's foot is on, and whether any of the object is in the frame.

// A tile's width on screen at unit depth scale.
const TILE_PX = TILE_SCALE * LANE_PX;

// The point of the ground `dLane` tiles to the right of the tile's centre and
// `dNear` tiles nearer the camera than it, on screen, with the depth scale
// there. The object is placed and sized by this one projection, so it moves
// on screen exactly as the ground under it does, at every distance and on
// past the frame's bottom edge (projection.ts's projectStanding has no clamp
// at the camera's plane). An offset under half a tile keeps the object on its
// own tile, and keeps a row's objects nearer than those of the row beyond it,
// which is the order the sweep paints them in.
//
//
// On a tile at the walkable boundary the tile's own ground is not the whole
// square: the boundary curves through it, and part of the square is road. An
// object thrown off the centre there is drawn back toward the middle of the
// tile's traced outline until its foot, and `reach` tiles to either side of
// it, are on the tile's own ground, so nothing stands on the road. An object
// at the centre itself (a column, on its lattice) is never moved: the boundary
// stays under half a tile from the tile's edge.
//
// The battle arena's stand has no ground point to give (`lane`/`ahead` are
// null there): its tiles are laid out on screen and seen from one spot. There
// the offset is taken on screen instead, `screenDx`/`screenDy` tile-widths
// from the tile's own centre, at the tile's own scale.
export function standingPoint(tile: AccentTile, dLane: number, dNear: number, screenDx = dLane, screenDy = dNear, reach = 0): ProjectedPoint {
  if (tile.lane !== null && tile.ahead !== null) {
    if (tile.outline && (dLane !== 0 || dNear !== 0)) {
      holdOnTile(tile.outline, tile.gx, tile.gy, dLane, dNear, reach);
      return projectStanding(tile.lane + heldLane, tile.ahead - heldNear);
    }
    return projectStanding(tile.lane + dLane, tile.ahead - dNear);
  }
  const u = TILE_PX * tile.s;
  return { x: tile.cx + screenDx * u, y: tile.cy + screenDy * u, scale: tile.s };
}

// The throw holdOnTile settled on, relative to the tile's centre. Module
// state rather than a returned pair: this runs for every object on every
// boundary tile of every frame.
let heldLane = 0;
let heldNear = 0;
// How many times the throw is halved toward the outline's middle before the
// object is left where it is: by then it stands a sixteenth of the way out.
const HOLD_STEPS = 4;

// The middle of each traced outline, the mean of its points, kept for as long
// as the plan holds the outline.
const outlineMiddles = new WeakMap<ContourPoint[], ContourPoint>();

function holdOnTile(outline: ContourPoint[], gx: number, gy: number, dLane: number, dNear: number, reach: number) {
  let mid = outlineMiddles.get(outline);
  if (!mid) {
    mid = { x: 0, y: 0 };
    for (const p of outline) {
      mid.x += p.x / outline.length;
      mid.y += p.y / outline.length;
    }
    outlineMiddles.set(outline, mid);
  }
  // Grid y grows toward the camera, so `dNear` adds to it.
  let x = gx + dLane;
  let y = gy + dNear;
  for (let step = 0; step < HOLD_STEPS; step++) {
    if (inOutline(outline, x, y) && (reach === 0 || (inOutline(outline, x - reach, y) && inOutline(outline, x + reach, y)))) break;
    x = (x + mid.x) / 2;
    y = (y + mid.y) / 2;
  }
  heldLane = x - gx;
  heldNear = y - gy;
}

// Whether a ground point lies inside a traced outline: the crossings of a ray
// from the point with the outline's sides are odd in number.
function inOutline(outline: ContourPoint[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i];
    const b = outline[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// The layer over the player's crystal and the crystal's place on screen, for
// the frame being painted (paint.ts's drawTerrain sets them).
let frontLayer: Phaser.GameObjects.Graphics | null = null;
let avatar: AvatarBox | null = null;

export function setStandingFront(front: Phaser.GameObjects.Graphics | null, box: AvatarBox | null) {
  frontLayer = front;
  avatar = box;
}

// How solid the object standingLayer last placed is to be drawn: every fill
// and stroke of it multiplies its alpha by this.
export let standingAlpha = 1;
// How solid an object is while it stands squarely in front of the crystal.
const SEE_THROUGH = 0.4;
// The see-through comes on over these distances, so nothing changes on one
// frame of walking: how far below the crystal's ground line the object's foot
// is, which is how much nearer the camera it stands, and how far its box
// reaches into the crystal's, sideways and from below. All are zero where the
// object changes layer, so it changes layer at full strength and only the few
// pixels it shares with the crystal change hands. The reach from below is the
// longest: an object leaving by the bottom edge drops fastest of all.
const SEE_THROUGH_NEARER_PX = 30;
const SEE_THROUGH_SIDE_PX = 16;
const SEE_THROUGH_BELOW_PX = 48;

// Which layer a tall standing object is drawn into, or null when none of it
// is in the frame (outOfFrame). The object is centred on its foot's x,
// reaches `halfWidth` to either side and up to `top`.
//
// An object whose foot is nearer the camera than the crystal's own ground
// point is in front of the crystal. While its box crosses the crystal's it
// goes into the layer over the crystal, at a strength (`standingAlpha`) that
// falls to SEE_THROUGH as it comes squarely in front: the depth reads right
// and the crystal stays in view. Everything else stays on the ground layer,
// under every actor. Only what is tall enough to reach the crystal from
// behind it needs this: a column, a tree, a clump of reeds.
export function standingLayer(g: Phaser.GameObjects.Graphics, tile: AccentTile, foot: ProjectedPoint, halfWidth: number, top: number): Phaser.GameObjects.Graphics | null {
  standingAlpha = 1;
  if (outOfFrame(tile, foot.x, halfWidth, top)) return null;
  if (tile.lane === null || !frontLayer || !avatar) return g;
  const nearer = foot.y - avatar.ground;
  if (nearer <= 0) return g;
  const side = halfWidth + avatar.halfWidth - Math.abs(foot.x - avatar.x);
  const below = avatar.ground - top;
  if (side <= 0 || below <= 0) return g;
  const across = Math.min(1, side / SEE_THROUGH_SIDE_PX, below / SEE_THROUGH_BELOW_PX);
  standingAlpha = 1 - (1 - SEE_THROUGH) * Math.min(1, nearer / SEE_THROUGH_NEARER_PX) * across;
  return frontLayer;
}

// Whether an object centred on `x`, reaching `halfWidth` to either side and
// up to `top`, has none of it in the frame: below the bottom edge, or past
// either side. The sweep's lane window is sized for a row's ground, and a row
// near the camera reaches well past the frame's sides; a row whose ground has
// passed under the camera is swept for as long as its tallest object could
// still show (paint.ts's PAST_CAMERA_ROWS). Never true in the battle arena,
// whose layers are moved as a whole after they are drawn.
export function outOfFrame(tile: AccentTile, x: number, halfWidth: number, top: number): boolean {
  if (tile.lane === null) return false;
  return top > CANVAS_H || x + halfWidth < 0 || x - halfWidth > CANVAS_W;
}
