import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { LANE_PX } from '../../../../art/perspective';
import { ellipseSteps } from '../../../../art/shapes';
import { TILE_SCALE } from '../../projection';
import type { AccentTile } from '../types';

// 'ice' (the Vortex Glacier, world 5): the frozen lake either side of the
// swept corridor, and the vortex pits inside it.
//
// A pit stands on a tile the generator placed as a vortex core and kept
// blocked while the corridor spiralled around it (world/generators/world5.ts).
// It gets a dark rim and a faint cold glow of trapped flux down inside it: the
// field is excluded everywhere else in this world, so the only place it can be
// is here, and that glow is the field made visible exactly where the physics
// puts it.
const TILE_PX = TILE_SCALE * LANE_PX;

export function drawIceAccent(g: Phaser.GameObjects.Graphics, tile: AccentTile) {
  const { cx, cy, s, gx, gy, depth, haze, detail, now } = tile;
  if (detail <= 0) return;
  const air = depth * 0.75;

  if (tile.featureCore) {
    const u = TILE_PX * s;
    // Slow, because trapped flux is trapped -- it is not going anywhere.
    const pulse = 0.55 + 0.45 * Math.sin(now / 1100 + gx * 0.4);
    g.fillStyle(0x0a1620, 0.55 * detail);
    g.fillEllipse(cx, cy, 0.8 * u, 0.46 * u, ellipseSteps(0.8 * u, 0.46 * u));
    g.fillStyle(blend(0x6fd8f0, haze, air), 0.42 * pulse * detail);
    g.fillEllipse(cx, cy, 0.42 * u, 0.24 * u, ellipseSteps(0.42 * u, 0.24 * u));
    g.lineStyle(1.4, blend(0xdff4ff, haze, air), 0.5 * detail);
    g.strokeEllipse(cx, cy, 0.82 * u, 0.48 * u, ellipseSteps(0.82 * u, 0.48 * u));
    return;
  }

  // The lake itself: a still, faceted sheet. Pale cleavage lines at a couple
  // of fixed orientations per tile, and no motion at all -- the glacier is
  // the world that pushes something invisible away from itself, not the world
  // that shimmers.
  const shimmer = 0.5 + 0.3 * Math.sin(gx * 1.7 + gy * 2.3);
  g.lineStyle(1, blend(0xcdeeff, haze, air), 0.3 * shimmer * detail);
  // Both cleavage lines in one path. They already share a stroke style, and a
  // lake is a few hundred tiles a frame, so issuing them as one path halves
  // the stroke calls the world makes without touching a pixel of it.
  g.beginPath();
  g.moveTo(cx - 2.6 * s, cy - 0.4 * s);
  g.lineTo(cx + 2.4 * s, cy - 1.1 * s);
  g.moveTo(cx - 2.2 * s, cy + 0.9 * s);
  g.lineTo(cx + 2.6 * s, cy + 0.3 * s);
  g.strokePath();
}
