import Phaser from 'phaser';
import type { AccentTile } from '../types';

// 'lava' (Defect Wastes, world 9): a glowing molten crust over the off-path
// fill -- a pulsing warm wash, a bright crack line and a hot core dot.
export function drawLavaAccent(g: Phaser.GameObjects.Graphics, { fill, cx, cy, s, now }: AccentTile) {
  // Phase from the tile's screen position, geometry from its own center.
  // The spatial frequency is kept low -- a fraction of a radian between
  // neighboring tiles -- so the glow drifts across the crust as broad slow
  // waves; a phase step of a radian or more per tile makes adjacent tiles
  // pulse against each other and the whole crust read as a checkerboard of
  // the very tile grid the smoothed terrain is meant to hide. The wash is
  // also held dim enough that the crust never climbs toward the scorched
  // clay of the walkable route (biomes.ts's crackedWorld) -- the world
  // stays all reds, told apart by value.
  const pulse = 0.55 + 0.45 * Math.sin(now / 260 + cx * 0.012 + cy * 0.007);

  g.fillStyle(0xff5a1a, 0.24 * pulse);
  g.fillPoints(fill, true);

  g.lineStyle(1.6, 0xffcf4a, 0.6 * pulse);
  g.beginPath();
  g.moveTo(cx - 2.6 * s, cy - 1.2 * s);
  g.lineTo(cx - 0.4 * s, cy + 0.6 * s);
  g.lineTo(cx + 1.6 * s, cy - 0.8 * s);
  g.strokePath();

  g.fillStyle(0xfff0a0, 0.55 * pulse);
  g.fillCircle(cx, cy, 1.1 * s * pulse);
}
