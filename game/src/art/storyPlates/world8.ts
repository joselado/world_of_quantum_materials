import { CHARCOAL, CHALK, RED_OCHRE, YELLOW_OCHRE, dab, handLine, handPath, jitter, wash } from './brush';
import type { G, PlatePainter, Rnd } from './brush';

// The Screened Swamp: fog and no sun, black pools, reeds, and a narrow path
// of peat. Its own earths are the sickly pale of the mist, the green of the
// reeds, and the green-black of the water. The water of a pool never shows a
// likeness: a pool is a plain dark oval, and the only things painted in one
// are the lone spin that burns there and the carriers around it.
const MIST = 0xb9c4a0;
const REED_GREEN = 0x6b7446;
const BOG_WATER = 0x1f2d29;

interface P {
  x: number;
  y: number;
}

function pool(g: G, rnd: Rnd, x: number, y: number, rx: number, ry: number) {
  g.fillStyle(BOG_WATER, 0.95);
  g.fillEllipse(x, y, rx * 2, ry * 2);
  const rim: P[] = [];
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    rim.push({ x: x + Math.cos(a) * rx, y: y + Math.sin(a) * ry });
  }
  handPath(g, rnd, rim, 1.3, MIST, 0.4, true);
}

// Mist lying flat on the water: one long stroke and a shorter one under it.
function mist(g: G, rnd: Rnd, x: number, y: number, len: number) {
  handLine(g, rnd, x, y, x + len, y + jitter(rnd, 0.6), 1.6, MIST, 0.5);
  handLine(g, rnd, x + len * 0.25, y + 3, x + len * 0.8, y + 3, 1.3, MIST, 0.3);
}

// A clump of reeds standing up from `base`, each with its head.
function reeds(g: G, rnd: Rnd, x: number, base: number, count = 3) {
  for (let k = 0; k < count; k++) {
    const rx = x + k * 3.4;
    const tall = 10 + jitter(rnd, 2.5);
    const lean = jitter(rnd, 1.6);
    handLine(g, rnd, rx, base, rx + lean, base - tall, 1.4, REED_GREEN, 0.95);
    g.lineStyle(2.4, REED_GREEN, 0.95);
    g.lineBetween(rx + lean, base - tall, rx + lean * 0.8, base - tall + 3.2);
  }
}

// The sign for a spin flip, and for its halves. The whole sign is an arrow
// with barbs on both sides of its shaft, pointing the way it travels. A half
// is the same arrow split down its length: one half keeps the barbs of one
// side (`part` -1, the upper side of an arrow that points right), the other
// half the barbs of the other side (+1). Laid on each other the two make the
// whole again, as two spinons of spin one half add up to the one flip of
// spin one. `turn` is the way the sign travels, as an angle from due right.
function flipSign(g: G, rnd: Rnd, x: number, y: number, len: number, part: -1 | 0 | 1, turn = 0, alpha = 0.97) {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const at = (u: number, v: number): P => ({ x: x + u * cos - v * sin, y: y + u * sin + v * cos });
  const tail = at(-len / 2, 0);
  const tip = at(len / 2, 0);
  handLine(g, rnd, tail.x, tail.y, tip.x, tip.y, part === 0 ? 2.2 : 1.6, CHALK, alpha);
  g.lineStyle(1.5, CHALK, alpha);
  for (const k of [0.3, 3.6]) {
    const from = at(len / 2 - k, 0);
    for (const side of [-1, 1]) {
      if (part === -side) continue;
      const to = at(len / 2 - k - 3.6, side * 3.6 + jitter(rnd, 0.4));
      g.lineBetween(from.x, from.y, to.x, to.y);
    }
  }
}

// The way a sign has come: a run of small chalk dots through the points.
function trail(g: G, rnd: Rnd, pts: P[], alpha = 0.6) {
  for (let k = 0; k + 1 < pts.length; k++) {
    const p = pts[k];
    const q = pts[k + 1];
    const steps = Math.max(1, Math.round(Math.hypot(q.x - p.x, q.y - p.y) / 5.5));
    for (let s = k === 0 ? 0 : 1; s <= steps; s++) {
      g.fillStyle(CHALK, alpha);
      g.fillCircle(p.x + ((q.x - p.x) * s) / steps + jitter(rnd, 0.4), p.y + ((q.y - p.y) * s) / steps + jitter(rnd, 0.4), 1.05);
    }
  }
}

