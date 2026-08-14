import Phaser from 'phaser';
import type { Biome } from '../../../art/biomes';
import { LANE_PX } from '../../../art/perspective';
import { TILE_SCALE } from '../projection';
import type { AccentTile } from './types';

// A tile's width on screen at unit depth scale. Ground decoration is sized
// against the tile it sits on rather than in raw pixels: a motif that has to
// teach something -- a quantised orbit, a spin wave -- has to be big enough
// on the ground to be read as that thing, and a tile is far wider than the
// handful of pixels a scatter of flowers needs.
const TILE_PX = TILE_SCALE * LANE_PX;

// The scatter of detail a decorated *walkable* tile carries, one motif per
// biome (art/biomes.ts's `decoration`) so each world's floor reads as its own
// place. This is ground decoration in the literal sense -- the Storm Flats'
// quantised orbit rings, the Iron Steppe's spin-wave ripples, the Defect
// Scars' cracks are all underfoot, on the route the player walks, which is
// where the physics they teach lives. Impassable terrain gets its material's
// own accent instead (materials/).
//
// `biome` here is the scene's own, not the tile's -- the decoration belongs
// to the world the player is walking through even where World 9's defect
// patches borrow another world's palette for the ground under it.
export function decorateTile(g: Phaser.GameObjects.Graphics, biome: Biome, tile: AccentTile) {
  const { cx, cy, s } = tile;

  // World 2 (the Stone Lattice): the aisle is an actual repeating wallpaper
  // pattern, with two alternating tile motifs carrying the two-atom basis --
  // a filled diamond on one sublattice, an open square on the other. Which
  // motif a tile gets is decided by the parity of its own grid coordinates,
  // so the two sublattices stay in register across the whole floor the way a
  // real basis does rather than being scattered.
  if (biome.decoration === 'mosaic') {
    const r = 0.3 * TILE_PX * s;
    if ((tile.gx + tile.gy) % 2 === 0) {
      g.fillStyle(0xb08355, 0.55);
      g.fillPoints(
        [
          { x: cx, y: cy - r * 0.7 },
          { x: cx + r, y: cy },
          { x: cx, y: cy + r * 0.7 },
          { x: cx - r, y: cy },
        ],
        true
      );
    } else {
      g.lineStyle(1, 0x8f7051, 0.5);
      g.strokeRect(cx - r * 0.7, cy - r * 0.5, r * 1.4, r);
    }
    return;
  }

  // World 3 (the Edge Cliffs): the ledge visibly flows. The streaks all drift
  // the same way and never the other, because that is the physics the whole
  // world rests on -- on an edge channel direction and spin are welded
  // together, so nothing on this road can turn around. A back-and-forth
  // shimmer here would quietly teach the opposite of the lesson.
  if (biome.decoration === 'edgeFlow') {
    const period = 1600;
    [0, 0.5].forEach((offset) => {
      const t = ((tile.now / period + offset + tile.gx * 0.13) % 1 + 1) % 1;
      // Brightest mid-run, so a streak arrives and leaves rather than
      // popping in and out at the tile boundary.
      const fade = Math.sin(t * Math.PI);
      g.lineStyle(1.6, 0x8fe0ff, 0.85 * fade);
      const u = TILE_PX * s;
      const y = cy + (0.5 - t) * 0.9 * u;
      g.lineBetween(cx - 0.34 * u, y, cx + 0.34 * u, y);
    });
    return;
  }

  // World 5 (the Vortex Glacier): the ice is swept. The streaks run along the
  // corridor and bow sideways with distance from its centre, so the field
  // reads as being pushed away from the bulk rather than flowing down a pipe
  // -- field expulsion drawn on the ground the player walks. Still, always:
  // this world pushes something invisible away from itself, it does not
  // shimmer.
  if (biome.decoration === 'flowLines') {
    const u = TILE_PX * s;
    const bow = Math.sin(tile.gx * 0.55) * 0.22 * u;
    g.lineStyle(1.2, 0xe4f4fb, 0.4);
    [-0.22, 0.1].forEach((off) => {
      g.beginPath();
      g.moveTo(cx + off * u - bow * 0.5, cy - 0.42 * u);
      g.lineTo(cx + off * u + bow, cy);
      g.lineTo(cx + off * u - bow * 0.5, cy + 0.42 * u);
      g.strokePath();
    });
    return;
  }

  if (biome.decoration === 'crystalGlints') {
    g.fillStyle(0x8fe8ff, 0.85);
    [0, 1, 2].forEach((i) => {
      const ang = (i * Math.PI * 2) / 3 - Math.PI / 2;
      g.fillCircle(cx + Math.cos(ang) * 2 * s, cy + Math.sin(ang) * 1.4 * s, 1.4 * s);
    });
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx, cy, 1 * s);
    return;
  }

  // World 4 (the Storm Flats): quantised orbit rings. With the world's name
  // no longer saying "orbit", these rings are the only thing left teaching
  // that a Landau level is a quantised orbit -- so they are pedagogy, not
  // decoration, and the concentric pair carries the quantisation itself:
  // successive orbits differ by exactly one flux quantum, never a fraction.
  // Drawn as ellipses, since a circle on the ground is seen at a slant.
  if (biome.decoration === 'orbitRings') {
    const u = TILE_PX * s;
    g.lineStyle(1.4, 0x9fd8ff, 0.5);
    g.strokeEllipse(cx, cy, 0.62 * u, 0.34 * u);
    g.lineStyle(1.4, 0xdff0ff, 0.75);
    g.strokeEllipse(cx, cy, 0.34 * u, 0.19 * u);
    return;
  }

  // World 7 (the Entangled Web): the floor is not ground, it is the network.
  // Two filaments running away in depth with a rung strung between them and a
  // site where they meet -- the ladder of lanes and rungs the generator
  // builds, restated at tile scale so the surface reads as strung rather than
  // paved. In a tensor network the geometry is the entanglement, so the rungs
  // are the structure and not an ornament over it.
  if (biome.decoration === 'networkNodes') {
    const u = TILE_PX * s;
    g.lineStyle(1.2, 0xfff4d0, 0.4);
    [-0.24, 0.24].forEach((off) => g.lineBetween(cx + off * u, cy - 0.5 * u, cx + off * u, cy + 0.5 * u));
    g.lineStyle(1, 0xfff4d0, 0.28);
    g.lineBetween(cx - 0.24 * u, cy, cx + 0.24 * u, cy);
    g.fillStyle(0xfffaf0, 0.85);
    g.fillCircle(cx - 0.24 * u, cy, 0.045 * u);
    g.fillCircle(cx + 0.24 * u, cy, 0.045 * u);
    return;
  }

  // World 6 (the Iron Steppe): spin-wave ripples running through the iron
  // sand. They travel: tip one spin out of line and its neighbours lean to
  // follow, and the tilt walks off across the steppe as a wave, which is the
  // whole of what a magnon is. Rings expand outward and fade, so the ground is
  // visibly carrying something rather than merely patterned with circles.
  if (biome.decoration === 'ripples') {
    const u = TILE_PX * s;
    const period = 2200;
    [0, 0.45].forEach((offset) => {
      const t = (((tile.now / period + offset + tile.gy * 0.07) % 1) + 1) % 1;
      g.lineStyle(1.2, 0x8fe8a8, 0.5 * (1 - t));
      g.strokeEllipse(cx, cy, t * 0.9 * u, t * 0.5 * u);
    });
    return;
  }

  // World 9 (the Defect Scars): a crack in the clay. This is the old, closed
  // half of the world's two-tense damage -- the walkable route reads as scars
  // that healed, against the molten crust beside it, which is a wound still
  // open. A lattice defect is frozen-in damage that never heals, so the
  // ground here is literally cracked.
  if (biome.decoration === 'cracks') {
    const u = TILE_PX * s;
    g.lineStyle(1.5, 0x6b3524, 0.8);
    g.beginPath();
    g.moveTo(cx - 0.42 * u, cy - 0.2 * u);
    g.lineTo(cx - 0.1 * u, cy - 0.02 * u);
    g.lineTo(cx + 0.14 * u, cy - 0.15 * u);
    g.lineTo(cx + 0.42 * u, cy + 0.2 * u);
    g.strokePath();
    return;
  }

  // World 8 (the Splitting Hollow): fog on the route as well as off it, but
  // thin here -- soft wisps rather than a sharp shape. The route is where the
  // fog is survivable, and the difference in how much of it there is between
  // path and surround is the whole warning.
  if (biome.decoration === 'mistMotes') {
    const u = TILE_PX * s;
    g.fillStyle(0xdfe6df, 0.22);
    [
      [-0.24, 0],
      [0.24, 0.06],
      [0, -0.1],
    ].forEach(([ox, oy]) => g.fillEllipse(cx + ox * u, cy + oy * u, 0.5 * u, 0.24 * u));
    return;
  }

  // World 10 (the Devouring Mirror): the path dissolves behind the player as
  // the world re-forms ahead. The nearest rows -- the ground just walked over
  // -- break into fragments that come apart and drift, so the world visibly
  // takes something rather than merely claiming to. Without this, "Devouring"
  // is a boast.
  if (biome.decoration === 'dissolve') {
    const u = TILE_PX * s;
    const eaten = Math.max(0, 1 - tile.depth / 0.16);
    if (eaten <= 0) return;
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9 + tile.gx * 0.6 + tile.gy * 0.3;
      const drift = eaten * 0.7 * u;
      g.fillStyle(0x2e2044, 0.72 * eaten);
      g.fillEllipse(
        cx + Math.cos(a) * (0.16 * u + drift),
        cy + Math.sin(a) * (0.1 * u + drift * 0.55),
        0.24 * u * eaten,
        0.14 * u * eaten
      );
    }
    return;
  }

  g.fillStyle(0xffffff, 0.9);
  [0, 1, 2, 3].forEach((i) => {
    const ang = (i * Math.PI) / 2;
    g.fillCircle(cx + Math.cos(ang) * 2.4 * s, cy + Math.sin(ang) * 1.6 * s, 1.8 * s);
  });
  g.fillStyle(0xffdd55, 1);
  g.fillCircle(cx, cy, 1.3 * s);
}
