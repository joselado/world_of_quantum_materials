import { CHALK, CHARCOAL, YELLOW_OCHRE, dab, handLine, handPath, handRing, jitter, lozenge, wash } from './brush';
import type { G, Inner, PlatePainter, Rnd } from './brush';

// The chapters that belong to no single world: the premise, the ending and
// the two after-story chapters. All four are told over the whole road, so
// they share one sign per world and, for the last three, one map.

// One earth per world, in the hue that world owns (WORLDS.md section 3),
// light enough to show on the dark rock the ending is painted on.
const WORLD_EARTH = [0, 0x86a05a, 0xbd6f43, 0x62978c, 0x7377b8, 0xa9cfd6, 0x62c07e, 0xe8d9a0, 0xa9b59a, 0xdb6a2c, 0xb7a6d9];
// The same ten earths ground deeper, for the light rock of the Lab, where a
// pale pigment would not show.
const WORLD_EARTH_DEEP = [0, 0x4f6a2e, 0x8a4322, 0x2f5f58, 0x3d4188, 0x2a6878, 0x257540, 0x7a6110, 0x4b5a40, 0x9c3a12, 0x5b468f];
const ERROR_RED = 0xcf5a2c;
const VIOLET = 0xb7a6d9;

// A world, as one small sign for the law it stands on: a stalk of wheat that
// is a spin (1), a column (2), a lit seam between two domains (3), a closed
// orbit (4), a wave with one phase (5), spins leaning in a wave (6), two
// lanes and their rungs (7), a spin parting in two halves (8), a lattice with
// one atom out (9), a network (10). `s` is half the sign's height.
function worldSign(g: G, rnd: Rnd, world: number, x: number, y: number, s: number, color: number, alpha: number) {
  switch (world) {
    case 1:
      handLine(g, rnd, x, y + s, x, y - s, 1.5, color, alpha);
      g.lineStyle(1.3, color, alpha);
      for (const k of [0, 3]) {
        g.lineBetween(x, y - s + k, x - 3, y - s + k + 3);
        g.lineBetween(x, y - s + k, x + 3, y - s + k + 3);
      }
      break;
    case 2:
      handLine(g, rnd, x - 2.5, y - s + 2, x - 2.5, y + s - 1, 1.4, color, alpha);
      handLine(g, rnd, x + 2.5, y - s + 2, x + 2.5, y + s - 1, 1.4, color, alpha);
      handLine(g, rnd, x - 5, y - s + 1, x + 5, y - s + 1, 1.6, color, alpha);
      handLine(g, rnd, x - 5, y + s, x + 5, y + s, 1.6, color, alpha);
      break;
    case 3:
      dab(g, rnd, x - 4.5, y, s * 0.6, color, alpha * 0.8);
      dab(g, rnd, x + 4.5, y, s * 0.6, YELLOW_OCHRE, alpha * 0.55);
      handLine(g, rnd, x, y - s, x, y + s, 1.6, CHALK, alpha);
      break;
    case 4:
      handRing(g, rnd, x, y, s * 0.85, 1.4, color, alpha);
      g.fillStyle(color, alpha);
      g.fillCircle(x, y, 1.3);
      break;
    case 5: {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 10; i++) pts.push({ x: x - 8 + i * 1.6, y: y + Math.sin((i / 10) * Math.PI * 3) * s * 0.6 });
      handPath(g, rnd, pts, 1.5, color, alpha);
      break;
    }
    case 6:
      for (let i = 0; i < 4; i++) {
        const lean = Math.sin((i / 3) * Math.PI) * 4;
        handLine(g, rnd, x - 6 + i * 4, y + s * 0.8, x - 6 + i * 4 + lean, y - s * 0.8, 1.4, color, alpha);
      }
      break;
    case 7:
      handLine(g, rnd, x - 7, y - 3.5, x + 7, y - 3.5, 1.4, color, alpha);
      handLine(g, rnd, x - 7, y + 3.5, x + 7, y + 3.5, 1.4, color, alpha);
      g.lineStyle(1.3, color, alpha);
      for (const dx of [-4, 0, 4]) g.lineBetween(x + dx, y - 3.5, x + dx, y + 3.5);
      break;
    case 8:
      handLine(g, rnd, x - 8, y, x - 1, y, 1.6, color, alpha);
      handLine(g, rnd, x - 1, y, x + 7, y - s * 0.75, 1.3, color, alpha);
      handLine(g, rnd, x - 1, y, x + 7, y + s * 0.75, 1.3, color, alpha);
      break;
    case 9:
      g.fillStyle(color, alpha);
      for (let ix = -1; ix <= 1; ix++) {
        for (let iy = -1; iy <= 1; iy++) {
          if (ix === 0 && iy === 0) continue;
          g.fillCircle(x + ix * 5, y + iy * 5, 1.3);
        }
      }
      handRing(g, rnd, x, y, 2.2, 1, color, alpha * 0.8);
      break;
    default: {
      const nodes = [
        { x, y: y - s },
        { x: x + s * 0.8, y },
        { x, y: y + s },
        { x: x - s * 0.8, y },
      ];
      g.lineStyle(1.1, color, alpha * 0.8);
      nodes.forEach((n, i) => {
        const m = nodes[(i + 1) % nodes.length];
        g.lineBetween(n.x, n.y, m.x, m.y);
      });
      g.lineBetween(nodes[0].x, nodes[0].y, nodes[2].x, nodes[2].y);
      g.fillStyle(color, alpha);
      for (const n of nodes) g.fillCircle(n.x, n.y, 1.4);
    }
  }
}