// A band of peat along a run of points, `half` wide to each side: red ochre
// under yellow, which on this rock is the brown of the path.
function peat(g: G, rnd: Rnd, pts: P[], half: number) {
  const outline = [...pts.map((p) => ({ x: p.x, y: p.y - half })), ...[...pts].reverse().map((p) => ({ x: p.x, y: p.y + half }))];
  wash(g, rnd, outline, RED_OCHRE, 0.17);
  wash(g, rnd, outline, YELLOW_OCHRE, 0.09);
}

// The Screened Swamp's first chapter: the bog, and the rule it breaks. Pools
// under flat mist, reeds, and the path of peat crossing the plate. A whole
// spin flip enters on the path from the left. Where the path parts into two
// banks around a pool, the flip parts too: one half on each bank, each
// carrying half, drifting apart with the water between them. The two banks
// join again past the pool, and the halves do not.
const paintBog: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const right = r.x + r.w;
  const fork = r.x + 190;
  const join = r.x + 356;
  const bank = 20;
  const poolX = (fork + join) / 2;

  pool(g, rnd, r.x + 44, r.y + 15, 27, 8);
  pool(g, rnd, r.x + 142, r.y + 71, 31, 9);
  pool(g, rnd, r.x + 392, r.y + 14, 22, 7);
  pool(g, rnd, r.x + 388, r.y + 73, 24, 7);
  pool(g, rnd, poolX, mid, 50, 12);

  peat(g, rnd, [{ x: r.x + 3, y: mid }, { x: r.x + 60, y: mid + 1 }, { x: r.x + 130, y: mid - 1 }, { x: fork, y: mid }], 5);
  for (const side of [-1, 1]) {
    peat(
      g,
      rnd,
      [
        { x: fork - 4, y: mid + side * 2 },
        { x: fork + 26, y: mid + side * (bank - 3) },
        { x: fork + 50, y: mid + side * bank },
        { x: join - 50, y: mid + side * bank },
        { x: join - 26, y: mid + side * (bank - 3) },
        { x: join + 4, y: mid + side * 2 },
      ],
      3
    );
  }
  peat(g, rnd, [{ x: join, y: mid }, { x: join + 34, y: mid + 1 }, { x: right - 3, y: mid }], 5);

  mist(g, rnd, r.x + 22, r.y + 8, 56);
  mist(g, rnd, r.x + 112, r.y + 63, 60);
  mist(g, rnd, r.x + 96, r.y + 20, 50);
  mist(g, rnd, poolX - 34, mid - 4, 70);
  mist(g, rnd, r.x + 366, r.y + 8, 46);
  mist(g, rnd, r.x + 356, r.y + 66, 54);
  mist(g, rnd, r.x + 214, r.y + 80, 48);

  reeds(g, rnd, r.x + 76, r.y + 24);
  reeds(g, rnd, r.x + 8, r.y + 78);
  reeds(g, rnd, r.x + 178, r.y + 80);
  reeds(g, rnd, r.x + 166, r.y + 22, 2);
  reeds(g, rnd, r.x + 322, r.y + 20);
  reeds(g, rnd, r.x + 330, r.y + 84, 2);

  // The flip, whole, and its way to the fork; then one half on each bank.
  const whole = r.x + 84;
  const upper = { x: poolX - 12, y: mid - bank };
  const lower = { x: poolX + 34, y: mid + bank };
  flipSign(g, rnd, whole, mid, 17, 0);
  trail(g, rnd, [{ x: whole + 16, y: mid }, { x: fork - 2, y: mid }]);
  trail(g, rnd, [{ x: fork + 6, y: mid - 5 }, { x: fork + 28, y: mid - bank + 2 }, { x: upper.x - 14, y: upper.y }]);
  trail(g, rnd, [{ x: fork + 6, y: mid + 5 }, { x: fork + 28, y: mid + bank - 2 }, { x: lower.x - 14, y: lower.y }]);
  flipSign(g, rnd, upper.x, upper.y, 17, -1);
  flipSign(g, rnd, lower.x, lower.y, 17, 1);
};

// A grid of four by four spins for the pairings, and three ways to pair
// every spin with a neighbor: all in rows, all in columns, and a ring around
// the edge with the middle four paired in columns. Each one is a full
// covering, so every spin has exactly one partner in it.
type Pair = [number, number, number, number];

