import Phaser from 'phaser';
import { blend } from './colors';
import { LANE_PX } from './perspective';
import { ellipseSteps, fillPolygon } from './shapes';
import { TILE_SCALE } from '../scenes/overworld/projection';
import type { AccentTile } from '../scenes/overworld/terrain/types';

// The Mean Fields' dense summer canopy (terrain/materials/forest.ts), and
// the only wood in the game.
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
}

export const SUMMER_TREE: TreeStyle = {
  canopy: 0x2f7038,
  canopyShade: 0x18401f,
  trunk: 0x53381f,
  alpha: 1,
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
// a tree is drawn at full strength, so the near wood always gets the full
// lobed crown, and the tiers move with the fade if its range ever moves.
// Below this much of it left, the tree is a smudge against the haze and none
// of its shape survives, so it collapses to one blob.
const CROWN_SILHOUETTE_DETAIL = 0.45;

// The three lobes of a full-strength crown, in units of `size`: centre offset,
// and semi-axes -- half the width and height an ellipse of that lobe would be
// drawn at, since Phaser sizes an ellipse by its diameters. The one place
// their layout is stated.
const CROWN_LOBES = [
  { dx: -0.12, dy: 0, rx: 0.15, ry: 0.115 },
  { dx: 0.12, dy: 0, rx: 0.135, ry: 0.105 },
  { dx: 0, dy: -0.12, rx: 0.155, ry: 0.115 },
];

// The outline of those three lobes fused into one, worked out once at load and
// scaled per tree. The lobes are a single colour at full alpha, so their union
// is the whole of what reaches the screen and drawing it as one shape paints
// the same crown for a third of the fills -- and a wood is hundreds of crowns
// a frame, so the two fills saved on each are the difference between the
// Mean Fields costing several times what every other world costs and costing
// about the same.
//
// Every lobe contains the crown's own centre, so the union is star-shaped
// about it: one radius per angle describes the whole outline. That radius is
// the furthest any lobe reaches along the ray, which is the standard
// ray/ellipse intersection -- the origin sits inside each ellipse, so each has
// exactly one root ahead of it.
function unionRadius(cos: number, sin: number): number {
  let far = 0;
  for (const l of CROWN_LOBES) {
    const a = (cos * cos) / (l.rx * l.rx) + (sin * sin) / (l.ry * l.ry);
    const b = -2 * ((l.dx * cos) / (l.rx * l.rx) + (l.dy * sin) / (l.ry * l.ry));
    const c = (l.dx * l.dx) / (l.rx * l.rx) + (l.dy * l.dy) / (l.ry * l.ry) - 1;
    const t = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    if (t > far) far = t;
  }
  return far;
}

// One outline per point count the size buckets can ask for (art/shapes.ts),
// so a distant crown is described by as few points as its own size warrants,
// the same budget every other round shape here is held to.
const CROWN_OUTLINES = new Map<number, { x: number; y: number }[]>();

function crownOutline(steps: number): { x: number; y: number }[] {
  let pts = CROWN_OUTLINES.get(steps);
  if (pts) return pts;
  pts = [];
  for (let i = 0; i < steps; i++) {
    const ang = (Math.PI * 2 * i) / steps;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const r = unionRadius(cos, sin);
    pts.push({ x: cos * r, y: sin * r });
  }
  CROWN_OUTLINES.set(steps, pts);
  return pts;
}

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
  g.fillRect(x - 0.035 * size, base - trunkH, 0.07 * size, trunkH + 0.02 * size);

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
  // The three lobes as one shape (CROWN_OUTLINES). Sized off the widest lobe,
  // so the point count tracks what the crown actually spans on screen.
  const outline = crownOutline(ellipseSteps(0.55 * size, 0.35 * size));
  const pts = new Array<{ x: number; y: number }>(outline.length);
  for (let i = 0; i < outline.length; i++) {
    pts[i] = { x: x + outline[i].x * size, y: crownY + outline[i].y * size };
  }
  fillPolygon(g, pts);
}

function ellipse(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillEllipse(x, y, w, h, ellipseSteps(w, h));
}
