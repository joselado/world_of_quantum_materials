import Phaser from 'phaser';
import type { Biome } from '../../../art/biomes';
import type { AccentTile } from './types';

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
    const r = 3.4 * s;
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

  // World 4 (QHE/Landau levels): short parallel field-line strokes with a
  // small quantized-orbit ring, evoking magnetic field lines threading the
  // terrain.
  if (biome.decoration === 'fieldLines') {
    g.lineStyle(1, 0x9fd8ff, 0.8);
    [-2.4, 0, 2.4].forEach((off) => {
      g.lineBetween(cx - 2.2 * s + off * s, cy - 1.6 * s, cx - 2.2 * s + off * s, cy + 1.6 * s);
    });
    g.lineStyle(1, 0xffffff, 0.7);
    g.strokeCircle(cx, cy, 1.6 * s);
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
