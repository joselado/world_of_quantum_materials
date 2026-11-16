import { CHARCOAL, CHALK, RED_OCHRE, YELLOW_OCHRE, dab, handLine, handPath, handRing, jitter, lozenge, wash } from './brush';
import type { G, PlatePainter, Rnd } from './brush';

// The Defect Scars: firelight and no sun, scorched clay with the crust still
// open and glowing between the scars. Its own earths are a scorched red for
// the ground and a molten orange, which is what a state of the crystal is
// painted in on every plate here: the ripple round a hole, the pocket a state
// is shut in, the glow of a vacancy, the wave that crosses the crystal again.
// Ash is the tarnished, neutral body of a crystal with no compound of its own.
const SCORCH_RED = 0x8a2c20;
const MOLTEN_ORANGE = 0xe07a2c;
const ASH = 0x9a9488;
// The pigment of the world ahead, for the one sign of it in the release plate.
const SILVER_VIOLET = 0xb9aee0;

type Pt = { x: number; y: number };

// A loop that shuts: an ellipse drawn in one turn of the hand and joined to
// its own start. A vacancy, a pocket and a bound state are all closed things,
// which the open turn of `handRing` cannot say.
function closedLoop(g: G, rnd: Rnd, x: number, y: number, rx: number, ry: number, width: number, color: number, alpha = 0.9) {
  const steps = Math.max(8, Math.round((rx + ry) * 0.9));
  const start = rnd() * Math.PI * 2;
  const wobble = Math.min(0.6, Math.min(rx, ry) * 0.1);
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const a = start + (i / steps) * Math.PI * 2;
    pts.push({ x: x + Math.cos(a) * (rx + jitter(rnd, wobble)), y: y + Math.sin(a) * (ry + jitter(rnd, wobble)) });
  }
  const drawn = pts.map((p) => ({ x: p.x + jitter(rnd, 0.3), y: p.y + jitter(rnd, 0.3) }));
  g.lineStyle(width, color, alpha);
  g.strokePoints(drawn, true, true);
}

// An atom of a lattice: one small dab.
function atom(g: G, rnd: Rnd, x: number, y: number, color: number, alpha = 0.85, radius = 1.5) {
  dab(g, rnd, x + jitter(rnd, 0.4), y + jitter(rnd, 0.4), radius, color, alpha);
}

// The outline of a block or of a shard, corner to corner by hand.
function outline(g: G, rnd: Rnd, pts: Pt[], width: number, color: number, alpha: number) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    handLine(g, rnd, a.x, a.y, b.x, b.y, width, color, alpha);
  }
}

// How far inside a convex outline a point lies: the distance to the nearest
// edge, negative when the point is outside.
function depthInside(poly: Pt[], p: Pt): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a.x * b.y - b.x * a.y;
  }
  const turn = area >= 0 ? 1 : -1;
  let depth = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    depth = Math.min(depth, (turn * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x))) / len);
  }
  return depth;
}

// Places for holes inside a set of convex pieces, kept `edge` away from every
// outline and `apart` away from each other, so that what is drawn round one
// hole never reaches what is drawn round the next.
function scatterHoles(rnd: Rnd, pieces: Pt[][], count: number, apart: number, edge: number, taken: Pt[] = []): Pt[] {
  const xs = pieces.flat().map((p) => p.x);
  const ys = pieces.flat().map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0;
  const h = Math.max(...ys) - y0;
  const holes: Pt[] = [];
  for (let tries = 0; tries < 2500 && holes.length < count; tries++) {
    const p = { x: x0 + rnd() * w, y: y0 + rnd() * h };
    if (!pieces.some((piece) => depthInside(piece, p) >= edge)) continue;
    if ([...holes, ...taken].some((q) => Math.hypot(q.x - p.x, q.y - p.y) < apart)) continue;
    holes.push(p);
  }
  return holes;
}

// A vacancy in a body of crystal: a pit in shadow where the atom was.
function pit(g: G, rnd: Rnd, p: Pt) {
  dab(g, rnd, p.x, p.y, 1.5, CHARCOAL, 0.95);
}

