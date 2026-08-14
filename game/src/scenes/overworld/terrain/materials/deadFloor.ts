import Phaser from 'phaser';
import type { AccentTile } from '../types';

// 'deadFloor' (the Edge Cliffs, world 3): the sunken bulk on either side of
// the ledge -- extended flat expanses of dead color one storey down,
// crystallized, airless, with nothing moving in them.
//
// Two things this must not be. It must not be void: nothingness is the
// Entangled Web's one card, and spending it at world three pre-spoils the
// emotional peak the light rule exists to protect. And a gapped bulk really
// is matter -- present, extended, inert, merely unavailable -- so drawing it
// as absence would also be the wrong physics.
//
// Nothing here animates. Wind races across this world's sky while the ground
// stays perfectly still, and that contradiction is the horror rather than an
// oversight, so the stipple must never acquire a shimmer.
//
// The speckle is a strict lattice rather than noise, sheared by a whole
// number of steps per tile so that neighbouring tiles' lattices beat against
// each other into a frozen moire. Random noise at this scale reads as a
// rendering artifact -- the exact failure this world's texture has to avoid,
// since a player cannot tell a deliberately grainy surface from a broken one.
const SPECKLE = 3;

export function drawDeadFloorAccent(g: Phaser.GameObjects.Graphics, { cx, cy, s, gx, gy, detail }: AccentTile) {
  if (detail <= 0) return;
  const step = 2.6 * s;
  const shear = ((gx * 7 + gy * 13) % SPECKLE) - 1;

  g.fillStyle(0xffffff, 0.13 * detail);
  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      g.fillRect(cx + (col + row * shear * 0.3) * step, cy + row * step * 0.55, 0.9 * s, 0.9 * s);
    }
  }
  // One darker cleavage line per tile, at one of three fixed orientations --
  // the flat faces a crystal breaks along, which is what makes the surface
  // read as crystallized rather than merely dusty.
  const angle = (((gx * 5 + gy * 3) % 3) * Math.PI) / 3;
  g.lineStyle(1, 0x000000, 0.22 * detail);
  g.lineBetween(
    cx - Math.cos(angle) * 3.2 * s,
    cy - Math.sin(angle) * 1.8 * s,
    cx + Math.cos(angle) * 3.2 * s,
    cy + Math.sin(angle) * 1.8 * s
  );
}
