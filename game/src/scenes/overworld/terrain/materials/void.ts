import Phaser from 'phaser';
import type { AccentTile } from '../types';

// 'void' (Topological Islands, world 3): the dark drop between islands --
// a couple of faint stars glinting up out of it, so stepping off the path
// reads as falling into open space rather than onto darker ground.
export function drawVoidAccent(g: Phaser.GameObjects.Graphics, { cx, cy, s, now }: AccentTile) {
  const twinkle = 0.45 + 0.35 * Math.sin(now / 700 + cx * 0.07 + cy * 0.05);

  g.fillStyle(0xdfe9ff, 0.7 * twinkle);
  g.fillCircle(cx - 1.8 * s, cy - 0.7 * s, 0.5 * s);
  g.fillStyle(0xdfe9ff, 0.45 * (1 - twinkle));
  g.fillCircle(cx + 1.5 * s, cy + 0.8 * s, 0.4 * s);
}