// A wave drawn across a width: a state that is spread out.
function wave(g: G, rnd: Rnd, x1: number, x2: number, y: number, amplitude: number, length: number, phase: number, width: number, color: number, alpha: number) {
  const pts: Pt[] = [];
  for (let x = x1; x <= x2; x += 2.5) pts.push({ x, y: y + Math.sin(((x - x1) / length) * Math.PI * 2 + phase) * amplitude });
  const drawn = pts.map((p) => ({ x: p.x, y: p.y + jitter(rnd, 0.35) }));
  g.lineStyle(width, color, alpha);
  g.strokePoints(drawn, false);
}

// A drum of a fallen column lying on its side: a short block at an angle,
// fluted along its length.
function drum(g: G, rnd: Rnd, x: number, y: number, len: number, thick: number, angle: number) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const at = (along: number, across: number): Pt => ({ x: x + ux * along - uy * across, y: y + uy * along + ux * across });
  const corners = [at(-len / 2, -thick / 2), at(len / 2, -thick / 2), at(len / 2, thick / 2), at(-len / 2, thick / 2)];
  g.fillStyle(CHALK, 0.3);
  g.fillPoints(corners, true);
  outline(g, rnd, corners, 1.4, CHALK, 0.9);
  const a = at(-len / 2 + 1.5, 0);
  const b = at(len / 2 - 1.5, 0);
  handLine(g, rnd, a.x, a.y, b.x, b.y, 1.3, CHALK, 0.7);
}

// The Defect Scars' first chapter. Left: the ground in patches, each a scrap
// of a world behind (wheat stalks, three columns, a strip of lit ledge, swept
// ice, checkered rock) set in the scorched clay, and the drums of the one
// fallen column lying among them. Right: the lesson. A regular lattice with
// one atom taken out, the hole an empty ring, and around it the crystal's
// answer: the neighbors relax toward the vacancy, most for the nearest shell,
// and a ripple spreads from it. Everywhere else the lattice is perfect and
// says nothing.
const paintPatchedGround: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const bottom = r.y + r.h;

  // The scorched clay the patches sit in.
  wash(
    g,
    rnd,
    [
      { x: r.x + 3, y: r.y + 6 },
      { x: r.x + 198, y: r.y + 3 },
      { x: r.x + 212, y: mid + 4 },
      { x: r.x + 196, y: bottom - 2 },
      { x: r.x + 5, y: bottom - 4 },
    ],
    SCORCH_RED,
    0.3
  );
  const patch = (cx: number, cy: number, w: number, h: number, color: number, alpha: number) =>
    wash(
      g,
      rnd,
      [
        { x: cx - w / 2 + jitter(rnd, 2), y: cy - h / 2 + jitter(rnd, 2) },
        { x: cx + w / 2 + jitter(rnd, 2), y: cy - h / 2 + jitter(rnd, 2) },
        { x: cx + w / 2 + jitter(rnd, 2), y: cy + h / 2 + jitter(rnd, 2) },
        { x: cx - w / 2 + jitter(rnd, 2), y: cy + h / 2 + jitter(rnd, 2) },
      ],
      color,
      alpha
    );

  // A piece of wheat field: three stalks, each with its ear.
  const wheat = { x: r.x + 30, y: r.y + 24 };
  patch(wheat.x, wheat.y, 40, 30, YELLOW_OCHRE, 0.26);
  for (const dx of [-11, 0, 11]) {
    const x = wheat.x + dx + jitter(rnd, 1);
    const top = wheat.y - 9;
    handLine(g, rnd, x, wheat.y + 10, x + jitter(rnd, 1), top, 1.5, YELLOW_OCHRE, 0.95);
    for (const k of [0.5, 4]) {
      g.lineStyle(1.3, YELLOW_OCHRE, 0.95);
      g.lineBetween(x, top + k, x - 3.2, top + k + 3.2);
      g.lineBetween(x, top + k, x + 3.2, top + k + 3.2);
    }
  }

  // A few columns: three shafts of stacked drums, each under one wide capital.
  const hall = { x: r.x + 94, y: r.y + 22 };
  patch(hall.x, hall.y, 42, 28, ASH, 0.3);
  for (const dx of [-12, 0, 12]) {
    const x = hall.x + dx;
    g.fillStyle(CHALK, 0.92);
    for (let k = 0; k < 3; k++) g.fillRect(x - 2.4 + jitter(rnd, 0.5), hall.y - 6 + k * 5.6, 4.8, 4.4);
    g.fillRect(x - 4.6 + jitter(rnd, 0.4), hall.y - 10, 9.2, 2.6);
  }

  // A strip of lit ledge: one bright line between two dull domains.
  const ledge = { x: r.x + 160, y: r.y + 27 };
  patch(ledge.x, ledge.y - 8, 44, 13, ASH, 0.3);
  patch(ledge.x, ledge.y + 8, 44, 13, ASH, 0.16);
  handLine(g, rnd, ledge.x - 21, ledge.y + 2, ledge.x + 21, ledge.y - 2, 2.6, CHALK, 1);
  handLine(g, rnd, ledge.x - 20, ledge.y + 5, ledge.x + 20, ledge.y + 1, 1.3, YELLOW_OCHRE, 0.9);

  // Some swept ice: a pale sheet with the marks of the sweeping across it.
  const ice = { x: r.x + 40, y: r.y + 66 };
  patch(ice.x, ice.y, 46, 26, CHALK, 0.3);
  for (const dx of [-13, -2, 9]) {
    handLine(g, rnd, ice.x + dx - 4, ice.y + 7, ice.x + dx + 9, ice.y - 7, 1.3, CHALK, 0.75);
  }

  // A square of checkered rock.
  const check = { x: r.x + 104, y: r.y + 66 };
  const cell = 6.5;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const light = (row + col) % 2 === 0;
      g.fillStyle(light ? CHALK : ASH, light ? 0.8 : 0.3);
      g.fillRect(check.x + (col - 2) * cell + jitter(rnd, 0.5), check.y + (row - 1.5) * cell + jitter(rnd, 0.5), cell - 0.6, cell - 0.6);
    }
  }

  // The fallen column, the only thing ever built here: three drums on their side.
  drum(g, rnd, r.x + 152, r.y + 58, 19, 8, 0.22);
  drum(g, rnd, r.x + 178, r.y + 72, 17, 8, -0.45);
  drum(g, rnd, r.x + 146, r.y + 78, 15, 8, 0.05);

  // The lattice, perfect but for one site.
  const cols = 9;
  const rows = 5;
  const step = 17;
  const hole = { x: r.x + 322, y: mid };
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dx = (col - (cols - 1) / 2) * step;
      const dy = (row - (rows - 1) / 2) * step;
      const far = Math.hypot(dx, dy);
      if (far < 1) continue;
      // The nearest shell moves in the most, the next one less, the rest not at all.
      const pull = far < step * 1.1 ? 3.6 : far < step * 1.5 ? 2.2 : 0;
      atom(g, rnd, hole.x + dx - (dx / far) * pull, hole.y + dy - (dy / far) * pull, CHALK, 0.9, 1.7);
    }
  }
  handRing(g, rnd, hole.x, hole.y, 28, 1.5, MOLTEN_ORANGE, 0.8);
  closedLoop(g, rnd, hole.x, hole.y, 3.8, 3.8, 1.4, CHALK, 0.95);
};

