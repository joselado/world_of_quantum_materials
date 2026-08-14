import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { LANE_PX } from '../../../../art/perspective';
import { TILE_SCALE } from '../../projection';
import type { AccentTile } from '../types';

// 'columns' (the Stone Lattice, world 2): rows of identical sandstone columns
// with deep shadow between them -- the game's only architecture, and the only
// impassable terrain that was built rather than grown.
//
// The columns stand on a strict lattice of the grid itself, one every second
// tile in both directions, because that is the whole point: a colonnade is a
// one-dimensional lattice and the player is standing inside the mathematical
// object rather than beside a picture of one. Any jitter here would draw a
// ruin, and a ruin is a different world.
const COLUMN_SPACING = 2;
const TILE_PX = TILE_SCALE * LANE_PX;

const STONE_LIT = 0xd9c19a;
const STONE_SHADE = 0x8f7051;
const STONE_CAP = 0xe8d6b4;

export function drawColumnsAccent(g: Phaser.GameObjects.Graphics, { cx, cy, s, gx, gy, depth, haze, detail }: AccentTile) {
  if (detail <= 0) return;
  if (gx % COLUMN_SPACING !== 0 || gy % COLUMN_SPACING !== 0) return;

  const u = TILE_PX * s;
  const shaftW = 0.34 * u;
  const shaftH = 1.5 * u;
  const air = depth * 0.8;
  const top = cy - shaftH;

  // The sun is high and from the left all through this world, so every shaft
  // is lit on the same side and every gap between them is the same deep cast
  // shadow. One light direction is what stops a field of identical objects
  // from reading as a texture.
  g.fillStyle(blend(STONE_SHADE, haze, air), detail);
  g.fillRect(cx - shaftW / 2, top, shaftW, shaftH);
  g.fillStyle(blend(STONE_LIT, haze, air), detail);
  g.fillRect(cx - shaftW / 2, top, shaftW * 0.55, shaftH);

  // Capital and base, both a little wider than the shaft: the two places a
  // column stops being a rectangle.
  g.fillStyle(blend(STONE_CAP, haze, air), detail);
  g.fillRect(cx - shaftW * 0.66, top, shaftW * 1.32, 0.12 * u);
  g.fillStyle(blend(STONE_SHADE, haze, air), air > 0.5 ? detail : detail * 0.9);
  g.fillRect(cx - shaftW * 0.66, cy - 0.1 * u, shaftW * 1.32, 0.1 * u);
}
