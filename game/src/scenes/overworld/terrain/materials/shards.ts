import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { LANE_PX } from '../../../../art/perspective';
import { GRID_W, TILE_SCALE } from '../../projection';
import type { AccentTile } from '../types';

// 'shards' (the Iron Steppe, world 6): fields of aligned iron shards, every
// one of them leaning the same way, and flipping direction across a domain
// wall. The magnetic order is something the player can see standing up out of
// the ground -- which is the point of drawing it as terrain rather than as a
// diagram.
//
// This world is the false calm: the mood relaxes after ice and storm, while
// the lethality does not, since leaning shards are the most overtly impaling
// surround so far. A false calm the player cannot retrospectively recognise
// as false is just a pretty world, so it needs a tell -- and the tell is the
// domain wall itself, which drifts. Shards it passes over flip while the
// player is watching, which is both the warning and, as domain-wall motion,
// the correct physics for how a magnet actually reverses.
const TILE_PX = TILE_SCALE * LANE_PX;
const WALL_DRIFT_MS = 9000;

// Where the wall stands at this row and this moment. It meanders with depth
// rather than ruling a straight line down the map, because a domain wall is a
// surface that finds its own shape, not a drawn boundary.
function wallAt(gy: number, now: number): number {
  return GRID_W * 0.55 + 3 * Math.sin(gy * 0.21) + 5 * Math.sin((now / WALL_DRIFT_MS) * Math.PI * 2);
}

export function drawShardsAccent(g: Phaser.GameObjects.Graphics, { cx, cy, s, gx, gy, depth, haze, detail, now }: AccentTile) {
  if (detail <= 0) return;
  const u = TILE_PX * s;
  const air = depth * 0.75;
  const lean = gx < wallAt(gy, now) ? 1 : -1;

  const jitter = (Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453) % 1;
  const height = (0.5 + Math.abs(jitter) * 0.36) * u;
  const tip = cx + lean * 0.42 * height;

  // A shard is a blade, so it is drawn as one: a narrow triangle from a short
  // base to a point, sheared over in the direction its moment points.
  g.fillStyle(blend(0x1c1f24, haze, air), detail);
  g.fillTriangle(cx - 0.16 * u, cy, cx + 0.16 * u, cy, tip, cy - height);

  // The aurora is the only light in this world, so the lit edge is green and
  // it is on the upper face -- light received from the sky, not from a sun
  // that has already set for good.
  g.lineStyle(1.2, blend(0x6fd98a, haze, air), 0.45 * detail);
  g.lineBetween(cx + lean * 0.16 * u, cy, tip, cy - height);
}