// The premise, told in the Lab. Left: the Lab's door, lit from inside, and
// the crystal that steps out of it. From there the road runs right through
// the ten worlds, each a ring holding its sign. The Decoherence is the grit
// over them: specks and short strokes with no pattern, thin over the first
// world and thick over the last, and the far signs are fainter under it.
const paintPremise: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const doorX = r.x + 24;
  const doorTop = mid - 24;
  const doorFoot = mid + 22;

  wash(
    g,
    rnd,
    [
      { x: doorX - 11, y: doorFoot },
      { x: doorX - 11, y: doorTop + 8 },
      { x: doorX, y: doorTop },
      { x: doorX + 11, y: doorTop + 8 },
      { x: doorX + 11, y: doorFoot },
    ],
    YELLOW_OCHRE,
    0.4
  );
  handPath(
    g,
    rnd,
    [
      { x: doorX - 12, y: doorFoot },
      { x: doorX - 12, y: doorTop + 8 },
      { x: doorX - 7, y: doorTop + 1 },
      { x: doorX, y: doorTop - 2 },
      { x: doorX + 7, y: doorTop + 1 },
      { x: doorX + 12, y: doorTop + 8 },
      { x: doorX + 12, y: doorFoot },
    ],
    2,
    CHARCOAL,
    0.9
  );
  lozenge(g, rnd, r.x + 58, mid + 6, 10, CHALK);

  const first = r.x + 98;
  const step = (r.x + r.w - 16 - first) / 9;
  const roadY = (x: number) => mid + 8 + Math.sin((x - r.x) / 46) * 7;
  for (let x = r.x + 74; x < r.x + r.w - 2; x += 6) {
    dab(g, rnd, x + jitter(rnd, 1), roadY(x) + 15 + jitter(rnd, 1), 1.1, CHARCOAL, 0.55);
  }
  for (let world = 1; world <= 10; world++) {
    const x = first + (world - 1) * step;
    const y = roadY(x) - 4;
    const far = (world - 1) / 9;
    const alpha = 0.95 - far * 0.3;
    handRing(g, rnd, x, y, 12.5, 1.3, CHARCOAL, alpha * 0.8);
    worldSign(g, rnd, world, x, y, 7, WORLD_EARTH_DEEP[world], alpha);
    const grit = Math.round(far * far * 26);
    for (let i = 0; i < grit; i++) {
      const gx = x + jitter(rnd, 17);
      const gy = y + jitter(rnd, 22);
      if (rnd() < 0.5) {
        g.fillStyle(CHARCOAL, 0.75);
        g.fillCircle(gx, gy, 0.7 + rnd() * 0.8);
      } else {
        const a = rnd() * Math.PI;
        g.lineStyle(1.2, CHARCOAL, 0.7);
        g.lineBetween(gx, gy, gx + Math.cos(a) * 3.5, gy + Math.sin(a) * 3.5);
      }
    }
  }
};

// The cliff the last world's road ends at: a ledge at the plate's left edge
// with the crystal standing on it.
function cliff(g: G, rnd: Rnd, r: Inner) {
  const ledge = r.y + r.h * 0.5;
  wash(
    g,
    rnd,
    [
      { x: r.x, y: ledge },
      { x: r.x + 44, y: ledge },
      { x: r.x + 50, y: r.y + r.h },
      { x: r.x, y: r.y + r.h },
    ],
    CHALK,
    0.09
  );
  handPath(
    g,
    rnd,
    [
      { x: r.x, y: ledge },
      { x: r.x + 22, y: ledge - 1 },
      { x: r.x + 44, y: ledge },
      { x: r.x + 47, y: ledge + 18 },
      { x: r.x + 50, y: r.y + r.h },
    ],
    1.8,
    CHALK,
    0.8
  );
  lozenge(g, rnd, r.x + 28, ledge - 12, 10, CHALK);
}

