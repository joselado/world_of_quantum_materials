import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { LANE_PX } from '../../../../art/perspective';
import { ellipseSteps, fillPolygon } from '../../../../art/shapes';
import { TILE_SCALE } from '../../projection';
import type { AccentTile } from '../types';

// How often a toppled drum from the Stone Lattice's colonnade shows in the
// crust. Rare on purpose: the generator already embeds patches of worlds 1-8
// along this corridor as borrowed defect "types", and this is the one piece
// of the game's only architecture that outlived its world. Civilization is a
// brief episode -- one built world, then never again -- and these half-sunk
// drums are what turns that into a story rather than a set-dressing
// experiment.
const DRUM_RATE = 0.05;
const TILE_PX = TILE_SCALE * LANE_PX;

function hash(gx: number, gy: number): number {
  const v = Math.sin(gx * 57.3 + gy * 133.9) * 43758.5453;
  return v - Math.floor(v);
}

// 'lava' (the Defect Scars, world 9): a glowing molten crust over the off-path
// fill -- a pulsing warm wash, a bright fissure and a hot core. This is the
// still-open half of that world's two-tense damage, against the closed old
// scars cracking the walkable clay beside it.
export function drawLavaAccent(g: Phaser.GameObjects.Graphics, { fill, cx, cy, s, gx, gy, depth, haze, detail, now }: AccentTile) {
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

  const u = TILE_PX * s;
  g.fillStyle(0xff5a1a, 0.24 * pulse);
  fillPolygon(g, fill);

  // A fissure running through the crust, sized against the tile: this is the
  // still-open half of the world's two-tense damage, and it has to read as a
  // wound rather than as a scratch.
  g.lineStyle(2, 0xffcf4a, 0.65 * pulse);
  g.beginPath();
  g.moveTo(cx - 0.44 * u, cy - 0.2 * u);
  g.lineTo(cx - 0.07 * u, cy + 0.1 * u);
  g.lineTo(cx + 0.27 * u, cy - 0.13 * u);
  g.strokePath();

  g.fillStyle(0xfff0a0, 0.6 * pulse);
  const coreW = 0.2 * u * pulse;
  const coreH = 0.11 * u * pulse;
  g.fillEllipse(cx, cy, coreW, coreH, ellipseSteps(coreW, coreH));

  if (hash(gx, gy) < DRUM_RATE) drawColumnDrum(g, cx, cy, s, depth, haze, detail);
}

// One drum of a fallen sandstone column, lying on its side and half sunk into
// the crust: an ellipse for the exposed circular face and a short barrel
// behind it, with the near half swallowed by the ground it is sinking into.
function drawColumnDrum(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  s: number,
  depth: number,
  haze: number,
  detail: number
) {
  const u = TILE_PX * s;
  const air = depth * 0.7;
  g.fillStyle(blend(0x8f7051, haze, air), detail);
  g.fillRect(cx - 0.3 * u, cy - 0.15 * u, 0.5 * u, 0.3 * u);
  const faceW = 0.18 * u;
  const faceH = 0.3 * u;
  const steps = ellipseSteps(faceW, faceH);
  g.fillStyle(blend(0xd9c19a, haze, air), detail);
  g.fillEllipse(cx + 0.2 * u, cy, faceW, faceH, steps);
  g.lineStyle(1, blend(0x5c4530, haze, air), 0.7 * detail);
  g.strokeEllipse(cx + 0.2 * u, cy, faceW, faceH, steps);
}
