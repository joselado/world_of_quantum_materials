import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { LANE_PX } from '../../../../art/perspective';
import { invariantOfTint } from '../../../../world/generators/world3';
import { TILE_SCALE } from '../../projection';
import type { AccentTile } from '../types';

// 'deadFloor' (the Winding Borders, world 3): the bulk either side of the lit
// seam the player walks -- fields of loose broken rock, dead, jammed and
// motionless, one storey down.
//
// **This surround exists to be unmistakably unwalkable**, and that is a
// measured requirement rather than a stylistic one. Drawn as a flat wash with
// a faint speckle it read at a local contrast of 0.03 against 0.8-2.1 for
// every other world's impassable ground, which is to say it had no surface at
// all, and a surface-less expanse reads as another kind of floor rather than
// as somewhere you cannot go. Scree is what fixes that: talus is the one
// terrain a human body refuses before the mind is consulted.
//
// What actually delivers the contrast is the **cast shadow**, not the rock.
// Every piece is drawn twice -- a lit upper face pulled toward the light end
// of its domain's own tint, and a hard-edged shadow pulled toward black,
// thrown consistently down-right from a fixed afternoon sun. It is the hard
// boundary between those two that the eye reads as relief.
//
// Three rules this must keep:
//
//  - **Obtuse quads only, and no specular.** Sharp facets and glints are the
//    visual language of the crystals -- the player and every wild encounter is
//    one -- and of World 10's self-recutting terrain. Rock here is blunt.
//  - **Nothing animates.** Wind races across this world's sky while the ground
//    stays perfectly still, and that contradiction is the horror rather than
//    an oversight.
//  - **Rubble everywhere, including the trivial phase.** The proud slabs below
//    count a domain's invariant, and a domain with invariant 0 carries none of
//    them -- but it keeps its rubble. Letting the trivial phase go smooth
//    would quietly hand it back the "walkable floor" read this whole material
//    exists to remove.
//
// The domain tint arrives unblended (AccentTile.regionTint) because it carries
// information twice over: which bulk phase this is, and -- through
// world3.ts's invariantOfTint -- how many slabs stand proud of the rubble
// here. So the invariant survives having the colour drained, which a hue-only
// encoding would not.
const TILE_PX = TILE_SCALE * LANE_PX;

// The sun is high and from the upper left all through this world, so every
// shadow falls the same way. One light direction is what stops a field of
// broken rock from reading as noise.
const SHADOW_DX = 0.16;
const SHADOW_DY = 0.1;
const FALLBACK_TINT = 0x4a5550;

// Deterministic per-tile noise. The rubble must be the same rubble every frame
// -- see the "nothing animates" rule -- so every position, size and lean is a
// function of the tile's own coordinates and nothing else.
function hash(gx: number, gy: number, salt: number): number {
  const v = Math.sin(gx * 127.1 + gy * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

// One blunt piece of rock, as its outline. A broken block: low, wider than
// tall, with a flat-ish top and one shoulder higher than the other, skewed by
// its own lean. Every corner is obtuse -- points and facets are the crystals'
// own language, since the player and every wild encounter is one, so a rock
// here never comes to a tip -- but the top stays flat rather than domed, or
// the field reads as cobbles.
function rockOutline(cx: number, cy: number, u: number, size: number, lean: number): { x: number; y: number }[] {
  const w = size * u;
  const h = size * u * 0.5;
  const tilt = (lean - 0.5) * w * 0.28;
  const px = [cx - w * 0.5, cx - w * 0.34 + tilt, cx + w * 0.1 + tilt, cx + w * 0.44, cx + w * 0.5];
  const py = [cy + h * 0.34, cy - h * 0.28, cy - h * 0.36, cy - h * 0.05, cy + h * 0.36];
  return px.map((x, i) => ({ x, y: py[i] }));
}

export function drawDeadFloorAccent(
  g: Phaser.GameObjects.Graphics,
  { cx, cy, s, gx, gy, depth, haze, detail, regionTint }: AccentTile
) {
  if (detail <= 0) return;
  const u = TILE_PX * s;
  const air = depth * 0.75;
  const tint = regionTint ?? FALLBACK_TINT;

  // How many pieces this tile carries varies with the tile, which is what
  // stops a field of rubble from falling into the grid it is drawn on: a fixed
  // count per tile reads as a pattern printed on the ground however much the
  // pieces themselves are jittered.
  //
  // How many get *drawn* thins with distance rather than the pieces being
  // faded out. A frame holds far more distant tiles than near ones, so this is
  // where the cost of the material actually lives, and a rubble field two
  // tiles further off carries its legibility on its silhouette rather than on
  // how many rocks are countable in it.
  const pieces = 1 + Math.floor(hash(gx, gy, 3) * 1.99);
  const drawn = detail > 0.75 ? pieces : detail > 0.45 ? Math.min(pieces, 2) : 1;

  const rocks: { x: number; y: number }[][] = [];
  for (let i = 0; i < drawn; i++) {
    const ox = (hash(gx, gy, i) - 0.5) * 0.92 * u;
    const oy = (hash(gx, gy, i + 7) - 0.5) * 0.5 * u;
    const size = 0.22 + hash(gx, gy, i + 13) * 0.34;
    rocks.push(rockOutline(cx + ox, cy + oy, u, size, hash(gx, gy, i + 21)));
  }

  // The invariant, counted: one slab standing proud of the bed per unit of it,
  // each leaning its own way. A uniform lean would read as the Iron Steppe's
  // aligned shards, and the invariant is unsigned anyway, so there is no
  // direction here to point. Drawn only near enough to be counted -- a
  // half-resolved count is worse than none, since the whole point of it is
  // that it can be checked against the neighbouring domain's.
  if (detail >= 0.6) {
    const invariant = invariantOfTint(tint);
    for (let n = 0; n < invariant; n++) {
      const ox = (hash(gx, gy, n + 31) - 0.5) * 0.5 * u;
      const oy = (hash(gx, gy, n + 41) - 0.5) * 0.3 * u;
      rocks.push(rockOutline(cx + ox, cy + oy - 0.1 * u, u, 0.5 + 0.1 * n, hash(gx, gy, n + 51)));
    }
  }

  // Both passes batch by colour: every shadow, then every lit face. A rubble
  // field is several pieces to a tile and a whole frame of them, so alternating
  // the two fill styles per piece would spend as much of the frame's draw
  // budget switching colour as drawing rock.
  //
  // Both faces come off the domain's own tint, so the rubble states which phase
  // it belongs to at the same time as it states that it cannot be walked on.
  g.fillStyle(blend(blend(tint, 0x000000, 0.55), haze, air), detail);
  for (const rock of rocks) g.fillPoints(rock.map((pt) => ({ x: pt.x + SHADOW_DX * u, y: pt.y + SHADOW_DY * u })), true);
  g.fillStyle(blend(blend(tint, 0xffffff, 0.34), haze, air), detail);
  for (const rock of rocks) g.fillPoints(rock, true);
}
