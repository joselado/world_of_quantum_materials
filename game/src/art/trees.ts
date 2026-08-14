import Phaser from 'phaser';
import { blend } from './colors';
import { LANE_PX } from './perspective';
import { ellipseSteps } from './shapes';
import { TILE_SCALE } from '../scenes/overworld/projection';
import type { AccentTile } from '../scenes/overworld/terrain/types';

// The game's one shared terrain sprite, drawn by two worlds. The Mean Fields'
// dense summer canopy and the Splitting Hollow's dead wood are the same
// geometry in two palettes, and that is the point rather than an
// optimization: the friendly wood the player skirted the edge of in world one
// is the thing they are lost inside in world eight, and the beat only lands
// if the trees are recognizably the same trees (WORLDS.md sections 2 and 5).
// So anything that changes the drawing changes both worlds at once, which is
// exactly the coupling wanted here.
//
// Trees stand up off the ground plane, unlike every other terrain treatment,
// which is flat by rule. They can, because the terrain sweep paints
// far-to-near: a crown drawn upward from its own tile covers rows beyond it,
// which is the occlusion a standing object should have, and costs nothing --
// no depth buffer, no repaint pass. `TREE_HEIGHT` is the whole of it; at zero
// a tree collapses into a flat canopy blob on its tile.
const TREE_HEIGHT = 1;

// A tile's width on screen at unit depth scale, so a tree is sized against
// the ground it stands on rather than in raw pixels -- the same tree is then
// the same fraction of a tile at every distance.
const TILE_PX = TILE_SCALE * LANE_PX;

export interface TreeStyle {
  canopy: number;
  // The shaded underside of the crown, which is what gives a flat fill mass.
  canopyShade: number;
  trunk: number;
  alpha: number;
  // The Splitting Hollow's trunks fork in two below the crown, matching its
  // corridor and its physics -- one excitation reading as two. The crown
  // above the fork is left alone, since the crown is the half the player has
  // to recognize.
  fork: boolean;
}

export const SUMMER_TREE: TreeStyle = {
  canopy: 0x2f7038,
  canopyShade: 0x18401f,
  trunk: 0x53381f,
  alpha: 1,
  fork: false,
};

// Desaturated near-black grey-green against the summer wood's warm sunlit
// green: the two palettes have to stay clearly apart or the rhyme reads as
// one reused asset rather than as the same forest, later and worse.
export const DEAD_TREE: TreeStyle = {
  canopy: 0x2a2d29,
  canopyShade: 0x171a17,
  trunk: 0x22241f,
  alpha: 1,
  fork: true,
};

// Deterministic per-tile variation, keyed off the grid rather than the
// screen: a wood whose trees resize or shuffle as the camera moves is not a
// wood.
function hash(gx: number, gy: number, salt: number): number {
  const s = Math.sin(gx * 127.1 + gy * 311.7 + salt * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

// Whether this tile carries a tree at all. Not every one does: the gaps are
// what let the ground fill read as shadow between crowns instead of the wood
// reading as a single flat mat of green.
export function hasTree(gx: number, gy: number): boolean {
  return hash(gx, gy, 3) < 0.86;
}

// How much crown a tree gets is tiered on the tile's own `detail`, the fade
// the paint pass already applies over the last stretch before accents stop
// being drawn (terrain/paint.ts). Half the crowns in a frame sit in that
// stretch, and each one otherwise costs a near tree's price to draw structure
// the haze is busy dissolving.
//
// Keying the tiers to `detail` rather than to a distance of this file's own is
// what keeps the rule safe: `detail` is exactly 1 across the whole range where
// a tree is drawn at full strength, so the near wood -- the half the 1-to-8
// rhyme depends on being recognisable (WORLDS.md section 5) -- always gets the
// full lobed crown, and the tiers move with the fade if its range ever moves.
// Below this much of it left, the tree is a smudge against the haze and none
// of its shape survives, so it collapses to one blob.
const CROWN_SILHOUETTE_DETAIL = 0.45;

export function drawTree(g: Phaser.GameObjects.Graphics, tile: AccentTile, style: TreeStyle) {
  const { cx, cy, s, gx, gy, depth, haze, detail } = tile;
  if (detail <= 0) return;
  const u = TILE_PX * s;
  // Jitter off the tile centre, so the wood is not visibly a grid.
  const x = cx + (hash(gx, gy, 1) - 0.5) * 0.9 * u;
  const base = cy + (hash(gx, gy, 2) - 0.5) * 0.7 * u;
  const size = (0.6 + hash(gx, gy, 4) * 0.85) * u;
  const trunkH = 0.3 * size * TREE_HEIGHT;
  const crownY = base - trunkH - 0.16 * size * TREE_HEIGHT;

  // The wood recedes into the same air as the ground under it. Without this
  // the far trees keep their full summer green against a hazed field and the
  // canopy reads as a decal laid over the world.
  const air = depth * 0.8;
  const alpha = style.alpha * detail;

  if (detail < CROWN_SILHOUETTE_DETAIL) {
    // One blob in the mean of the two crown colours, trunk included: at this
    // strength the trunk is a thread the haze has already taken, and drawing
    // it costs a fill to change nothing.
    g.fillStyle(blend(blend(style.canopyShade, style.canopy, 0.5), haze, air), alpha);
    ellipse(g, x, crownY, 0.46 * size, 0.34 * size);
    return;
  }

  g.fillStyle(blend(style.trunk, haze, air), alpha);
  if (style.fork) {
    const spread = 0.1 * size;
    g.fillTriangle(x - 0.035 * size, base, x + 0.035 * size, base, x - spread, crownY);
    g.fillTriangle(x - 0.035 * size, base, x + 0.035 * size, base, x + spread, crownY);
  } else {
    g.fillRect(x - 0.035 * size, base - trunkH, 0.07 * size, trunkH + 0.02 * size);
  }

  // Crown: a shaded lower mass with a lit cap over it, which is enough
  // rounding to read as foliage without becoming a per-leaf drawing. A wood
  // is hundreds of crowns a frame, so each one is tessellated against its own
  // size on screen (art/shapes.ts) rather than at Phaser's fixed count.
  g.fillStyle(blend(style.canopyShade, haze, air), alpha);
  ellipse(g, x, crownY + 0.05 * size, 0.46 * size, 0.32 * size);
  g.fillStyle(blend(style.canopy, haze, air), alpha);
  if (detail < 1) {
    // Once the fade has started on a tree, the gaps between the three lobes
    // are finer than the contrast it has left against the haze, so one cap
    // over the shaded mass carries the crown.
    ellipse(g, x, crownY - 0.04 * size, 0.4 * size, 0.28 * size);
    return;
  }
  ellipse(g, x - 0.12 * size, crownY, 0.3 * size, 0.23 * size);
  ellipse(g, x + 0.12 * size, crownY, 0.27 * size, 0.21 * size);
  ellipse(g, x, crownY - 0.12 * size, 0.31 * size, 0.23 * size);
}

function ellipse(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillEllipse(x, y, w, h, ellipseSteps(w, h));
}