// One small lattice of a host, five atoms by five in the host's own pigment,
// with the same impurity at its middle whatever the host: a dab of red ochre.
function host(g: G, rnd: Rnd, x: number, y: number, step: number, color: number, skip: (col: number, row: number) => boolean) {
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      if ((row === 0 && col === 0) || skip(col, row)) continue;
      atom(g, rnd, x + col * step, y + row * step, color, 0.8, 1.4);
    }
  }
}

function impurity(g: G, rnd: Rnd, x: number, y: number) {
  dab(g, rnd, x, y, 3, RED_OCHRE, 1);
}

// The Defect Scars' second chapter. Left: the same impurity, one dab of red
// ochre, in four hosts painted in four pigments, and four answers, each in its
// host's pigment because the answer belongs to the host: rings of charge
// spreading from it, a moment standing on it, a cloud gathered round it to
// screen it, and a single state bound to it in a closed loop. Right: the
// Decoherence brings thousands. A crystal crowded with vacancies, and every
// state of it at rest in a pocket of its own, closed, touching no other. No
// line crosses the crystal: nothing in it carries anything from one side to
// the other, which is what localization by disorder is.
const paintThousandHoles: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const step = 10;
  const at = (i: number): Pt => ({ x: r.x + 30 + i * 53, y: mid + (i % 2 === 0 ? -17 : 17) });

  // Rings spreading from it.
  let c = at(0);
  host(g, rnd, c.x, c.y, step, ASH, () => false);
  closedLoop(g, rnd, c.x, c.y, 6, 6, 1.5, ASH, 1);
  closedLoop(g, rnd, c.x, c.y, 17, 17, 1.5, ASH, 0.9);
  impurity(g, rnd, c.x, c.y);

  // A moment on it: one arrow through the site.
  c = at(1);
  host(g, rnd, c.x, c.y, step, YELLOW_OCHRE, (col, row) => col === 0 && Math.abs(row) === 1);
  handLine(g, rnd, c.x - 1.4, c.y + 13, c.x + 1.4, c.y - 13, 1.8, YELLOW_OCHRE, 1);
  g.lineStyle(1.7, YELLOW_OCHRE, 1);
  g.lineBetween(c.x + 1.4, c.y - 13.5, c.x - 3.4, c.y - 7.5);
  g.lineBetween(c.x + 1.4, c.y - 13.5, c.x + 5.4, c.y - 8.3);
  impurity(g, rnd, c.x, c.y);

  // A cloud gathered round it.
  c = at(2);
  host(g, rnd, c.x, c.y, step, CHALK, () => false);
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2 + jitter(rnd, 0.25);
    const far = 4.8 + (i % 3) * 1.6 + jitter(rnd, 0.4);
    g.fillStyle(CHALK, 0.95);
    g.fillCircle(c.x + Math.cos(a) * far, c.y + Math.sin(a) * far, 1);
  }
  impurity(g, rnd, c.x, c.y);

  // A state bound to it: one closed loop that leaves the site and comes back.
  c = at(3);
  host(g, rnd, c.x, c.y, step, MOLTEN_ORANGE, (col, row) => col === 1 && row === -1);
  const lobe: Pt[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = (i / 14) * Math.PI;
    const out = Math.sin(t) * 18;
    const side = Math.sin(t * 2) * 6.5;
    lobe.push({ x: c.x + out * 0.72 - side * 0.7, y: c.y - out * 0.7 - side * 0.72 });
  }
  handPath(g, rnd, lobe, 1.6, MOLTEN_ORANGE, 1, true);
  impurity(g, rnd, c.x, c.y);

  // The crowded crystal: a block of lattice, its sites taken one by one.
  const block = { x: r.x + 240, y: r.y + 10, w: 174, h: 66 };
  const corners = [
    { x: block.x, y: block.y },
    { x: block.x + block.w, y: block.y },
    { x: block.x + block.w, y: block.y + block.h },
    { x: block.x, y: block.y + block.h },
  ];
  outline(g, rnd, corners, 1.4, CHALK, 0.6);
  const pitch = 12;
  const cols = 14;
  const rows = 5;
  const site = (col: number, row: number): Pt => ({
    x: block.x + block.w / 2 + (col - (cols - 1) / 2) * pitch,
    y: block.y + block.h / 2 + (row - (rows - 1) / 2) * pitch,
  });
  // The pockets first: each holds one site, and no two are near enough to touch.
  const pockets: { col: number; row: number }[] = [];
  for (let tries = 0; tries < 600 && pockets.length < 16; tries++) {
    const col = Math.floor(rnd() * cols);
    const row = Math.floor(rnd() * rows);
    if (pockets.some((p) => Math.hypot(p.col - col, p.row - row) < 2.2)) continue;
    pockets.push({ col, row });
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const p = site(col, row);
      const held = pockets.some((q) => q.col === col && q.row === row);
      if (!held && rnd() < 0.56) {
        closedLoop(g, rnd, p.x, p.y, 2.5, 2.5, 1.3, CHALK, 0.8);
      } else {
        atom(g, rnd, p.x, p.y, CHALK, 0.9, 1.4);
      }
    }
  }
  for (const q of pockets) {
    const p = site(q.col, q.row);
    g.fillStyle(MOLTEN_ORANGE, 0.3);
    g.fillCircle(p.x, p.y, 5);
    closedLoop(g, rnd, p.x, p.y, 5.3 + jitter(rnd, 0.3), 5.3 + jitter(rnd, 0.3), 1.5, MOLTEN_ORANGE, 0.95);
  }
};

