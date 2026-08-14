import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { LANE_PX } from '../../../../art/perspective';
import { DEAD_TREE, drawTree, hasTree } from '../../../../art/trees';
import { TILE_SCALE } from '../../projection';
import type { AccentTile } from '../types';

// 'fog' (the Splitting Hollow, world 8): a dead wood standing in fog that
// takes you.
//
// **The threat is the fog, not the trees.** Trees are the Mean Fields'
// "you just would not walk there", and reusing that logic at world eight of
// ten would walk the escalation spine backwards. So the fog is drawn as the
// hazard -- it thickens over the impassable ground until the wood inside it
// is barely there, and it is the medium that absorbs whatever strays into
// it, which is Kondo screening and spinon confinement made into terrain
// rather than into a diagram.
//
// The trees themselves are the Mean Fields' own sprites, dead and grey
// (art/trees.ts). That reuse is the game's one real story beat rather than an
// optimization: the friendly wood skirted at the start is the thing the
// player is lost inside near the end, and it only lands if the trees are
// recognisable. Their trunks fork here, matching the corridor and the physics
// -- one excitation reading as two.
const TILE_PX = TILE_SCALE * LANE_PX;

// How often a fragment of the player's own material shows in the surround --
// rare, because it is a hint rather than a feature. This is the recognition
// seed: the first sign that the world contains things like the player, set
// immediately before the last world turns out to be built out of them.
const SHARD_RATE = 0.045;

function hash(gx: number, gy: number, salt: number): number {
  const s = Math.sin(gx * 41.7 + gy * 289.1 + salt * 13.3) * 43758.5453;
  return s - Math.floor(s);
}

export function drawFogAccent(g: Phaser.GameObjects.Graphics, tile: AccentTile) {
  const { cx, cy, s, gx, gy, depth, haze, detail, playerColor, now } = tile;
  if (detail <= 0) return;
  const u = TILE_PX * s;

  if (hasTree(gx, gy)) drawTree(g, tile, DEAD_TREE);

  if (hash(gx, gy, 7) < SHARD_RATE) {
    // A splinter of the player's own crystal, half-buried and lit only by the
    // fog around it -- self-luminous, since after world seven no light
    // arrives from anywhere else.
    const glow = blend(playerColor, haze, depth * 0.5);
    g.fillStyle(glow, 0.75 * detail);
    g.fillTriangle(cx, cy - 0.36 * u, cx - 0.11 * u, cy + 0.06 * u, cx + 0.11 * u, cy + 0.06 * u);
    g.fillStyle(0xffffff, 0.3 * detail);
    g.fillTriangle(cx, cy - 0.36 * u, cx - 0.04 * u, cy - 0.04 * u, cx + 0.03 * u, cy - 0.06 * u);
  }

  // The fog itself, over everything the tile holds: a slow drifting bank that
  // is denser here than over the walkable route, so straying off the path is
  // visibly walking into the thing rather than merely away from the light.
  const drift = Math.sin(now / 2600 + gx * 0.5 + gy * 0.3);
  g.fillStyle(blend(0xbcc8bc, haze, 0.35), (0.3 + 0.1 * drift) * detail);
  g.fillPoints(tile.fill, true);
}
