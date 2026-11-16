import { CHARCOAL, CHALK, RED_OCHRE, YELLOW_OCHRE, dab, handLine, handPath, jitter, wash } from './brush';
import type { G, PlatePainter, Rnd } from './brush';

// The Mean Fields: morning, wheat and a hedge, forest on both sides. Its own
// earths are a spring green for the fields and a darker one for the hedge.
const GREEN_EARTH = 0x5f7a44;
const HEDGE_GREEN = 0x2f4a2a;

// A stalk of wheat with its ear, which is also a spin, painted the way a
// feathered sign is: a stem with two pairs of barbs at the top (`dir` -1), at
// the bottom (+1), or at both ends (0), the last for a stalk that has not
// chosen.
function stalk(g: G, rnd: Rnd, x: number, y: number, len: number, dir: -1 | 0 | 1, color: number, alpha = 0.92) {
  const half = len / 2;
  const lean = jitter(rnd, 1.2);
  const top = { x: x + lean, y: y - half };
  const foot = { x: x - lean, y: y + half };
  handLine(g, rnd, top.x, top.y, foot.x, foot.y, 1.6, color, alpha);
  const barbs = (end: { x: number; y: number }, sign: number) => {
    for (const k of [0.5, 3.5]) {
      const by = end.y + sign * k;
      g.lineStyle(1.4, color, alpha);
      g.lineBetween(end.x, by, end.x - 3.2 + jitter(rnd, 0.5), by + sign * 3.2);
      g.lineBetween(end.x, by, end.x + 3.2 + jitter(rnd, 0.5), by + sign * 3.2);
    }
  };
  if (dir <= 0) barbs(top, 1);
  if (dir >= 0) barbs(foot, -1);
}

// A tree of the forest: a trunk, two boughs, and one dab of green for a crown.
function tree(g: G, rnd: Rnd, x: number, base: number, height: number, green: number) {
  const tip = base - height;
  handLine(g, rnd, x, base, x + jitter(rnd, 0.8), tip, 1.3, CHARCOAL, 0.85);
  g.lineStyle(1.1, CHARCOAL, 0.8);
  g.lineBetween(x, base - height * 0.45, x - 2.6, base - height * 0.8);
  g.lineBetween(x, base - height * 0.45, x + 2.6, base - height * 0.8);
  dab(g, rnd, x + jitter(rnd, 0.6), tip + 1.5, 2.6, green, 0.7);
}