// The wall of open crust on one side of the pass, along the top or the bottom
// edge: scorched ground with the molten lip of the wound running along it,
// closing in toward the middle of the plate.
function scarWall(g: G, rnd: Rnd, xFar: number, xNear: number, yEdge: number, lipFar: number, lipNear: number) {
  const lip: Pt[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    lip.push({ x: xFar + (xNear - xFar) * t, y: lipFar + (lipNear - lipFar) * Math.pow(t, 1.4) + (i % 2 === 0 ? 1.4 : -1.4) });
  }
  // The wall ends in a ragged face leaning toward the middle of the pass.
  const lean = xNear > xFar ? 13 : -13;
  wash(g, rnd, [{ x: xFar, y: yEdge }, ...lip, { x: xNear + lean, y: yEdge }], SCORCH_RED, 0.2);
  handPath(g, rnd, lip, 1.6, MOLTEN_ORANGE, 0.85);
  // Cracks running from the lip back into the crust.
  for (const i of [2, 5, 8, 11]) {
    const p = lip[i];
    const back = (yEdge - p.y) * 0.55;
    handLine(g, rnd, p.x, p.y, p.x + jitter(rnd, 5), p.y + back, 1.3, MOLTEN_ORANGE, 0.5);
  }
}

// The golem of the Defect Scars, rising out of the crust where the scars
// narrow. Its compound is a different one on every visit, so its body carries
// no world's pigment: ash, a tarnished crystal of no kind. It is pocked with
// vacancies, each a pit in shadow, and each has answered its own hole where it
// was made: a ring of glow round every pit, and no ring reaches the next. That
// is the mechanism it lost. A state that stays in the pocket where it came to
// rest carries nothing across the body.
const paintScarGolem: PlatePainter = (g, r, rnd) => {
  const cx = r.x + r.w / 2;
  const top = r.y;
  const bottom = r.y + r.h;
  const base = bottom - 5;

  // The pass: the open crust closes in from both long edges on either side.
  scarWall(g, rnd, r.x + 2, cx - 58, top + 1, top + 7, top + 30);
  scarWall(g, rnd, r.x + 2, cx - 58, bottom - 1, bottom - 6, bottom - 22);
  scarWall(g, rnd, r.x + r.w - 2, cx + 58, top + 1, top + 7, top + 30);
  scarWall(g, rnd, r.x + r.w - 2, cx + 58, bottom - 1, bottom - 6, bottom - 22);

  // The body: a head, a trunk and two arms, each one angular shard, cut off at
  // the crust it is rising through.
  const head = [
    { x: cx - 9, y: base - 53 },
    { x: cx - 10, y: base - 72 },
    { x: cx + 9, y: base - 73 },
    { x: cx + 11, y: base - 54 },
  ];
  const trunk = [
    { x: cx - 21, y: base },
    { x: cx - 24, y: base - 49 },
    { x: cx + 23, y: base - 51 },
    { x: cx + 20, y: base },
  ];
  const armLeft = [
    { x: cx - 28, y: base - 48 },
    { x: cx - 42, y: base - 43 },
    { x: cx - 45, y: base - 6 },
    { x: cx - 30, y: base - 9 },
  ];
  const armRight = [
    { x: cx + 27, y: base - 50 },
    { x: cx + 42, y: base - 44 },
    { x: cx + 44, y: base - 5 },
    { x: cx + 29, y: base - 9 },
  ];
  const shards = [head, trunk, armLeft, armRight];
  for (const shard of shards) {
    g.fillStyle(ASH, 0.42);
    g.fillPoints(shard, true);
    outline(g, rnd, shard, 1.5, CHALK, 0.75);
  }

  // The crust it breaks through: plates tipped up at its foot.
  for (const dx of [-58, -47, -12, 6, 36, 52]) {
    const x = cx + dx + jitter(rnd, 2);
    handLine(g, rnd, x - 6, base + 3, x + 1, base - 3 + jitter(rnd, 1.5), 1.6, MOLTEN_ORANGE, 0.8);
    handLine(g, rnd, x + 1, base - 3, x + 7, base + 3, 1.6, SCORCH_RED, 0.95);
  }

  // The vacancies, and round each one its own glow.
  const holes = scatterHoles(rnd, shards, 34, 9.6, 5);
  for (const p of holes) {
    pit(g, rnd, p);
    closedLoop(g, rnd, p.x, p.y, 3.3, 3.3, 1.3, MOLTEN_ORANGE, 0.8);
  }
};

