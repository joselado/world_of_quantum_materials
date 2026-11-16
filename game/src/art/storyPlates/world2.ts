import { CHARCOAL, CHALK, YELLOW_OCHRE, handLine, handPath, jitter, wash } from './brush';
import type { G, PlatePainter, Rnd } from './brush';

// The Stone Lattice: hard midday sun on an open cloister, identical columns
// at one spacing with dark shadow between them. Its own earths are the
// sandstone of the shafts and the terracotta that lines them; the bleached
// capitals are chalk and the cast shadow is charcoal.
const SANDSTONE = 0xc9ad84;
const TERRACOTTA = 0xb05a36;
// The dead teal of the sunken domains past the hall, one of the two pigments
// the next world owns. It is used only for the sign of that world.
const DEAD_TEAL = 0x44706c;

type Pt = { x: number; y: number };

// One column: a sandstone shaft lined in terracotta on a terracotta plinth,
// a bleached capital, and the short shadow midday gives it. Every column is
// the same sign, and a painter places them without any drift, since the
// spacing is the physics.
function column(g: G, rnd: Rnd, x: number, base: number, height: number, w = 8) {
  const top = base - height;
  g.fillStyle(CHARCOAL, 0.7);
  g.fillPoints(
    [
      { x: x - w / 2, y: base },
      { x: x + w / 2 + w * 0.8, y: base + 1 },
      { x: x + w / 2 + w * 0.9, y: base + 4 },
      { x: x - w / 2 + 1, y: base + 3.5 },
    ],
    true
  );
  g.fillStyle(SANDSTONE, 0.82);
  g.fillPoints(
    [
      { x: x - w / 2, y: base },
      { x: x - w / 2 + 0.6, y: top + 2 },
      { x: x + w / 2 - 0.6, y: top + 2 },
      { x: x + w / 2, y: base },
    ],
    true
  );
  handLine(g, rnd, x - w / 2, base, x - w / 2 + 0.6, top + 2, 1.4, TERRACOTTA, 0.9);
  handLine(g, rnd, x + w / 2, base, x + w / 2 - 0.6, top + 2, 1.4, TERRACOTTA, 0.9);
  handLine(g, rnd, x - w / 2 - 2, base - 1.2, x + w / 2 + 2, base - 1.2, 3, TERRACOTTA, 0.95);
  handLine(g, rnd, x - w / 2 - 2.5, top + 1.6, x + w / 2 + 2.5, top + 1.6, 3.6, CHALK, 0.97);
}

// The pale stone floor the columns stand in: one thin strip of sandstone.
function floorStrip(g: G, rnd: Rnd, from: number, to: number, base: number) {
  wash(
    g,
    rnd,
    [
      { x: from, y: base - 1 },
      { x: to, y: base - 1 },
      { x: to, y: base + 6 },
      { x: from, y: base + 6 },
    ],
    SANDSTONE,
    0.24
  );
}

// A chalk stroke along y(x) from `from` to `to`.
function chalkCurve(g: G, rnd: Rnd, from: number, to: number, y: (x: number) => number, width = 2.2) {
  const pts: Pt[] = [];
  for (let x = from; x < to; x += 3.5) pts.push({ x, y: y(x) });
  pts.push({ x: to, y: y(to) });
  handPath(g, rnd, pts, width, CHALK, 0.97);
}

const centre = (poly: Pt[]): Pt => ({
  x: poly.reduce((sum, p) => sum + p.x, 0) / poly.length,
  y: poly.reduce((sum, p) => sum + p.y, 0) / poly.length,
});

function inside(poly: Pt[], p: Pt): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

// How far a point is from the nearest side of a shape.
function toEdge(poly: Pt[], p: Pt): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t));
  }
  return best;
}

