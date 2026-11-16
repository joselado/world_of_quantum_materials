import Phaser from 'phaser';

// The brushes every story plate is painted with (art/storyPlates/index.ts has
// the style and its rules). Each one takes the plate's Graphics and its
// seeded generator, so a plate is the same picture every time it is opened.
// A helper that only one world needs lives in that world's own file.

// The pigments a wall painting has: two ochres, charcoal and chalk. Each
// world adds one or two earths in the hue it owns (WORLDS.md section 3),
// declared in its own file.
export const RED_OCHRE = 0xa63f1d;
export const YELLOW_OCHRE = 0xd6a03c;
export const CHARCOAL = 0x241b16;
export const CHALK = 0xf1e7cc;

export type Rnd = () => number;
export type G = Phaser.GameObjects.Graphics;

// The part of the slab a painter keeps inside: the plate less a margin for
// the broken edge.
export interface Inner {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PlatePainter = (g: G, r: Inner, rnd: Rnd) => void;

export const jitter = (rnd: Rnd, amount: number) => (rnd() - 0.5) * 2 * amount;

// A stroke pulled by hand: the straight line from a to b, broken into short
// pieces that each drift a little off it.
export function handLine(g: G, rnd: Rnd, x1: number, y1: number, x2: number, y2: number, width: number, color: number, alpha = 0.9) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.round(len / 6));
  const nx = -(y2 - y1) / (len || 1);
  const ny = (x2 - x1) / (len || 1);
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const off = i === 0 || i === steps ? 0 : jitter(rnd, 0.7);
    pts.push(new Phaser.Math.Vector2(x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off));
  }
  g.lineStyle(width, color, alpha);
  g.strokePoints(pts, false);
}

// A dab of pigment put on with a fingertip: never quite round, and thicker
// on one side.
export function dab(g: G, rnd: Rnd, x: number, y: number, radius: number, color: number, alpha = 0.9) {
  g.fillStyle(color, alpha);
  g.fillEllipse(x, y, radius * (2 + jitter(rnd, 0.35)), radius * (2 + jitter(rnd, 0.35)));
  g.fillStyle(color, alpha * 0.6);
  g.fillCircle(x + jitter(rnd, radius * 0.4), y + jitter(rnd, radius * 0.4), radius * 0.7);
}

// A thin wash over an area: the outline wobbles, and it is laid twice so the
// middle is denser than the edge and the rock still shows through both.
export function wash(g: G, rnd: Rnd, outline: { x: number; y: number }[], color: number, alpha: number) {
  for (let pass = 0; pass < 2; pass++) {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 12));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        pts.push({ x: a.x + (b.x - a.x) * t + jitter(rnd, 1.6), y: a.y + (b.y - a.y) * t + jitter(rnd, 1.6) });
      }
    }
    g.fillStyle(color, alpha);
    g.fillPoints(pts, true);
  }
}

// A stroke through a run of points, each one nudged off its place, for a
// curve, a wave or an outline. `closed` joins the last point to the first.
export function handPath(g: G, rnd: Rnd, pts: { x: number; y: number }[], width: number, color: number, alpha = 0.9, closed = false) {
  const drawn = pts.map((p) => new Phaser.Math.Vector2(p.x + jitter(rnd, 0.6), p.y + jitter(rnd, 0.6)));
  g.lineStyle(width, color, alpha);
  g.strokePoints(drawn, closed, closed);
}

// A ring drawn in one turn of the hand: not quite round and not quite shut.
export function handRing(g: G, rnd: Rnd, x: number, y: number, radius: number, width: number, color: number, alpha = 0.9) {
  const pts: { x: number; y: number }[] = [];
  const steps = Math.max(8, Math.round(radius * 1.6));
  const start = rnd() * Math.PI * 2;
  for (let i = 0; i <= steps - 1; i++) {
    const a = start + (i / steps) * Math.PI * 2;
    const rr = radius + jitter(rnd, Math.min(0.8, radius * 0.12));
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  handPath(g, rnd, pts, width, color, alpha);
}

// The crystal that walks these worlds, as a wall painting keeps it: a
// lozenge with its two upper facets marked. It is the only sign for the
// player, in chalk; World 10 paints the same sign in its own pigment for the
// thing that copied it.
export function lozenge(g: G, rnd: Rnd, x: number, y: number, size: number, color: number, alpha = 0.95) {
  const top = { x, y: y - size };
  const right = { x: x + size * 0.72, y };
  const bottom = { x, y: y + size };
  const left = { x: x - size * 0.72, y };
  handPath(g, rnd, [top, right, bottom, left], 1.5, color, alpha, true);
  g.lineStyle(1.1, color, alpha * 0.8);
  g.lineBetween(left.x, left.y, right.x, right.y);
  g.lineBetween(top.x, top.y, x, y);
}