// The Mean Fields' first chapter, read left to right. One wide field whose
// stalks carry an ear at both ends, undecided; the grain of dust; then the
// hedge that grows out of nothing down the middle and the two fields it
// leaves, washed in two different earths, every stalk up in one and down in
// the other. The two are mirror images across the hedge because they are
// equal in energy. The forest hems the field in along both long edges, as it
// does in the world.
const paintMeanFields: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  const split = r.x + r.w * 0.36;
  const open = 46;
  const forest = 13;
  const top = r.y + forest;
  const floor = bottom - forest;

  wash(
    g,
    rnd,
    [
      { x: split + 4, y: mid },
      { x: split + open, y: top },
      { x: right, y: top },
      { x: right, y: mid },
    ],
    YELLOW_OCHRE,
    0.36
  );
  wash(
    g,
    rnd,
    [
      { x: split + 4, y: mid },
      { x: right, y: mid },
      { x: right, y: floor },
      { x: split + open, y: floor },
    ],
    GREEN_EARTH,
    0.42
  );

  // The forest: a row of trees along each long edge, standing on it.
  for (let x = r.x + 5; x < right - 2; x += 9) {
    tree(g, rnd, x + jitter(rnd, 1.2), top - 1 + jitter(rnd, 0.8), 9 + jitter(rnd, 1.5), GREEN_EARTH);
    tree(g, rnd, x + 4 + jitter(rnd, 1.2), bottom + jitter(rnd, 0.8), 9 + jitter(rnd, 1.5), GREEN_EARTH);
  }

  // Undecided stalks, three staggered rows, in charcoal.
  for (let row = 0; row < 3; row++) {
    const y = mid + (row - 1) * 20;
    const reach = split + (open * Math.abs(y - mid)) / (r.h / 2) - 16;
    for (let x = r.x + 13 + (row % 2) * 11; x < reach; x += 22) {
      stalk(g, rnd, x + jitter(rnd, 1.5), y + jitter(rnd, 1.2), 17, 0, CHARCOAL, 0.85);
    }
  }
  // The chosen stalks, in red ochre: one row each side of the hedge.
  const hedgeHalf = 7;
  for (let x = split + open + 10; x < right - 5; x += 15) {
    stalk(g, rnd, x + jitter(rnd, 1.2), (top + mid - hedgeHalf) / 2 + jitter(rnd, 1), 15, -1, RED_OCHRE);
    stalk(g, rnd, x + jitter(rnd, 1.2), (floor + mid + hedgeHalf) / 2 + jitter(rnd, 1), 15, 1, RED_OCHRE);
  }

  // The hedge: dabs that start from a single small one at the split and are
  // full grown a little way along.
  const grown = split + 60;
  for (let x = split + 9; x < right - 2; x += 5.5) {
    const size = 1.6 + Math.min(1, (x - split) / (grown - split)) * (hedgeHalf - 2.2);
    dab(g, rnd, x + jitter(rnd, 0.8), mid + jitter(rnd, 1.1), size, HEDGE_GREEN, 0.92);
  }
  for (let x = grown; x < right - 4; x += 11) {
    dab(g, rnd, x + jitter(rnd, 2), mid - 2 + jitter(rnd, 1.5), 1.5, GREEN_EARTH, 0.8);
  }

  // The fluctuation, no bigger than a grain of dust, where the hedge begins:
  // a point of chalk with short rays and a ring of dots around it.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const far = i % 2 === 0 ? 7.5 : 5;
    handLine(g, rnd, split + Math.cos(a) * 2.6, mid + Math.sin(a) * 2.6, split + Math.cos(a) * far, mid + Math.sin(a) * far, 1.3, CHALK, 0.95);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.fillStyle(CHALK, 0.7);
    g.fillCircle(split + Math.cos(a) * 11, mid + Math.sin(a) * 11, 0.9);
  }
  g.fillStyle(CHALK, 1);
  g.fillCircle(split, mid, 2);
};

type Pt = { x: number; y: number };

// The strip of forest along each long edge that every plate of this world
// carries, with the trees left out where `skip` says so.
const FOREST = 13;
function forest(g: G, rnd: Rnd, from: number, to: number, topEdge: number, bottomEdge: number, skip?: (x: number) => boolean) {
  for (let x = from; x < to; x += 9) {
    if (skip && skip(x)) continue;
    tree(g, rnd, x + jitter(rnd, 1.2), topEdge - 1 + jitter(rnd, 0.8), 9 + jitter(rnd, 1.5), GREEN_EARTH);
    tree(g, rnd, x + 4 + jitter(rnd, 1.2), bottomEdge + jitter(rnd, 0.8), 9 + jitter(rnd, 1.5), GREEN_EARTH);
  }
}

// A stalk that has chosen up and leans by `angle` (radians, positive to the
// right) about its foot, the way wheat leans in a gust: a spin tilted away
// from the direction of the order.
function leaningStalk(g: G, rnd: Rnd, x: number, foot: number, len: number, angle: number, color: number, alpha = 0.92) {
  const ux = Math.sin(angle);
  const uy = -Math.cos(angle);
  const tip = { x: x + ux * len, y: foot + uy * len };
  handLine(g, rnd, x, foot, tip.x, tip.y, 1.6, color, alpha);
  g.lineStyle(1.4, color, alpha);
  for (const k of [0.5, 3.5]) {
    const px = tip.x - ux * k;
    const py = tip.y - uy * k;
    for (const side of [-1, 1]) {
      g.lineBetween(px, py, px - ux * 3.2 - side * uy * 3.2 + jitter(rnd, 0.5), py - uy * 3.2 + side * ux * 3.2);
    }
  }
}