// The ten worlds seen from that cliff, all at once: one landmass inside a
// drawn coast, the road winding through it from the first world to the last,
// each world its sign in its own earth. `x0`..`x1` is the room the map gets.
function mapBelow(g: G, rnd: Rnd, r: Inner, x0: number, x1: number, signSize: number) {
  const mid = r.y + r.h / 2;
  const step = (x1 - x0) / 9;
  const at = (world: number) => ({ x: x0 + (world - 1) * step, y: mid + (world % 2 === 1 ? -15 : 15) });

  const coast: { x: number; y: number }[] = [];
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2 + 17;
  const ry = r.h / 2 - 3;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const bulge = 1 + Math.sin(a * 3 + 1) * 0.07 + jitter(rnd, 0.04);
    coast.push({ x: cx + Math.cos(a) * rx * bulge, y: mid + Math.sin(a) * ry * Math.min(1, bulge) });
  }
  handPath(g, rnd, coast, 1.3, CHALK, 0.45, true);

  for (let world = 1; world < 10; world++) {
    const a = at(world);
    const b = at(world + 1);
    for (let t = 0.3; t < 0.75; t += 0.2) {
      g.fillStyle(CHALK, 0.5);
      g.fillCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 0.9);
    }
  }
  for (let world = 1; world <= 10; world++) {
    const p = at(world);
    worldSign(g, rnd, world, p.x, p.y, signSize, WORLD_EARTH[world], 0.95);
  }
}

// The voice from past the map, the only trace of what speaks there: a few
// faint arcs arriving from beyond the slab's edge, across rock that is
// otherwise left bare. Nothing is painted where the voice comes from.
function voice(g: G, rnd: Rnd, r: Inner, alpha: number) {
  const cx = r.x + r.w + 34;
  const cy = r.y + r.h / 2 + 3;
  [58, 78, 98].forEach((radius, i) => {
    const pts: { x: number; y: number }[] = [];
    for (let k = -5; k <= 5; k++) {
      const a = Math.PI + (k / 5) * 0.42;
      pts.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
    }
    handPath(g, rnd, pts, 1.3, CHALK, alpha * (1 - i * 0.28));
  });
}

// The ending. The road ends at the cliff, and every world lies below at
// once, as the thing that trained on the crystal saw them. Nothing joins the
// map to anything above it: nothing is measuring now.
const paintEnding: PlatePainter = (g, r, rnd) => {
  cliff(g, rnd, r);
  mapBelow(g, rnd, r, r.x + 104, r.x + r.w - 30, 7);
};

// After the second epoch. The same cliff and the same map, drawn smaller,
// and past the map's coast the rock is bare: what pointed the Adapted at
// these worlds is nowhere on the map. From beyond the slab's edge comes the
// voice.
const paintAfterSecond: PlatePainter = (g, r, rnd) => {
  cliff(g, rnd, r);
  mapBelow(g, rnd, r, r.x + 92, r.x + r.w * 0.6, 6);
  voice(g, rnd, r, 0.5);
};

// After the third epoch. The crystal is painted twice over, two outlines a
// little apart: still in superposition. Three rings stand around it, one for
// each epoch, and every error sent against it is a broken red stroke that
// stops at the outer ring. The rock past them is bare, and the voice arrives
// across it.
const paintAfterThird: PlatePainter = (g, r, rnd) => {
  const cx = r.x + r.w * 0.34;
  const cy = r.y + r.h / 2;
  lozenge(g, rnd, cx - 3, cy, 13, CHALK, 0.85);
  lozenge(g, rnd, cx + 4, cy + 1, 13, CHALK, 0.5);
  [23, 30, 37].forEach((radius, i) => handRing(g, rnd, cx, cy, radius, 1.4, VIOLET, 0.75 - i * 0.12));
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + 0.3;
    const reach = 39;
    const from = reach + 16 + rnd() * 16;
    const ex = cx + Math.cos(a) * from * 1.9;
    const ey = cy + Math.sin(a) * from;
    if (ex < r.x + 4 || ex > r.x + r.w * 0.66 || ey < r.y + 2 || ey > r.y + r.h - 2) continue;
    const hx = cx + Math.cos(a) * reach * 1.02;
    const hy = cy + Math.sin(a) * reach * 1.02;
    const kx = (ex + hx) / 2 + jitter(rnd, 3.5);
    const ky = (ey + hy) / 2 + jitter(rnd, 3.5);
    handPath(g, rnd, [{ x: ex, y: ey }, { x: kx, y: ky }, { x: hx, y: hy }], 1.5, ERROR_RED, 0.85);
    g.lineStyle(1.4, ERROR_RED, 0.85);
    g.lineBetween(hx - Math.sin(a) * 2.5, hy + Math.cos(a) * 2.5, hx + Math.sin(a) * 2.5, hy - Math.cos(a) * 2.5);
  }
  voice(g, rnd, r, 0.62);
};

export const PLATES: Record<string, PlatePainter> = {
  premise: paintPremise,
  ending: paintEnding,
  after2: paintAfterSecond,
  after3: paintAfterThird,
};
