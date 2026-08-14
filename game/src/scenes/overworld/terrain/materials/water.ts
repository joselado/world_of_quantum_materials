import Phaser from 'phaser';
import type { AccentTile } from '../types';

// 'water' (Frozen Caverns, world 5): a rippling frozen lake -- shimmer
// streaks and a pale highlight drifting over the off-path fill.
export function drawWaterAccent(g: Phaser.GameObjects.Graphics, { cx, cy, s, now }: AccentTile) {
  const shimmer = 0.4 + 0.35 * Math.sin(now / 420 + cx * 0.04);

  g.lineStyle(1, 0xcdeeff, 0.35 * shimmer);
  g.lineBetween(cx - 2.4 * s, cy - 0.4 * s, cx + 2.4 * s, cy - 0.9 * s);
  g.lineBetween(cx - 2 * s, cy + 0.6 * s, cx + 2 * s, cy + 0.2 * s);

  g.fillStyle(0xffffff, 0.2 * shimmer);
  g.fillEllipse(cx - 0.6 * s, cy - 0.5 * s, 2.4 * s, 0.6 * s);
}
