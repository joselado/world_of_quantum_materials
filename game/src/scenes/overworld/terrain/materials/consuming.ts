import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { LANE_PX } from '../../../../art/perspective';
import { TILE_SCALE } from '../../projection';
import type { AccentTile } from '../types';

// 'consuming' (the Devouring Mirror, world 10): terrain that reconfigures
// around whatever crystal the player currently is.
//
// The surround is drawn as facets that re-cut themselves on a slow cycle,
// tinted toward the player's own colour -- the world is built out of them,
// which is the finale's whole claim, and the last world has to look like it
// is doing that rather than merely being violet. "Devouring" has to be a
// description rather than a boast, so this terrain visibly works: the facets
// close in and re-form instead of sitting still.
const TILE_PX = TILE_SCALE * LANE_PX;

export function drawConsumingAccent(g: Phaser.GameObjects.Graphics, { cx, cy, s, gx, gy, depth, haze, detail, playerColor, now }: AccentTile) {
  if (detail <= 0) return;
  const u = TILE_PX * s;
  const air = depth * 0.7;

  // Each tile runs its own slow re-cut, offset by position, so the surface
  // shifts as a field rather than pulsing in unison.
  const phase = now / 1900 + gx * 0.7 + gy * 0.45;
  const turn = phase % (Math.PI * 2);
  const spread = 0.3 + 0.14 * Math.sin(phase * 1.7);

  const facet = blend(blend(0xb9a6d8, playerColor, 0.35), haze, air);
  g.fillStyle(facet, 0.4 * detail);
  for (let i = 0; i < 3; i++) {
    const a = turn + (i * Math.PI * 2) / 3;
    g.fillTriangle(
      cx,
      cy,
      cx + Math.cos(a) * spread * u,
      cy + Math.sin(a) * spread * u * 0.55,
      cx + Math.cos(a + 1.05) * spread * u,
      cy + Math.sin(a + 1.05) * spread * u * 0.55
    );
  }

  g.lineStyle(1, blend(0xf0e4ff, haze, air), 0.3 * detail);
  g.strokeEllipse(cx, cy, spread * 1.5 * u, spread * 0.82 * u);
}