// A crystal lattice as a wall painter can put it down: a square array of
// charcoal dots at one spacing, turned by `degrees` about `origin`, kept to
// the inside of `shape` and `margin` clear of its sides. The lattice is put
// on without any drift: its regularity is what the dots say.
const SPACING = 5;
function dotLattice(g: G, shape: Pt[], origin: Pt, degrees: number, margin: number) {
  const a = (degrees * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  g.fillStyle(CHARCOAL, 0.9);
  for (let i = -22; i <= 22; i++) {
    for (let j = -14; j <= 14; j++) {
      const p = { x: origin.x + (i * cos - j * sin) * SPACING, y: origin.y + (i * sin + j * cos) * SPACING };
      if (inside(shape, p) && toEdge(shape, p) >= margin) g.fillCircle(p.x, p.y, 0.95);
    }
  }
}

// The width of a seam of glass between two grains of quartz.
const SEAM = 3.4;

// Grains of quartz with glass between them. A grain is named by the corners
// it runs through, and two grains that touch share theirs. Each grain is a
// small perfect lattice, turned its own way, so that no row of dots carries
// on from one grain into the next. A side that two grains share is a seam of
// glass: bare chalk with no dots at all, since glass repeats nothing. A side
// that belongs to one grain only is the outside of the stone, lined in
// terracotta.
function quartzGrains(g: G, rnd: Rnd, corners: Pt[], grains: { corners: number[]; degrees: number }[]) {
  const shapes = grains.map((grain) => grain.corners.map((i) => corners[i]));
  const sides = new Map<string, { a: number; b: number; count: number }>();
  for (const grain of grains) {
    grain.corners.forEach((a, k) => {
      const b = grain.corners[(k + 1) % grain.corners.length];
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      const side = sides.get(key);
      if (side) side.count++;
      else sides.set(key, { a, b, count: 1 });
    });
  }
  for (const shape of shapes) {
    g.fillStyle(SANDSTONE, 0.6);
    g.fillPoints(shape, true);
  }
  shapes.forEach((shape, k) => dotLattice(g, shape, centre(shape), grains[k].degrees, SEAM / 2 + 1.3));
  for (const side of sides.values()) {
    if (side.count === 1) handLine(g, rnd, corners[side.a].x, corners[side.a].y, corners[side.b].x, corners[side.b].y, 1.5, TERRACOTTA, 0.9);
  }
  for (const side of sides.values()) {
    if (side.count > 1) handLine(g, rnd, corners[side.a].x, corners[side.a].y, corners[side.b].x, corners[side.b].y, SEAM, CHALK, 0.95);
  }
}

// The Stone Lattice's first chapter. A colonnade: the same column at exactly
// the same spacing across the whole plate, running off both ends of it. And
// through it one chalk wave, the Bloch state: it rises by the same amount in
// every bay and belongs to none of them, and like the columns it does not
// end at the edge of the plate. Shift the picture by one bay and it is the
// same picture, which is the symmetry the chapter names.
const paintColonnade: PlatePainter = (g, r, rnd) => {
  const right = r.x + r.w;
  const base = r.y + r.h - 11;
  const height = 66;
  const bay = 34;
  const first = r.x + (r.w - 11 * bay) / 2;
  const level = base - height * 0.52;

  floorStrip(g, rnd, r.x, right, base);
  for (let i = 0; i < 12; i++) column(g, rnd, first + i * bay, base, height);
  // Crest in the middle of each bay, trough at each column.
  chalkCurve(g, rnd, r.x + 1, right - 1, (x) => level + 11 * Math.cos((2 * Math.PI * (x - first)) / bay));
};

// The Stone Lattice's second chapter. First the floor: tiles of two kinds
// laid in turn, and a tie over each pair, so the thing that repeats is the
// pair and not the tile. Then the colonnade with a dot on the floor wherever
// the repetition asks for a column. One column stands a quarter of a bay off
// its dot. The wave is gone from every bay but the one that column widened,
// where a single hump is left that dies out on both sides: a state trapped in
// one place, which is what a break in the repetition does to a Bloch state.
const paintOutOfStep: PlatePainter = (g, r, rnd) => {
  const right = r.x + r.w;
  const mid = r.y + r.h / 2;
  const base = r.y + r.h - 11;
  const height = 66;
  const bay = 32;
  const level = base - height * 0.52;

  // Four cells of two tiles. The ties join the first tile to the second, the
  // third to the fourth, and never reach across from one cell to the next.
  const tile = 15;
  const tileTop = mid - 2;
  for (let cell = 0; cell < 4; cell++) {
    const x = r.x + 10 + cell * (2 * tile + 5);
    for (let k = 0; k < 2; k++) {
      const tx = x + k * tile;
      const corners = [
        { x: tx + 0.8, y: tileTop },
        { x: tx + tile - 0.8, y: tileTop },
        { x: tx + tile - 0.8, y: tileTop + tile },
        { x: tx + 0.8, y: tileTop + tile },
      ];
      g.fillStyle(k === 0 ? SANDSTONE : TERRACOTTA, 0.85);
      g.fillPoints(corners, true);
      handPath(g, rnd, corners, 1.3, CHARCOAL, 0.8, true);
    }
    handPath(
      g,
      rnd,
      [
        { x: x + tile / 2, y: tileTop - 4 },
        { x: x + tile / 2, y: tileTop - 10 },
        { x: x + tile * 1.5, y: tileTop - 10 },
        { x: x + tile * 1.5, y: tileTop - 4 },
      ],
      1.8,
      CHALK,
      0.95
    );
  }

  const first = r.x + r.w * 0.43;
  const moved = 4;
  const shift = bay * 0.28;
  floorStrip(g, rnd, first - 16, right, base);
  for (let i = 0; first + i * bay < right - 6; i++) {
    const x = first + i * bay;
    column(g, rnd, i === moved ? x + shift : x, base, height);
    g.fillStyle(CHALK, 0.95);
    g.fillCircle(x, base + 8, 1.5);
  }

  // The trapped state, in the bay the moved column made wider.
  const well = first + (moved - 0.5) * bay + shift / 2;
  const hump = (x: number) => level + 9 - 23 * Math.exp(-((x - well) * (x - well)) / (2 * 10.5 * 10.5));
  chalkCurve(g, rnd, well - 27, well + 27, hump);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      g.fillStyle(CHALK, 0.9 - k * 0.2);
      g.fillCircle(well + side * (31 + k * 4.5), level + 9, 1.1 - k * 0.1);
    }
  }
};