// The two standing stones of the pass, where the branches meet again: the
// same pair in every plate that shows the place.
function standingStones(g: G, rnd: Rnd, x: number, base: number, gap: number, height: number) {
  const stone = (sx: number, h: number) => {
    const w = Math.max(5.5, h * 0.23);
    const pts = [
      { x: sx - w / 2 - 0.7, y: base },
      { x: sx - w / 2 + 0.7, y: base - h * 0.72 },
      { x: sx - w * 0.08, y: base - h },
      { x: sx + w / 2, y: base - h * 0.84 },
      { x: sx + w / 2 + 0.7, y: base },
    ];
    g.fillStyle(CHALK, 0.4);
    g.fillPoints(pts, true);
    handPath(g, rnd, pts, 1.5, CHARCOAL, 0.9, true);
  };
  stone(x - gap / 2, height);
  stone(x + gap / 2, height * 0.9);
}

// A column of the hall that lies past the stones, as the next world paints
// it: a shaft with a bleached capital.
function column(g: G, rnd: Rnd, x: number, base: number, height: number, w: number) {
  const top = base - height;
  g.fillStyle(YELLOW_OCHRE, 0.75);
  g.fillPoints(
    [
      { x: x - w / 2, y: base },
      { x: x - w / 2 + 0.4, y: top + 2 },
      { x: x + w / 2 - 0.4, y: top + 2 },
      { x: x + w / 2, y: base },
    ],
    true
  );
  handLine(g, rnd, x - w / 2, base, x - w / 2 + 0.4, top + 2, 1.3, RED_OCHRE, 0.85);
  handLine(g, rnd, x + w / 2, base, x + w / 2 - 0.4, top + 2, 1.3, RED_OCHRE, 0.85);
  handLine(g, rnd, x - w / 2 - 2, top + 1, x + w / 2 + 2, top + 1, 3, CHALK, 0.95);
}

const centre = (poly: Pt[]): Pt => ({
  x: poly.reduce((sum, p) => sum + p.x, 0) / poly.length,
  y: poly.reduce((sum, p) => sum + p.y, 0) / poly.length,
});

// One grain of the silicon: a pale angular piece with its own stalk inside,
// the choice that grain made.
function grain(g: G, rnd: Rnd, poly: Pt[], dir: -1 | 1) {
  g.fillStyle(CHALK, 0.42);
  g.fillPoints(poly, true);
  const c = centre(poly);
  stalk(g, rnd, c.x, c.y, 11, dir, RED_OCHRE);
}

// The corners of a block of silicon cut into `cols` by `rows` grains: a grid
// whose corners have each been pushed off their place, so no two grains have
// the same shape.
function grainCorners(rnd: Rnd, cols: number, rows: number, cw: number, ch: number): Pt[][] {
  const corners: Pt[][] = [];
  for (let j = 0; j <= rows; j++) {
    const line: Pt[] = [];
    for (let i = 0; i <= cols; i++) {
      const onSide = i === 0 || i === cols;
      const onEnd = j === 0 || j === rows;
      line.push({
        x: i * cw + (onSide ? (i === 0 ? 1 : -1) * rnd() * 2 : jitter(rnd, cw * 0.2)),
        y: j * ch + (onEnd ? (j === 0 ? 1 : -1) * rnd() * 2 : jitter(rnd, ch * 0.2)),
      });
    }
    corners.push(line);
  }
  return corners;
}

// A block of silicon drawn from its corners with its top-left at (ox, oy).
// `dirs` gives each grain's stalk, row by row. Before the anneal the grain
// boundaries are dark lines; after it they are only rows of dots, fading.
function siliconBlock(g: G, rnd: Rnd, corners: Pt[][], ox: number, oy: number, dirs: (-1 | 1)[], annealed: boolean) {
  const rows = corners.length - 1;
  const cols = corners[0].length - 1;
  const at = (j: number, i: number): Pt => ({ x: ox + corners[j][i].x, y: oy + corners[j][i].y });
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      grain(g, rnd, [at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j + 1, i)], dirs[j * cols + i]);
    }
  }
  const boundary = (a: Pt, b: Pt) => {
    if (!annealed) {
      handLine(g, rnd, a.x, a.y, b.x, b.y, 1.9, CHARCOAL, 0.9);
      return;
    }
    const steps = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    g.fillStyle(CHARCOAL, 0.6);
    for (let s = 1; s < steps; s++) {
      g.fillCircle(a.x + ((b.x - a.x) * s) / steps + jitter(rnd, 0.25), a.y + ((b.y - a.y) * s) / steps + jitter(rnd, 0.25), 0.9);
    }
  };
  for (let j = 1; j < rows; j++) for (let i = 0; i < cols; i++) boundary(at(j, i), at(j, i + 1));
  for (let i = 1; i < cols; i++) for (let j = 0; j < rows; j++) boundary(at(j, i), at(j + 1, i));
  const rim: Pt[] = [];
  for (let i = 0; i <= cols; i++) rim.push(at(0, i));
  for (let j = 1; j <= rows; j++) rim.push(at(j, cols));
  for (let i = cols - 1; i >= 0; i--) rim.push(at(rows, i));
  for (let j = rows - 1; j >= 1; j--) rim.push(at(j, 0));
  handPath(g, rnd, rim, annealed ? 1.5 : 1.9, CHARCOAL, 0.9, true);
}

