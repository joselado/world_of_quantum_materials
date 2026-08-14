import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import type { AccentTile } from '../types';

// 'charged' (the Storm Flats, world 4): ground carrying the field the whole
// world is under. Fourth on the escalation spine, so it has crossed from
// "you would not walk there" into "it would hurt you" -- the first impassable
// terrain in the game that is actively dangerous rather than merely dense.
//
// Discharges crawl over it on a slow world-anchored cycle. The phase comes
// off the tile's grid position, not its screen position: a crackle that
// slides across the ground as the camera moves belongs to the screen rather
// than to the world, and this is terrain, not an overlay.
export function drawChargedAccent(g: Phaser.GameObjects.Graphics, { cx, cy, s, gx, gy, depth, haze, detail, now }: AccentTile) {
  if (detail <= 0) return;

  const phase = now / 700 + gx * 0.9 + gy * 0.6;
  const live = Math.sin(phase);
  if (live <= 0) return;

  const air = depth * 0.7;
  const arc = blend(0x8fb4ff, haze, air);
  g.lineStyle(1, arc, 0.5 * live * detail);
  // A short forked filament, its shape fixed per tile so the ground is a
  // charged surface with structure rather than a field of random sparks.
  const lean = ((gx * 3 + gy * 5) % 5) / 4 - 0.5;
  g.beginPath();
  g.moveTo(cx - 2.6 * s, cy + 1.4 * s);
  g.lineTo(cx + lean * 2 * s, cy);
  g.lineTo(cx + 0.6 * s, cy - 0.6 * s);
  g.lineTo(cx + 2.8 * s, cy - 1.6 * s);
  g.strokePath();

  g.fillStyle(blend(0xdfe8ff, haze, air), 0.45 * live * detail);
  g.fillCircle(cx + lean * 2 * s, cy, 0.7 * s);
}