const PAIRS_ROWS: Pair[] = [0, 1, 2, 3].flatMap((row): Pair[] => [
  [0, row, 1, row],
  [2, row, 3, row],
]);
const PAIRS_COLUMNS: Pair[] = [0, 1, 2, 3].flatMap((col): Pair[] => [
  [col, 0, col, 1],
  [col, 2, col, 3],
]);
const PAIRS_RING: Pair[] = [
  [1, 0, 2, 0],
  [1, 3, 2, 3],
  [0, 0, 0, 1],
  [0, 2, 0, 3],
  [3, 0, 3, 1],
  [3, 2, 3, 3],
  [1, 1, 1, 2],
  [2, 1, 2, 2],
];

const GRID_STEP = 15;
const gridAt = (cx: number, cy: number, col: number, row: number): P => ({ x: cx + (col - 1.5) * GRID_STEP, y: cy + (row - 1.5) * GRID_STEP });

function gridDots(g: G, rnd: Rnd, cx: number, cy: number) {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const p = gridAt(cx, cy, col, row);
      dab(g, rnd, p.x, p.y, 1.9, CHALK, 0.95);
    }
  }
}

// A pairing as a loose stroke between the two spins, bowed to one side so
// that two pairings of the same two spins both show.
function looseBond(g: G, rnd: Rnd, a: P, b: P, bow: number, color: number, alpha: number) {
  const nx = -(b.y - a.y) / GRID_STEP;
  const ny = (b.x - a.x) / GRID_STEP;
  const pts: P[] = [];
  for (let k = 0; k <= 4; k++) {
    const t = k / 4;
    const off = bow * 4 * t * (1 - t);
    pts.push({ x: a.x + (b.x - a.x) * t + nx * off, y: a.y + (b.y - a.y) * t + ny * off });
  }
  handPath(g, rnd, pts, 1.5, color, alpha);
}

// The Screened Swamp's second chapter. Left, the spins pair into couples and
// no pairing is chosen: three coverings of the same grid lie on each other in
// three pigments, so every spin shows more than one partner. Middle, the
// Decoherence has picked one: the same grid with the rows alone, in the
// pigment the rows had, each bond now a straight hard bar, and every spin
// has exactly one partner. Right,
// the lights in the pools. In the first pool a lone spin still burns. In the
// second the carriers of the water have crowded around it, one of them is
// closed in a ring with it, a singlet, and the spin has gone dark: an empty
// circle where the first pool has a full point.
const paintPairings: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const looseX = r.x + 48;
  const rigidX = r.x + 158;

  const loose: [Pair[], number, number, number][] = [
    [PAIRS_ROWS, 2.4, RED_OCHRE, 0.9],
    [PAIRS_COLUMNS, 2.4, MIST, 0.8],
    [PAIRS_RING, -2.4, YELLOW_OCHRE, 0.8],
  ];
  for (const [pairs, bow, color, alpha] of loose) {
    for (const [c1, r1, c2, r2] of pairs) looseBond(g, rnd, gridAt(looseX, mid, c1, r1), gridAt(looseX, mid, c2, r2), bow, color, alpha);
  }
  gridDots(g, rnd, looseX, mid);

  for (const [c1, r1, c2, r2] of PAIRS_ROWS) {
    const a = gridAt(rigidX, mid, c1, r1);
    const b = gridAt(rigidX, mid, c2, r2);
    handLine(g, rnd, a.x, a.y, b.x, b.y, 3.4, RED_OCHRE, 1);
  }
  gridDots(g, rnd, rigidX, mid);

  // The pool where the spin still burns: one full point of chalk, alone,
  // with three short flicks above it for its flame. It sits off the middle
  // of the pool, with mist across the rest, so the water shows no eye.
  const litPool = r.x + 268;
  const litX = litPool - 9;
  const litY = mid + 4;
  pool(g, rnd, litPool, mid, 31, 19);
  for (const k of [-1, 0, 1]) handLine(g, rnd, litX + k * 2.6, litY - 4.4, litX + k * 5, litY - 8.6 + Math.abs(k) * 1.2, 1.4, CHALK, 0.95);
  dab(g, rnd, litX, litY, 2.7, CHALK, 1);
  mist(g, rnd, litPool - 2, mid - 9, 26);

  // The pool where it is screened: the spin an empty circle, its light out,
  // the carriers around it, and the ring that closes it with one of them.
  const darkPool = r.x + 366;
  const darkX = darkPool + 7;
  pool(g, rnd, darkPool, mid, 38, 23);
  mist(g, rnd, darkPool - 30, mid + 15, 34);
  const boundAngle = -0.5;
  const darkY = mid - 2;
  const bound = { x: darkX + Math.cos(boundAngle) * 6.4, y: darkY + Math.sin(boundAngle) * 6.4 };
  for (let k = 0; k < 9; k++) {
    const a = boundAngle + 0.75 + (k / 9) * (Math.PI * 2 - 1.5) + jitter(rnd, 0.12);
    const far = 12 + jitter(rnd, 1.6);
    dab(g, rnd, darkX + Math.cos(a) * far * 1.2, darkY + Math.sin(a) * far * 0.85, 1.5, MIST, 0.9);
  }
  dab(g, rnd, bound.x, bound.y, 2.1, MIST, 0.95);
  g.lineStyle(1.3, CHALK, 0.8);
  g.strokeCircle(darkX, darkY, 2.3);
  const ring: P[] = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const ex = Math.cos(a) * 8;
    const ey = Math.sin(a) * 5.2;
    ring.push({
      x: (darkX + bound.x) / 2 + ex * Math.cos(boundAngle) - ey * Math.sin(boundAngle),
      y: (darkY + bound.y) / 2 + ex * Math.sin(boundAngle) + ey * Math.cos(boundAngle),
    });
  }
  handPath(g, rnd, ring, 1.4, MIST, 0.95, true);

  mist(g, rnd, litPool - 40, mid - 27, 58);
  mist(g, rnd, darkPool - 30, mid + 30, 62);
  mist(g, rnd, litPool + 12, mid + 28, 40);
  reeds(g, rnd, litPool - 44, mid + 26);
  reeds(g, rnd, darkPool + 40, mid - 16, 2);
};