// The Polycrystalline Silica Golem's body, feet at the origin and y upward
// negative: seven grains of quartz that share their corners, so the glass
// between two grains is one seam. A head, two arms, a torso of two, two legs.
const GOLEM_CORNERS: Pt[] = [
  { x: -27, y: -57 }, // 0 torso top left
  { x: -13, y: -57 }, // 1 head base left
  { x: 5, y: -57 }, // 2 torso top, where the torso's seam starts
  { x: 14, y: -57 }, // 3 head base right
  { x: 27, y: -57 }, // 4 torso top right
  { x: -27, y: -35 }, // 5 torso left side
  { x: 27, y: -37 }, // 6 torso right side
  { x: -25, y: -23 }, // 7 torso bottom left
  { x: -6, y: -23 }, // 8 torso bottom, where the seam ends
  { x: 6, y: -23.5 }, // 9 right leg inner top
  { x: 25, y: -24 }, // 10 torso bottom right
  { x: -15, y: -70 }, // 11 head
  { x: -2, y: -77 }, // 12 head
  { x: 13, y: -74 }, // 13 head
  { x: -48, y: -53 }, // 14 left arm
  { x: -51, y: -27 }, // 15 left arm
  { x: -43, y: -18 }, // 16 left arm
  { x: 48, y: -52 }, // 17 right arm
  { x: 50, y: -29 }, // 18 right arm
  { x: 44, y: -19 }, // 19 right arm
  { x: -6, y: 0 }, // 20 left foot
  { x: -27, y: 0 }, // 21 left foot
  { x: 28, y: 0 }, // 22 right foot
  { x: 7, y: 0 }, // 23 right foot
  { x: -31, y: -20 }, // 24 left arm, inner bottom
  { x: 32, y: -21 }, // 25 right arm, inner bottom
];
// Each grain's corners and the angle its lattice is turned by. A square
// lattice comes back to itself every quarter turn, so the angles are chosen
// to differ by 22 degrees or more, modulo 90, between any two grains that
// share a side: no grain's rows line up with those across a seam.
const GOLEM_GRAINS: { corners: number[]; degrees: number }[] = [
  { corners: [1, 11, 12, 13, 3, 2], degrees: 68 },
  { corners: [0, 1, 2, 8, 7, 5], degrees: 8 },
  { corners: [2, 3, 4, 6, 10, 9, 8], degrees: 38 },
  { corners: [0, 14, 15, 16, 24, 5], degrees: 50 },
  { corners: [4, 17, 18, 19, 25, 6], degrees: 0 },
  { corners: [7, 8, 20, 21], degrees: 30 },
  { corners: [9, 10, 22, 23], degrees: 80 },
];

// The Stone Lattice's third chapter. The bays narrow: on both sides the
// columns close in, and where they are closest stands the Polycrystalline
// Silica Golem. Its body is grains of quartz, each one a small perfect
// lattice of dots, each turned at its own angle, with pale seams of glass
// between them that carry no dots. Every grain still repeats; they do not
// agree on where, so nothing can spread from one grain to the next.
const paintSilicaGolem: PlatePainter = (g, r, rnd) => {
  const right = r.x + r.w;
  const base = r.y + r.h - 11;
  const height = 66;
  const cx = r.x + r.w / 2;

  floorStrip(g, rnd, r.x, right, base);
  let x = r.x + 13;
  for (const gap of [36, 28, 22, 17, 0]) {
    column(g, rnd, x, base, height);
    column(g, rnd, r.x + right - x, base, height);
    x += gap;
  }

  const feet = base + 5;
  const corners = GOLEM_CORNERS.map((p) => ({ x: cx + p.x + jitter(rnd, 0.8), y: feet + p.y + jitter(rnd, 0.8) }));
  quartzGrains(g, rnd, corners, GOLEM_GRAINS);
};