// The Mean Fields' second chapter, read left to right. An ordered field,
// every stalk up, and the ripple that a broken symmetry leaves in its order:
// each stalk leans a little more than the last and then back, one wave of
// tilts along the rows, which is a spin wave and the first quasiparticle.
// Then what the Decoherence does to it: the wave of tilts loses its pattern
// before it has a shape, the stalks shorten and scatter, and only strokes
// and dots are left, which is noise. Far down the field stand the two stones
// where the branches meet again, and the dark thing that waits between them.
const paintRipple: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  const top = r.y + FOREST;
  const floor = bottom - FOREST;
  const breaks = r.x + r.w * 0.44;
  const gone = r.x + r.w * 0.8;
  const wavelength = 120;
  const step = 15;
  const len = 20;

  wash(
    g,
    rnd,
    [
      { x: r.x + 2, y: top + 3 },
      { x: breaks + 2, y: top + 3 },
      { x: breaks + 11, y: mid - 9 },
      { x: breaks - 3, y: mid + 7 },
      { x: breaks + 8, y: floor - 1 },
      { x: r.x + 2, y: floor - 1 },
    ],
    YELLOW_OCHRE,
    0.32
  );
  forest(g, rnd, r.x + 5, right - 2, top, bottom);

  for (let row = 0; row < 2; row++) {
    const foot = row === 0 ? mid - 3 : floor - 1;
    for (let x = r.x + 14 + row * 7.5; x < gone; x += step) {
      const tilt = 0.44 * Math.sin((2 * Math.PI * (x - r.x)) / wavelength);
      if (x < breaks) {
        leaningStalk(g, rnd, x, foot, len, tilt, RED_OCHRE);
        continue;
      }
      // Past this point the pattern is lost a little more with every stalk.
      const lost = (x - breaks) / (gone - breaks);
      const cx = x + jitter(rnd, 7 * lost);
      const cy = foot - len / 2 + jitter(rnd, 16 * lost);
      if (rnd() < 0.25 + lost * 0.75) {
        const strokes = lost < 0.6 ? 2 : 1;
        for (let k = 0; k < strokes; k++) {
          const a = rnd() * Math.PI;
          const half = 2.2 + rnd() * 2.2;
          const sx = cx + jitter(rnd, 5);
          const sy = cy + jitter(rnd, 8);
          handLine(g, rnd, sx - Math.cos(a) * half, sy - Math.sin(a) * half, sx + Math.cos(a) * half, sy + Math.sin(a) * half, 1.5, RED_OCHRE, 0.85 - lost * 0.25);
        }
      } else {
        const short = len * (1 - 0.5 * lost);
        leaningStalk(g, rnd, cx, cy + short / 2, short, tilt * (1 - lost) + jitter(rnd, 1.5) * (0.3 + lost), RED_OCHRE, 0.9 - lost * 0.25);
      }
    }
  }
  // The noise: dots where the ripple was going, thinning out down the field.
  for (let i = 0; i < 46; i++) {
    const t = rnd();
    const x = breaks + 6 + t * (gone - breaks + 4);
    const y = top + 6 + rnd() * (floor - top - 10);
    g.fillStyle(i % 3 === 0 ? CHARCOAL : RED_OCHRE, 0.85 - t * 0.3);
    g.fillCircle(x, y, 0.9 + rnd() * 0.5);
  }

  // The stones, small with distance, and the mark between them: a few dark
  // blocks set on one another.
  const sx = right - 30;
  const base = mid + 15;
  standingStones(g, rnd, sx, base, 34, 29);
  const block = (pts: Pt[]) => {
    g.fillStyle(CHARCOAL, 0.92);
    g.fillPoints(
      pts.map((p) => ({ x: sx + p.x + jitter(rnd, 0.4), y: base + p.y + jitter(rnd, 0.4) })),
      true
    );
  };
  block([
    { x: -5, y: 0 },
    { x: -6, y: -9.5 },
    { x: 5.5, y: -10.5 },
    { x: 6, y: 0 },
  ]);
  block([
    { x: -3, y: -11 },
    { x: -3.5, y: -16 },
    { x: 3, y: -16.5 },
    { x: 3.5, y: -11.5 },
  ]);
  block([
    { x: -9.5, y: -9 },
    { x: -6.5, y: -9.5 },
    { x: -6.5, y: -3 },
    { x: -9, y: -3.5 },
  ]);
  block([
    { x: 6.5, y: -10 },
    { x: 9.5, y: -9.5 },
    { x: 9, y: -4 },
    { x: 6.5, y: -3.5 },
  ]);
};