// A piece of honeycomb. The lattice has two sites per cell, A and B, and
// three bond directions: straight down from A, up to the right and up to the
// left. Each direction is painted in its own pigment, because in this
// material each direction wants the spins along its own axis, and every site
// sits on one bond of each. Only the sites `keep` lets through are painted;
// where a site's partner is missing, the bond is drawn as a half stub, so
// that an edge site still shows all three of its bonds and a seam shows what
// it has cut.
const BOND_PIGMENTS = [MIST, RED_OCHRE, YELLOW_OCHRE];

function honeycomb(g: G, rnd: Rnd, b: number, ox: number, oy: number, keep: (x: number, y: number) => boolean, alpha = 0.9) {
  const w = Math.sqrt(3) * b;
  const dirs = [
    { x: 0, y: b },
    { x: w / 2, y: -b / 2 },
    { x: -w / 2, y: -b / 2 },
  ];
  // The B site each direction leads to from A(i, j), as a step in (i, j).
  const toB = [
    [0, 0],
    [1, -1],
    [0, -1],
  ];
  const siteA = (i: number, j: number): P => ({ x: ox + w * (i + j / 2), y: oy + 1.5 * b * j });
  const siteB = (i: number, j: number): P => ({ x: ox + w * (i + j / 2), y: oy + 1.5 * b * j + b });
  const hasA = (i: number, j: number) => {
    const p = siteA(i, j);
    return keep(p.x, p.y);
  };
  const hasB = (i: number, j: number) => {
    const p = siteB(i, j);
    return keep(p.x, p.y);
  };
  const bond = (p: P, d: number, sign: number, whole: boolean) => {
    const reach = whole ? 1 : 0.5;
    handLine(g, rnd, p.x, p.y, p.x + sign * dirs[d].x * reach, p.y + sign * dirs[d].y * reach, 1.5, BOND_PIGMENTS[d], alpha);
  };
  for (let j = -12; j <= 12; j++) {
    for (let i = -30; i <= 30; i++) {
      for (let d = 0; d < 3; d++) {
        if (hasA(i, j)) bond(siteA(i, j), d, 1, hasB(i + toB[d][0], j + toB[d][1]));
        if (hasB(i, j) && !hasA(i - toB[d][0], j - toB[d][1])) bond(siteB(i, j), d, -1, false);
      }
    }
  }
}

// A layer: a strip of honeycomb `rows` hexagons deep, from `x1` to `x2`, with
// its top at `top`, on a thin brown ground. The lattice starts at `x1`, plus
// `shift`. Two layers stacked three bond lengths apart are in register when
// their lattices start at the same place, and the stubs of one then meet the
// stubs of the other; a stacking fault is a layer whose start is off by a
// part of a hexagon.
function layer(g: G, rnd: Rnd, b: number, x1: number, x2: number, top: number, rows: number, shift: number, alpha = 0.9) {
  const depth = (0.5 + 1.5 * rows) * b;
  const ground = [
    { x: x1 - 3, y: top - 1 },
    { x: x2 + 3, y: top - 1 },
    { x: x2 + 3, y: top + depth + 1 },
    { x: x1 - 3, y: top + depth + 1 },
  ];
  wash(g, rnd, ground, RED_OCHRE, 0.12);
  wash(g, rnd, ground, YELLOW_OCHRE, 0.06);
  honeycomb(g, rnd, b, x1 + shift, top + b / 2, (x, y) => x >= x1 - 0.5 && x <= x2 + 0.5 && y >= top - 0.5 && y <= top + depth + 0.5, alpha);
}