// The corners of a block of quartz cut into `cols` by `rows` grains: a grid
// whose corners have each been pushed off their place.
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

// The lattice angles of the block's six grains, row by row, chosen like the
// golem's: any two grains that share a side differ by 30 degrees or more
// modulo 90.
const BLOCK_DEGREES = [8, 38, 68, 52, 82, 22];

// The Stone Lattice's last chapter. A block of the quartz as it stood in the
// pass: grains whose dot lattices are turned against one another, and blank
// seams of glass. Then the same block after the glass has crystallized: no
// seams, one lattice of dots from side to side, and a chalk wave crossing all
// of it at one height, a state spread over the whole. No figure stands in the
// narrow bay; past its two columns the floor breaks into the next world's
// flat dead domains, one teal and one ochre, with a single lit ledge between.
const paintOneLattice: PlatePainter = (g, r, rnd) => {
  const right = r.x + r.w;
  const mid = r.y + r.h / 2;
  const base = r.y + r.h - 11;
  const cols = 3;
  const rows = 2;
  const cw = 30;
  const ch = 28;
  const corners = grainCorners(rnd, cols, rows, cw, ch);
  const blockTop = mid - (rows * ch) / 2 - 3;
  const at = (ox: number, j: number, i: number): Pt => ({ x: ox + corners[j][i].x, y: blockTop + corners[j][i].y });

  const before = r.x + 12;
  const flat: Pt[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) flat.push(at(before, j, i));
  const grains: { corners: number[]; degrees: number }[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * (cols + 1) + i;
      grains.push({ corners: [k, k + 1, k + cols + 2, k + cols + 1], degrees: BLOCK_DEGREES[j * cols + i] });
    }
  }
  quartzGrains(g, rnd, flat, grains);

  const after = r.x + 134;
  const rim: Pt[] = [];
  for (let i = 0; i <= cols; i++) rim.push(at(after, 0, i));
  for (let j = 1; j <= rows; j++) rim.push(at(after, j, cols));
  for (let i = cols - 1; i >= 0; i--) rim.push(at(after, rows, i));
  for (let j = rows - 1; j >= 1; j--) rim.push(at(after, j, 0));
  g.fillStyle(SANDSTONE, 0.6);
  g.fillPoints(rim, true);
  dotLattice(g, rim, { x: after + 2.5, y: blockTop + 3 }, 0, 2.4);
  handPath(g, rnd, rim, 1.5, TERRACOTTA, 0.9, true);
  const waveLevel = blockTop + (rows * ch) / 2;
  chalkCurve(g, rnd, after + 4, after + cols * cw - 4, (x) => waveLevel + 7 * Math.sin((2 * Math.PI * (x - after)) / (4 * SPACING)));

  // The narrow bay of the pass, empty, on the last of the floor.
  const pass = r.x + r.w * 0.64;
  floorStrip(g, rnd, pass - 22, pass + 34, base);
  column(g, rnd, pass, base, 66);
  column(g, rnd, pass + 18, base, 66);

  // The next world: two flat domains and the ledge between them.
  const left = pass + 46;
  const top = r.y + 12;
  const floor = r.y + r.h - 10;
  const ledge: Pt[] = [
    { x: left + 44, y: top },
    { x: left + 54, y: top + 22 },
    { x: left + 40, y: top + 42 },
    { x: left + 50, y: floor },
  ];
  wash(g, rnd, [{ x: left, y: top + 3 }, ledge[0], ledge[1], ledge[2], ledge[3], { x: left + 3, y: floor - 2 }], DEAD_TEAL, 0.5);
  const ochreSide = [ledge[0], { x: right - 2, y: top + 2 }, { x: right - 4, y: floor - 3 }, ledge[3], ledge[2], ledge[1]];
  wash(g, rnd, ochreSide, YELLOW_OCHRE, 0.3);
  wash(g, rnd, ochreSide, CHARCOAL, 0.15);
  handPath(g, rnd, ledge, 2.6, CHALK, 1);
};

export const PLATES: Record<string, PlatePainter> = {
  '2-history': paintColonnade,
  '2-decoherence': paintOutOfStep,
  '2-pass': paintSilicaGolem,
  '2-release': paintOneLattice,
};
