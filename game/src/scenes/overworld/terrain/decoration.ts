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

  // World 7 (entanglement/tensor networks): a small graph -- a few nodes
  // joined by bond lines, matching the biome's "bonds as paths" theme.
  if (biome.decoration === 'networkNodes') {
    const pts = [
      { x: cx - 2 * s, y: cy + 1 * s },
      { x: cx, y: cy - 1.8 * s },
      { x: cx + 2 * s, y: cy + 1 * s },
    ];
    g.lineStyle(1, 0xc9a8f0, 0.75);
    g.lineBetween(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    g.lineBetween(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    g.lineBetween(pts[0].x, pts[0].y, pts[2].x, pts[2].y);
    g.fillStyle(0xffffff, 0.9);
    pts.forEach((p) => g.fillCircle(p.x, p.y, 1.1 * s));
    return;
  }

  // World 6 (classical magnetism/magnons): concentric ripple rings, as if
  // a magnon wave just passed through the grass.
  if (biome.decoration === 'ripples') {
    g.lineStyle(1, 0xfff3c9, 0.75);
    [1.2, 2.2].forEach((r) => g.strokeCircle(cx, cy, r * s));
    return;
  }

  // World 9 (excitations/defects): a jagged crack in the ground, the
  // world's "cracked/glitching" theme made literal.
  if (biome.decoration === 'cracks') {
    g.lineStyle(1.4, 0xff8a5a, 0.85);
    g.beginPath();
    g.moveTo(cx - 2.4 * s, cy - 1.4 * s);
    g.lineTo(cx - 0.6 * s, cy - 0.2 * s);
    g.lineTo(cx + 0.8 * s, cy - 1 * s);
    g.lineTo(cx + 2.4 * s, cy + 1.4 * s);
    g.strokePath();
    return;
  }

  // World 8 (spin liquid/Kondo): soft overlapping fog wisps rather than a
  // sharp shape, matching the "fractionalizes on contact" foggy theme.
  if (biome.decoration === 'mistMotes') {
    g.fillStyle(0xdfe6df, 0.28);
    [
      [-1.6, 0],
      [1.6, 0.4],
      [0, -0.6],
    ].forEach(([ox, oy]) => g.fillEllipse(cx + ox * s, cy + oy * s, 3.2 * s, 1.6 * s));
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