// The Polycrystalline Silicon Golem's body, feet at the origin and y upward
// negative: nine grains that share their corners, so every boundary between
// two grains is one line. The head, two arms, a torso of four and two legs.
const GOLEM_CORNERS: Pt[] = [
  { x: -17, y: -55 }, // 0 torso top left
  { x: -8, y: -55 }, // 1 head base left
  { x: 0, y: -54 }, // 2 torso top middle
  { x: 9, y: -55 }, // 3 head base right
  { x: 17, y: -55 }, // 4 torso top right
  { x: -17, y: -33 }, // 5 torso left middle
  { x: 3, y: -38 }, // 6 torso centre
  { x: 17, y: -40 }, // 7 torso right middle
  { x: -16, y: -19 }, // 8 torso bottom left
  { x: -5, y: -19 }, // 9 left leg inner top
  { x: -1, y: -19 }, // 10 torso bottom middle
  { x: 4, y: -20 }, // 11 right leg inner top
  { x: 16, y: -20 }, // 12 torso bottom right
  { x: -10, y: -66 }, // 13 head
  { x: -2, y: -72 }, // 14 head
  { x: 8, y: -69 }, // 15 head
  { x: -28, y: -51 }, // 16 left arm
  { x: -30, y: -30 }, // 17 left arm
  { x: -24, y: -22 }, // 18 left arm
  { x: 28, y: -52 }, // 19 right arm
  { x: 31, y: -33 }, // 20 right arm
  { x: 25, y: -24 }, // 21 right arm
  { x: -4, y: 0 }, // 22 left foot
  { x: -17, y: 0 }, // 23 left foot
  { x: 18, y: 0 }, // 24 right foot
  { x: 5, y: 0 }, // 25 right foot
];
// Each grain's corners and its stalk. The mix is fixed here, never drawn at
// random: every grain has chosen and the grains disagree. Across each of the
// four boundaries inside the torso, and where an arm or a leg joins it, the
// two sides hold opposite answers.
const GOLEM_GRAINS: { corners: number[]; dir: -1 | 1 }[] = [
  { corners: [1, 13, 14, 15, 3, 2], dir: -1 },
  { corners: [0, 1, 2, 6, 5], dir: 1 },
  { corners: [2, 3, 4, 7, 6], dir: -1 },
  { corners: [5, 6, 10, 9, 8], dir: -1 },
  { corners: [6, 7, 12, 11, 10], dir: 1 },
  { corners: [0, 16, 17, 18, 5], dir: -1 },
  { corners: [4, 19, 20, 21, 7], dir: 1 },
  { corners: [8, 9, 22, 23], dir: 1 },
  { corners: [11, 12, 24, 25], dir: -1 },
];