// The Screened Swamp's pass: the Polycrystalline Ruthenium Trichloride
// Golem, rising out of a pool. It is a stack of brown-black layers, a head, a
// deep trunk and a base, each a strip of honeycomb with its three bond
// directions in three pigments, and each slid sideways against the next
// along a stacking fault: the stubs of one layer miss the stubs of the next.
// A blow comes in from the left as one whole sign. Inside the trunk it has
// parted into two halves, one leaving upward and one downward, and each
// stops at the first seam it meets, where a short bar closes its way.
const paintTrichlorideGolem: PlatePainter = (g, r, rnd) => {
  const b = 6.5;
  const w = Math.sqrt(3) * b;
  const cx = r.x + 272;
  const headTop = r.y + 4;
  const trunkTop = headTop + 3 * b;
  const trunkDepth = 5 * b;
  const trunkEnd = trunkTop + trunkDepth;
  const baseTop = trunkEnd + b;
  const trunkLeft = cx - 3 * w;
  const trunkMid = trunkTop + trunkDepth / 2;

  pool(g, rnd, r.x + 52, r.y + 68, 30, 8);
  pool(g, rnd, r.x + 388, r.y + 30, 25, 8);
  pool(g, rnd, r.x + 378, r.y + 74, 22, 6);
  mist(g, rnd, r.x + 26, r.y + 60, 60);
  mist(g, rnd, r.x + 18, r.y + 12, 52);
  mist(g, rnd, r.x + 358, r.y + 22, 56);
  mist(g, rnd, r.x + 350, r.y + 68, 50);
  reeds(g, rnd, r.x + 94, r.y + 78);
  reeds(g, rnd, r.x + 6, r.y + 80, 2);
  reeds(g, rnd, r.x + 346, r.y + 46);
  reeds(g, rnd, r.x + 406, r.y + 82, 2);

  layer(g, rnd, b, cx - 1.5 * w + 2, cx + 1.5 * w + 2, headTop, 1, 4.4, 0.7);
  layer(g, rnd, b, trunkLeft, cx + 3 * w, trunkTop, 3, 0, 0.7);
  layer(g, rnd, b, cx - 2.5 * w - 5, cx + 2.5 * w - 5, baseTop, 1, 4.6, 0.7);

  // The water it rises out of, over the foot of the base.
  pool(g, rnd, cx - 3, baseTop + 2 * b + 2.5, 46, 5);
  mist(g, rnd, cx - 40, baseTop + 2 * b + 1, 72);

  // The blow, whole, with the strokes of its flight behind it.
  const blowX = trunkLeft - 18;
  for (const k of [-1, 0, 1]) handLine(g, rnd, blowX - 27 + Math.abs(k) * 4, trunkMid + k * 4.5, blowX - 14, trunkMid + k * 4.5, 1.4, CHALK, 0.55);
  flipSign(g, rnd, blowX, trunkMid, 18, 0);

  // The two halves, and the bar on the seam that stops each.
  const partX = cx - 15;
  const reach = 15;
  const climb = 0.96;
  for (const side of [-1, 1] as const) {
    const tailY = trunkMid + side * 3;
    const x = partX + (Math.cos(climb) * reach) / 2;
    const y = tailY + (side * Math.sin(climb) * reach) / 2;
    flipSign(g, rnd, x, y, reach, side, side * climb);
    const tipX = partX + Math.cos(climb) * reach;
    const seam = side < 0 ? trunkTop - b / 2 : trunkEnd + b / 2;
    handLine(g, rnd, tipX - 6, seam, tipX + 6, seam, 2.4, CHALK, 0.97);
  }
};

// A jagged line for a crack in the crust.
function jagged(rnd: Rnd, x1: number, y1: number, x2: number, y2: number, amount: number): P[] {
  const steps = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 7));
  const pts: P[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const off = k === 0 || k === steps ? 0 : (k % 2 === 0 ? 1 : -1) * (amount * 0.5 + rnd() * amount);
    pts.push({ x: x1 + (x2 - x1) * t - ((y2 - y1) / steps / 7) * off, y: y1 + (y2 - y1) * t + ((x2 - x1) / steps / 7) * off });
  }
  return pts;
}

