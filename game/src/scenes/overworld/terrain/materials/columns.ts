import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { LANE_PX } from '../../../../art/perspective';
import { TILE_SCALE } from '../../projection';
import { standingAlpha, standingLayer, standingPoint } from '../standing';
import type { AccentTile } from '../types';

// 'columns' (the Stone Lattice, world 2): rows of identical sandstone columns
// with deep shadow between them -- the game's only architecture, and the only
// impassable terrain that was built rather than grown.
//
// The columns stand on a strict lattice, because that is the whole point: a
// colonnade is a lattice and the player is standing inside the mathematical
// object rather than beside a picture of one. Any jitter here would draw a
// ruin, and a ruin is a different world.
//
// Two lattices meet, and both are strict. The generator's own columns -- the
// ones standing inside the hall, on the periodic array with the two-atom basis
// the player walks through (world/generators/world2.ts) -- arrive tagged as
// feature cores, and a column stands on every one of them. Everything else
// impassable is the column field the hall is cut out of, and it carries a
// column every second tile in both directions, which is what makes the hall
// read as an aisle through a colonnade that continues in both directions
// rather than a room with sides.
const COLUMN_SPACING = 2;
const TILE_PX = TILE_SCALE * LANE_PX;

const STONE_LIT = 0xd9c19a;
const STONE_SHADE = 0x8f7051;
const STONE_CAP = 0xe8d6b4;

export function drawColumnsAccent(ground: Phaser.GameObjects.Graphics, tile: AccentTile) {
  const { gx, gy, depth, haze, detail, featureCore } = tile;
  if (detail <= 0) return;
  if (!featureCore && (gx % COLUMN_SPACING !== 0 || gy % COLUMN_SPACING !== 0)) return;

  // The column's foot is the centre of its tile's ground, and the shaft is
  // sized by that point's own distance (terrain/standing.ts).
  const foot = standingPoint(tile, 0, 0);
  const cx = foot.x;
  const cy = foot.y;
  const u = TILE_PX * foot.scale;
  const shaftW = 0.3 * u;
  const shaftH = 2.2 * u;
  const air = depth * 0.8;
  const top = cy - shaftH;
  // The ground layer, or the layer over the player's crystal for a column
  // that stands in front of it.
  const g = standingLayer(ground, tile, foot, shaftW * 0.7, top);
  if (!g) return;
  const solid = detail * standingAlpha;

  // The sun is high and from the left all through this world, so every shaft
  // is lit on the same side and every gap between them is the same deep cast
  // shadow. One light direction is what stops a field of identical objects
  // from reading as a texture.
  g.fillStyle(blend(STONE_SHADE, haze, air), solid);
  g.fillRect(cx - shaftW / 2, top, shaftW, shaftH);
  g.fillStyle(blend(STONE_LIT, haze, air), solid);
  g.fillRect(cx - shaftW / 2, top, shaftW * 0.55, shaftH);

  // Capital and base, both a little wider than the shaft: the two places a
  // column stops being a rectangle.
  g.fillStyle(blend(STONE_CAP, haze, air), solid);
  g.fillRect(cx - shaftW * 0.7, top, shaftW * 1.4, 0.17 * u);
  g.fillStyle(blend(STONE_SHADE, haze, air), air > 0.5 ? solid : solid * 0.9);
  g.fillRect(cx - shaftW * 0.7, cy - 0.13 * u, shaftW * 1.4, 0.13 * u);
}