// The Mean Fields' third chapter. The two branches come down the field as
// they left the hedge, every stalk up in the yellow one and down in the green
// one, and where the hedge ends they meet again. There, between the standing
// stones, stands the Polycrystalline Silicon Golem: a body of angular grains
// with dark boundaries, and inside each grain one stalk. Each grain has
// chosen, and the grains do not agree, so the whole has no single choice.
const paintSiliconGolem: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  const top = r.y + FOREST;
  const floor = bottom - FOREST;
  const meet = r.x + r.w * 0.45;
  const cx = r.x + r.w * 0.73;
  const close = 46;

  wash(
    g,
    rnd,
    [
      { x: r.x, y: top },
      { x: meet - close, y: top },
      { x: meet - 4, y: mid },
      { x: r.x, y: mid },
    ],
    YELLOW_OCHRE,
    0.36
  );
  wash(
    g,
    rnd,
    [
      { x: r.x, y: mid },
      { x: meet - 4, y: mid },
      { x: meet - close, y: floor },
      { x: r.x, y: floor },
    ],
    GREEN_EARTH,
    0.42
  );
  // The forest opens at the pass, where the golem fills the field.
  forest(g, rnd, r.x + 5, right - 2, top, bottom, (x) => Math.abs(x + 2 - cx) < 74);

  const hedgeHalf = 7;
  for (let x = r.x + 9; x < meet - close - 4; x += 15) {
    stalk(g, rnd, x + jitter(rnd, 1.2), (top + mid - hedgeHalf) / 2 + jitter(rnd, 1), 15, -1, RED_OCHRE);
    stalk(g, rnd, x + jitter(rnd, 1.2), (floor + mid + hedgeHalf) / 2 + jitter(rnd, 1), 15, 1, RED_OCHRE);
  }
  // The hedge, full grown at the left and closing to a single dab where the
  // two fields become one again.
  for (let x = r.x + 8; x < meet - 8; x += 5.5) {
    const size = 1.6 + Math.min(1, (meet - 8 - x) / 60) * (hedgeHalf - 2.2);
    dab(g, rnd, x + jitter(rnd, 0.8), mid + jitter(rnd, 1.1), size, HEDGE_GREEN, 0.92);
  }

  const feet = bottom - 5;
  standingStones(g, rnd, cx, feet + 1, 112, 50);
  const corners = GOLEM_CORNERS.map((p) => ({ x: cx + (p.x + jitter(rnd, 0.9)) * 1.2, y: feet + (p.y + jitter(rnd, 0.9)) * 1.06 }));
  for (const piece of GOLEM_GRAINS) {
    grain(
      g,
      rnd,
      piece.corners.map((i) => corners[i]),
      piece.dir
    );
  }
  for (const piece of GOLEM_GRAINS) {
    handPath(
      g,
      rnd,
      piece.corners.map((i) => corners[i]),
      1.9,
      CHARCOAL,
      0.92,
      true
    );
  }
};

// How the grains of the block stand before the anneal, row by row: half up
// and half down, fixed here so that the disagreement never depends on a draw.
const MIXED: (-1 | 1)[] = [-1, 1, 1, -1, 1, -1, 1, 1, -1, -1, 1, -1];
const AGREED: (-1 | 1)[] = MIXED.map(() => -1);

// The Mean Fields' last chapter. A block of silicon as it stood in the pass:
// grains with dark boundaries, their stalks up and down. Then the same block
// after the boundaries let go: they are only dotted lines, and every stalk
// points the same way, one choice held everywhere at once. No figure stands
// between the stones: the ground there is open, and past it is the first
// sign of the next world, a row of identical columns.
const paintAnneal: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  const top = r.y + FOREST;
  const cw = 23;
  const ch = 17;
  const corners = grainCorners(rnd, 4, 3, cw, ch);
  const blockTop = mid - (3 * ch) / 2;
  siliconBlock(g, rnd, corners, r.x + 14, blockTop, MIXED, false);
  siliconBlock(g, rnd, corners, r.x + 142, blockTop, AGREED, true);

  const sx = r.x + r.w * 0.76;
  // The forest hems the field as far as the stones; past them is the hall.
  forest(g, rnd, r.x + 5, sx + 24, top, bottom);
  standingStones(g, rnd, sx, mid + 16, 38, 31);
  for (let i = 0; i < 4; i++) {
    column(g, rnd, right - 53 + i * 15, mid + 16, 22, 6);
  }
};

export const PLATES: Record<string, PlatePainter> = {
  '1-history': paintMeanFields,
  '1-decoherence': paintRipple,
  '1-pass': paintSiliconGolem,
  '1-release': paintAnneal,
};