// The Screened Swamp's last chapter. Left, the layers as the golem held
// them, slid against each other, the stubs of one missing the stubs of the
// next. Middle, the stacking faults healed: the same layers in register, the
// stubs joined into bonds, one honeycomb from top to bottom. What comes
// apart in it now travels: two halves cross the whole crystal and stand at
// its far side. The right third is the ground ahead: scorched crust, and
// cracks in it that are still open and molten.
const paintFaultsHealed: PlatePainter = (g, r, rnd) => {
  const b = 7;
  const w = Math.sqrt(3) * b;
  const top = r.y + 15;

  const faultedX = r.x + 14;
  const slides = [0, 6, -1.5];
  slides.forEach((slide, k) => {
    layer(g, rnd, b, faultedX + slide + 4, faultedX + slide + 4 + 5 * w, top + 3 * b * k, 1, 0);
  });

  const healedX = r.x + 132;
  const healedEnd = healedX + 9 * w;
  const depth = 8 * b;
  const ground = [
    { x: healedX - 3, y: top - 1 },
    { x: healedEnd + 3, y: top - 1 },
    { x: healedEnd + 3, y: top + depth + 1 },
    { x: healedX - 3, y: top + depth + 1 },
  ];
  wash(g, rnd, ground, RED_OCHRE, 0.12);
  wash(g, rnd, ground, YELLOW_OCHRE, 0.06);
  honeycomb(g, rnd, b, healedX, top + b / 2, (x, y) => x >= healedX - 0.5 && x <= healedEnd + 0.5 && y >= top - 0.5 && y <= top + depth + 0.5);

  // The two halves: they part at the near side and cross to the far one,
  // one through the top layer and one through the bottom.
  const part = { x: healedX - 8, y: top + depth / 2 };
  const upperY = top + b;
  const lowerY = top + depth - b;
  const far = healedEnd + 14;
  trail(g, rnd, [part, { x: healedX + 12, y: upperY }, { x: far - 12, y: upperY }], 0.85);
  trail(g, rnd, [part, { x: healedX + 12, y: lowerY }, { x: far - 12, y: lowerY }], 0.85);
  flipSign(g, rnd, far, upperY, 16, -1);
  flipSign(g, rnd, far, lowerY, 16, 1);

  // The Defect Scars ahead: scorched crust, two old burns that have closed,
  // and three cracks still open, molten in the middle.
  const crustX = r.x + 300;
  const crustEnd = r.x + r.w - 3;
  wash(
    g,
    rnd,
    [
      { x: crustX + 8, y: r.y + 12 },
      { x: crustX + 60, y: r.y + 7 },
      { x: crustEnd, y: r.y + 14 },
      { x: crustEnd, y: r.y + 74 },
      { x: crustX + 70, y: r.y + 80 },
      { x: crustX + 4, y: r.y + 70 },
      { x: crustX - 4, y: r.y + 40 },
    ],
    RED_OCHRE,
    0.3
  );
  handPath(g, rnd, jagged(rnd, crustX + 12, r.y + 58, crustX + 44, r.y + 66, 1.6), 1.4, CHARCOAL, 0.8);
  handPath(g, rnd, jagged(rnd, crustX + 78, r.y + 14, crustX + 108, r.y + 20, 1.6), 1.4, CHARCOAL, 0.8);
  const cracks: [number, number, number, number][] = [
    [crustX + 14, r.y + 22, crustX + 58, r.y + 40],
    [crustX + 62, r.y + 62, crustX + 110, r.y + 44],
    [crustX + 52, r.y + 74, crustX + 30, r.y + 46],
  ];
  for (const [x1, y1, x2, y2] of cracks) {
    const line = jagged(rnd, x1, y1, x2, y2, 2.6);
    g.lineStyle(5, CHARCOAL, 0.95);
    g.strokePoints(line, false);
    g.lineStyle(2.8, RED_OCHRE, 1);
    g.strokePoints(line, false);
    g.lineStyle(1.4, YELLOW_OCHRE, 0.95);
    g.strokePoints(line, false);
  }
};

export const PLATES: Record<string, PlatePainter> = {
  '8-history': paintBog,
  '8-decoherence': paintPairings,
  '8-pass': paintTrichlorideGolem,
  '8-release': paintFaultsHealed,
};