// A block of the crystal, with no compound of its own: an ash body and a
// chalk edge.
function crystalBlock(g: G, rnd: Rnd, x: number, y: number, w: number, h: number): Pt[] {
  const corners = [
    { x: x + jitter(rnd, 1.2), y: y + jitter(rnd, 1.2) },
    { x: x + w + jitter(rnd, 1.2), y: y + jitter(rnd, 1.2) },
    { x: x + w + jitter(rnd, 1.2), y: y + h + jitter(rnd, 1.2) },
    { x: x + jitter(rnd, 1.2), y: y + h + jitter(rnd, 1.2) },
  ];
  g.fillStyle(ASH, 0.36);
  g.fillPoints(corners, true);
  outline(g, rnd, corners, 1.5, CHALK, 0.7);
  return corners;
}

// The Defect Scars' release. Left: the crystal as the golem held it, full of
// vacancies, every state shut in a ring round its own hole. Middle: the
// vacancies have annealed out until too few are left to trap anything, and the
// states run as waves across the whole of the block, passing between the holes
// that remain. The waves are in the same pigment and no brighter than the
// rings were: the mechanism is back and no light is. No figure stands in the
// pass. Right: the world ahead, on bare rock. A small network of nodes and
// links, and under it the ground in the traveler's own shape: a world that
// forms around whoever walks into it, and watches.
const paintAnnealed: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;

  const full = crystalBlock(g, rnd, r.x + 8, mid - 29, 112, 58);
  for (const p of scatterHoles(rnd, [full], 17, 11.5, 5.5)) {
    pit(g, rnd, p);
    closedLoop(g, rnd, p.x, p.y, 3.5, 3.5, 1.3, MOLTEN_ORANGE, 0.8);
  }

  const healedX = r.x + 154;
  const healedW = 132;
  crystalBlock(g, rnd, healedX, mid - 29, healedW, 58);
  const lanes = [-19, 0, 19];
  lanes.forEach((dy, i) => wave(g, rnd, healedX + 4, healedX + healedW - 4, mid + dy, 3.4, 24, i * 2.1, 1.5, MOLTEN_ORANGE, 0.8));
  // The holes that are left sit between the waves, and no wave stops at one.
  for (const p of [
    { x: healedX + 27, y: mid - 9.5 },
    { x: healedX + 60, y: mid + 8.5 },
    { x: healedX + 108, y: mid - 9.5 },
  ]) {
    const q = { x: p.x + jitter(rnd, 1), y: p.y + jitter(rnd, 0.8) };
    dab(g, rnd, q.x, q.y, 2.1, CHARCOAL, 0.95);
    closedLoop(g, rnd, q.x, q.y, 3.1, 3.1, 1.3, CHALK, 0.65);
  }

  // Ahead: the network, and the ground under it in the traveler's shape.
  const ahead = { x: r.x + 362, y: mid };
  lozenge(g, rnd, ahead.x, ahead.y + 20, 15, SILVER_VIOLET, 0.55);
  const nodes: Pt[] = [
    { x: ahead.x - 32, y: ahead.y - 14 },
    { x: ahead.x - 14, y: ahead.y - 30 },
    { x: ahead.x - 9, y: ahead.y - 10 },
    { x: ahead.x + 9, y: ahead.y - 24 },
    { x: ahead.x + 14, y: ahead.y - 7 },
    { x: ahead.x + 33, y: ahead.y - 17 },
  ].map((p) => ({ x: p.x + jitter(rnd, 1.5), y: p.y + jitter(rnd, 1.5) }));
  const links: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 3],
    [2, 4],
    [3, 4],
    [3, 5],
    [4, 5],
  ];
  for (const [a, b] of links) handLine(g, rnd, nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, 1.3, SILVER_VIOLET, 0.6);
  for (const p of nodes) dab(g, rnd, p.x, p.y, 2, SILVER_VIOLET, 0.95);
};

export const PLATES: Record<string, PlatePainter> = {
  '9-history': paintPatchedGround,
  '9-decoherence': paintThousandHoles,
  '9-pass': paintScarGolem,
  '9-release': paintAnnealed,
};
