import { CHARCOAL, CHALK, YELLOW_OCHRE, dab, handLine, handPath, jitter, lozenge, wash } from './brush';
import type { G, PlatePainter, Rnd } from './brush';

// The Entangled Web: no sky and no ground, only lanes with rungs hung in
// nothing, so its plates paint no horizon and leave the rock bare around the
// network. Its own earths are the white-gold of the filaments and the pale
// green of the mineral its golem is made of. The three bog earths are only
// for the look ahead to the Screened Swamp.
const WHITE_GOLD = 0xe6d59a;
const MINERAL_GREEN = 0x8fb89a;
const BOG_MIST = 0xb9c4a0;
const BOG_REED = 0x6b7446;
const BOG_WATER = 0x1f2d29;

interface P {
  x: number;
  y: number;
}

// A spin: a stem with a barbed head at the end it points to.
function spin(g: G, rnd: Rnd, x: number, y: number, len: number, up: boolean, color: number, alpha = 0.9) {
  const half = len / 2;
  const lean = jitter(rnd, 0.8);
  handLine(g, rnd, x + lean, y - half, x - lean, y + half, 1.5, color, alpha);
  const ex = up ? x + lean : x - lean;
  const ey = up ? y - half : y + half;
  const s = up ? 1 : -1;
  g.lineStyle(1.4, color, alpha);
  g.lineBetween(ex, ey, ex - 2.9, ey + s * 2.9);
  g.lineBetween(ex, ey, ex + 2.9, ey + s * 2.9);
}

// The network: lanes side by side, one for every site, a site dot at regular
// steps along each, and rungs that join a lane to the next one. A rung stands
// at every `every`-th step, shifted by one step from each pair of lanes to
// the pair below, so the whole is a ladder and not a grid.
interface Net {
  x0: number;
  ys: number[];
  step: number;
  sites: number;
  lead: number;
  every: number;
}

const netX = (n: Net, i: number) => n.x0 + n.lead + i * n.step;
const netEnd = (n: Net) => n.x0 + 2 * n.lead + (n.sites - 1) * n.step;
const hasRung = (n: Net, lane: number, i: number) => lane < n.ys.length - 1 && (i + lane) % n.every === 0;

function lanes(g: G, rnd: Rnd, n: Net, width: number, color: number, alpha: number) {
  for (const y of n.ys) handLine(g, rnd, n.x0, y, netEnd(n), y, width, color, alpha);
}

function siteDots(g: G, rnd: Rnd, n: Net, radius: number, color: number, alpha: number) {
  for (const y of n.ys) {
    for (let i = 0; i < n.sites; i++) dab(g, rnd, netX(n, i), y, radius, color, alpha);
  }
}

function rung(g: G, rnd: Rnd, n: Net, lane: number, i: number, width: number, color: number, alpha: number) {
  handLine(g, rnd, netX(n, i), n.ys[lane], netX(n, i) + jitter(rnd, 0.6), n.ys[lane + 1], width, color, alpha);
}

// The whole network in one weight, as the world is built.
function network(g: G, rnd: Rnd, n: Net, alpha = 0.9) {
  for (let lane = 0; lane < n.ys.length - 1; lane++) {
    for (let i = 0; i < n.sites; i++) {
      if (hasRung(n, lane, i)) rung(g, rnd, n, lane, i, 1.5, WHITE_GOLD, alpha * 0.9);
    }
  }
  lanes(g, rnd, n, 1.7, WHITE_GOLD, alpha);
  siteDots(g, rnd, n, 1.9, WHITE_GOLD, Math.min(1, alpha + 0.1));
}

// The Entangled Web's first chapter. Left, the attempt to write the coast
// down: a column of spins, and beside each one the numbers the record needs
// once that spin is added, as a row of dots. One dot before any spin, and
// every spin doubles the row, so five spins already need thirty-two and the
// last row runs off. Right, the world built instead: lanes, one for every
// site, and the rungs between neighbors. The bracket around three dots is
// the tiny corner of that space the real states use, in the pigment of the
// network that is built from it.
const paintRecord: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const spinX = r.x + 9;
  const dotX = r.x + 23;
  const gap = 4.3;
  const pitch = 14;
  const top = r.y + 7;
  for (let row = 0; row < 6; row++) {
    const y = top + row * pitch;
    if (row > 0) spin(g, rnd, spinX, y, 10, rnd() < 0.5, CHALK);
    const count = 2 ** row;
    for (let d = 0; d < count; d++) {
      const fade = row === 5 ? Math.max(0.14, Math.min(1, (count - d) / 16)) : 1;
      g.fillStyle(CHALK, 0.88 * fade);
      g.fillCircle(dotX + d * gap + jitter(rnd, 0.4), y + jitter(rnd, 0.5), 1.35);
    }
  }

  const n: Net = {
    x0: r.x + 196,
    ys: [-2, -1, 0, 1, 2].map((k) => mid + k * 16),
    step: 20,
    sites: 11,
    lead: 8,
    every: 2,
  };
  network(g, rnd, n);

  // The corner: the last three dots of the sixteen, bracketed, and a few
  // dashes leading from the bracket to the network.
  const cornerX = dotX + 15 * gap + 4;
  const cornerY = top + 4 * pitch;
  const cornerBack = dotX + 12.5 * gap;
  handPath(
    g,
    rnd,
    [
      { x: cornerBack, y: cornerY - 4.6 },
      { x: cornerX, y: cornerY - 4.6 },
      { x: cornerX, y: cornerY + 4.6 },
      { x: cornerBack, y: cornerY + 4.6 },
    ],
    1.5,
    WHITE_GOLD,
    0.95
  );
  const toX = n.x0 - 6;
  const toY = n.ys[3];
  for (let k = 0; k < 6; k++) {
    const t0 = 0.1 + k * 0.155;
    const t1 = t0 + 0.085;
    const fromX = cornerX + 2;
    handLine(g, rnd, fromX + (toX - fromX) * t0, cornerY + (toY - cornerY) * t0, fromX + (toX - fromX) * t1, cornerY + (toY - cornerY) * t1, 1.4, WHITE_GOLD, 0.6);
  }
};

// The cut both halves of the second chapter share: a closed dashed outline
// around the three middle lanes of a network of five. Lanes are sites, so the
// outline passes between lanes and around their ends, and the only bonds it
// crosses are the rungs to the lane above and to the lane below.
function cutNet(x0: number, mid: number): Net {
  return { x0, ys: [-2, -1, 0, 1, 2].map((k) => mid + k * 15), step: 22, sites: 7, lead: 9, every: 3 };
}

const crossesCut = (lane: number) => lane === 0 || lane === 3;

function cutOutline(g: G, rnd: Rnd, n: Net) {
  const left = n.x0 - 6;
  const right = netEnd(n) + 6;
  const top = (n.ys[0] + n.ys[1]) / 2;
  const bottom = (n.ys[3] + n.ys[4]) / 2;
  const round = 7;
  const loop: P[] = [];
  const arc = (cx: number, cy: number, from: number) => {
    for (let k = 1; k <= 4; k++) {
      const a = from + (k / 5) * (Math.PI / 2);
      loop.push({ x: cx + Math.cos(a) * round, y: cy + Math.sin(a) * round });
    }
  };
  for (let x = left + round; x <= right - round; x += 2.2) loop.push({ x, y: top });
  arc(right - round, top + round, -Math.PI / 2);
  for (let y = top + round; y <= bottom - round; y += 2.2) loop.push({ x: right, y });
  arc(right - round, bottom - round, 0);
  for (let x = right - round; x >= left + round; x -= 2.2) loop.push({ x, y: bottom });
  arc(left + round, bottom - round, Math.PI / 2);
  for (let y = bottom - round; y >= top + round; y -= 2.2) loop.push({ x: left, y });
  arc(left + round, top + round, Math.PI);
  for (let k = 0; k + 3 < loop.length; k += 5) handPath(g, rnd, loop.slice(k, k + 4), 1.4, CHALK, 0.85);
}

// The Entangled Web's second chapter: the area law, and its loss. Left, a
// region cut out of the network. The inside is calm and so is the outside,
// and the only bright bonds are the six rungs the outline crosses: what the
// region shares with the rest lives on its boundary. Right, the same cut
// after the Decoherence has worked on the middles. Every one of the
// twenty-one sites inside now sends a link of its own out across the outline,
// so what is shared grows with the region. The six rungs are drawn as thick
// as a rung can be, and they are still six.
const paintAreaLaw: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const calm = (n: Net) => {
    lanes(g, rnd, n, 1.4, YELLOW_OCHRE, 0.5);
    for (let lane = 1; lane < 3; lane++) {
      for (let i = 0; i < n.sites; i++) {
        if (hasRung(n, lane, i)) rung(g, rnd, n, lane, i, 1.3, YELLOW_OCHRE, 0.5);
      }
    }
    siteDots(g, rnd, n, 1.6, YELLOW_OCHRE, 0.75);
  };
  const crossing = (n: Net, width: number) => {
    for (let lane = 0; lane < 4; lane++) {
      if (!crossesCut(lane)) continue;
      for (let i = 0; i < n.sites; i++) {
        if (hasRung(n, lane, i)) rung(g, rnd, n, lane, i, width, WHITE_GOLD, 1);
      }
    }
  };

  const before = cutNet(r.x + 14, mid);
  calm(before);
  crossing(before, 2.2);
  cutOutline(g, rnd, before);

  const after = cutNet(r.x + 256, mid);
  calm(after);
  // One link from every site inside, to a site outside: the two lanes next
  // to the outline reach the lane across it, the middle lane reaches over
  // its neighbor to either side in turn. The links of a lane lean the same
  // way, so the region fills with them like hatching.
  for (let lane = 1; lane <= 3; lane++) {
    for (let i = 0; i < after.sites; i++) {
      const target = lane === 1 ? 0 : lane === 3 ? 4 : i % 2 === 0 ? 0 : 4;
      const lean = lane === 2 ? -1 : 1;
      const to = i + lean >= 0 && i + lean < after.sites ? i + lean : i - lean;
      handLine(g, rnd, netX(after, i), after.ys[lane], netX(after, to), after.ys[target], 1.4, CHALK, 0.85);
    }
  }
  for (let lane = 1; lane <= 3; lane++) {
    for (let i = 0; i < after.sites; i++) dab(g, rnd, netX(after, i), after.ys[lane], 1.7, CHALK, 0.95);
  }
  crossing(after, 3.6);
  cutOutline(g, rnd, after);
};

// A kagome lattice: triangles joined at their corners, with a hexagonal hole
// between every six of them. It is three families of straight lines, each
// family two triangle heights apart and turned by a third of a half turn
// from the next; where three lines would meet they do not, and that is the
// hole. Every crossing is a site and has four neighbors, two along each of
// its two lines. A grain is where the lattice sits and how far it is turned.
// The lattice is drawn only where `inside` allows, so the edge of a piece
// cuts through triangles and hexagons wherever it happens to run. Triangles
// that lie whole inside are washed; the lines are drawn up to the edge.
interface Grain {
  x: number;
  y: number;
  turn: number;
}

type Inside = (x: number, y: number) => boolean;

function kagome(g: G, rnd: Rnd, a: number, grain: Grain, reach: number, inside: Inside) {
  const h = (a * Math.sqrt(3)) / 2;
  const cos = Math.cos(grain.turn);
  const sin = Math.sin(grain.turn);
  const at = (u: number, v: number): P => ({ x: grain.x + u * cos - v * sin, y: grain.y + u * sin + v * cos });
  const count = Math.ceil(reach / a) + 2;

  g.fillStyle(MINERAL_GREEN, 0.4);
  for (let n2 = -count; n2 <= count; n2++) {
    for (let n1 = -count; n1 <= count; n1++) {
      const u = n1 * 2 * a + n2 * a;
      const v = n2 * 2 * h;
      if (Math.hypot(u, v) > reach + 2 * a) continue;
      const pair = [
        [at(u, v), at(u + a, v), at(u + a / 2, v + h)],
        [at(u + a, v), at(u + 2 * a, v), at(u + 1.5 * a, v - h)],
      ];
      for (const [p, q, t] of pair) {
        if (inside(p.x, p.y) && inside(q.x, q.y) && inside(t.x, t.y)) g.fillTriangle(p.x, p.y, q.x, q.y, t.x, t.y);
      }
    }
  }

  // The three families: along the rows of sites, and along the two slopes.
  const families = [
    { du: 1, dv: 0, u0: 0, v0: 0, su: 0, sv: 2 * h },
    { du: 0.5, dv: Math.sqrt(3) / 2, u0: 0, v0: 0, su: 2 * a, sv: 0 },
    { du: -0.5, dv: Math.sqrt(3) / 2, u0: a, v0: 0, su: 2 * a, sv: 0 },
  ];
  for (const f of families) {
    for (let n = -count; n <= count; n++) {
      let from: P | undefined;
      let to: P | undefined;
      const stroke = () => {
        if (from && to && Math.hypot(to.x - from.x, to.y - from.y) >= 2.5) handLine(g, rnd, from.x, from.y, to.x, to.y, 1.3, MINERAL_GREEN, 0.95);
        from = undefined;
        to = undefined;
      };
      for (let t = -reach; t <= reach; t += 0.75) {
        const p = at(f.u0 + n * f.su + f.du * t, f.v0 + n * f.sv + f.dv * t);
        if (inside(p.x, p.y)) {
          from = from ?? p;
          to = p;
        } else {
          stroke();
        }
      }
      stroke();
    }
  }
}

// A fracture line through the mineral: a jagged run of points, either from
// top to bottom (`upright`) or from side to side, carried on past both ends.
interface Fracture {
  upright: boolean;
  pts: P[];
}

// How far a point lies to the far side of a fracture, negative on the near
// side.
function fractureOffset(f: Fracture, x: number, y: number): number {
  const along = f.upright ? y : x;
  const across = f.upright ? x : y;
  const u = (p: P) => (f.upright ? p.y : p.x);
  const v = (p: P) => (f.upright ? p.x : p.y);
  let line = v(f.pts[0]);
  for (let k = 0; k + 1 < f.pts.length; k++) {
    const p = f.pts[k];
    const q = f.pts[k + 1];
    if (along >= u(p)) line = along >= u(q) ? v(q) : v(p) + ((v(q) - v(p)) * (along - u(p))) / (u(q) - u(p));
  }
  return across - line;
}

// The piece a point belongs to, named by the side of every fracture it lies
// on, or -1 in the open seam of a fracture.
function pieceAt(fractures: Fracture[], seam: number, x: number, y: number): number {
  let piece = 0;
  for (let k = 0; k < fractures.length; k++) {
    const off = fractureOffset(fractures[k], x, y);
    if (Math.abs(off) < seam / 2) return -1;
    if (off > 0) piece |= 1 << k;
  }
  return piece;
}

function inOutline(outline: P[], x: number, y: number): boolean {
  let within = false;
  for (let k = 0, j = outline.length - 1; k < outline.length; j = k++) {
    const p = outline[k];
    const q = outline[j];
    if (p.y > y !== q.y > y && x < p.x + ((q.x - p.x) * (y - p.y)) / (q.y - p.y)) within = !within;
  }
  return within;
}

// A fracture as it shows on the body: the jagged line itself, in charcoal
// for the shadow of the seam, wherever it runs through the body.
function fractureShadow(g: G, rnd: Rnd, f: Fracture, inside: Inside) {
  let run: P[] = [];
  const end = () => {
    if (run.length > 1) handPath(g, rnd, run, 1.8, CHARCOAL, 0.95);
    run = [];
  };
  for (let k = 0; k + 1 < f.pts.length; k++) {
    const p = f.pts[k];
    const q = f.pts[k + 1];
    const steps = Math.max(1, Math.round(Math.hypot(q.x - p.x, q.y - p.y) / 3));
    for (let s = 0; s <= steps; s++) {
      const at = { x: p.x + ((q.x - p.x) * s) / steps, y: p.y + ((q.y - p.y) * s) / steps };
      if (inside(at.x, at.y)) run.push(at);
      else end();
    }
  }
  end();
}

// A body of the mineral: an outline, the kagome lattice inside it, and the
// fractures across it. The fractures cut the body into pieces. Each piece is
// a grain of its own, its lattice set and turned a little differently from
// its neighbors', so no line runs on across a seam; with no fracture the
// body is one grain and every line runs from edge to edge. Nothing else is
// painted inside a piece. The outline is drawn last, in the green.
function mineralBody(g: G, rnd: Rnd, a: number, outline: P[], fractures: Fracture[], seam: number, turn: number) {
  const within: Inside = (x, y) => inOutline(outline, x, y);
  const boxes = new Map<number, { x0: number; y0: number; x1: number; y1: number }>();
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += 2) {
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 2) {
      if (!within(x, y)) continue;
      const piece = pieceAt(fractures, seam, x, y);
      if (piece < 0) continue;
      const box = boxes.get(piece);
      if (!box) boxes.set(piece, { x0: x, y0: y, x1: x, y1: y });
      else {
        box.x0 = Math.min(box.x0, x);
        box.y0 = Math.min(box.y0, y);
        box.x1 = Math.max(box.x1, x);
        box.y1 = Math.max(box.y1, y);
      }
    }
  }
  for (const [piece, box] of boxes) {
    const grain = {
      x: (box.x0 + box.x1) / 2 + jitter(rnd, a),
      y: (box.y0 + box.y1) / 2 + jitter(rnd, a),
      turn: fractures.length ? jitter(rnd, turn) : 0,
    };
    const reach = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) / 2 + 2 * a;
    kagome(g, rnd, a, grain, reach, (x, y) => within(x, y) && pieceAt(fractures, seam, x, y) === piece);
  }
  for (const f of fractures) fractureShadow(g, rnd, f, within);

  const edge: P[] = [];
  for (let k = 0; k < outline.length; k++) {
    const p = outline[k];
    const q = outline[(k + 1) % outline.length];
    const steps = Math.max(1, Math.round(Math.hypot(q.x - p.x, q.y - p.y) / 7));
    for (let s = 0; s < steps; s++) edge.push({ x: p.x + ((q.x - p.x) * s) / steps, y: p.y + ((q.y - p.y) * s) / steps });
  }
  handPath(g, rnd, edge, 1.7, MINERAL_GREEN, 0.95, true);
}

const MINERAL_A = 5;

// The Entangled Web's pass: the Polycrystalline Herbertsmithite Golem,
// standing across every lane. Its outline is a blocky figure, a head, both
// arms held out with the forearms hanging, a trunk and two legs, and its
// inside is the kagome lattice of the mineral, broken by fracture lines into
// grains. Every grain is blank: a spin liquid keeps no arrow on any site,
// and what the golem was lived in no one piece, so there is nothing inside a
// piece to paint. The traveler stands on the lanes before it.
const paintHerbertsmithiteGolem: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const cx = r.x + 262;
  const ys = [-2, -1, 0, 1, 2].map((k) => mid + k * 16);
  network(g, rnd, { x0: r.x + 4, ys, step: 20, sites: 10, lead: 8, every: 2 });
  network(g, rnd, { x0: cx + 64, ys, step: 20, sites: 5, lead: 7, every: 2 }, 0.7);

  const at = (x: number, y: number): P => ({ x: cx + x, y: mid + y });
  const outline = [
    at(-11, -40),
    at(10, -41),
    at(12, -27),
    at(55, -28),
    at(57, 9),
    at(42, 10),
    at(41, -7),
    at(25, -6),
    at(24, 40),
    at(5, 40),
    at(4, 17),
    at(-4, 17),
    at(-5, 40),
    at(-25, 40),
    at(-24, -6),
    at(-41, -7),
    at(-43, 10),
    at(-57, 9),
    at(-56, -27),
    at(-12, -27),
  ];
  const fractures: Fracture[] = [
    { upright: true, pts: [at(15, -45), at(9, -27), at(2, -17), at(7, -6), at(-3, 4), at(3, 12), at(0, 45)] },
    { upright: true, pts: [at(-36, -45), at(-30, -20), at(-37, -12), at(-33, 45)] },
    { upright: true, pts: [at(31, -45), at(37, -19), at(31, -10), at(34, 45)] },
    { upright: false, pts: [at(-62, -6), at(-46, -10), at(-28, -5), at(-12, -10), at(8, -5), at(26, -10), at(46, -5), at(62, -9)] },
    { upright: false, pts: [at(-62, 17), at(-15, 13), at(0, 19), at(15, 14), at(62, 18)] },
  ];
  wash(g, rnd, outline, MINERAL_GREEN, 0.08);
  mineralBody(g, rnd, MINERAL_A, outline, fractures, 2.8, 0.3);

  lozenge(g, rnd, r.x + 142, mid, 6, CHALK);
};

// A pool of the bog ahead: a plain dark oval with a pale rim, and nothing in
// its water.
function pool(g: G, rnd: Rnd, x: number, y: number, rx: number, ry: number) {
  g.fillStyle(BOG_WATER, 0.95);
  g.fillEllipse(x, y, rx * 2, ry * 2);
  const rim: P[] = [];
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    rim.push({ x: x + Math.cos(a) * rx, y: y + Math.sin(a) * ry });
  }
  handPath(g, rnd, rim, 1.3, BOG_MIST, 0.4, true);
}

// The slab of mineral the last chapter is told on: a block with its corners
// knocked off, around (x, y).
const slabOutline = (x: number, y: number): P[] => [
  { x: x - 36, y: y - 31 },
  { x: x + 34, y: y - 32 },
  { x: x + 45, y: y - 16 },
  { x: x + 46, y: y + 18 },
  { x: x + 33, y: y + 31 },
  { x: x - 35, y: y + 32 },
  { x: x - 46, y: y + 17 },
  { x: x - 45, y: y - 17 },
];

// The Entangled Web's last chapter. Left, the fractured mineral: the slab in
// grains, no line of one running on into the next. Middle, the fracture
// lines sealed: the same slab as one grain, every line of the lattice
// running from edge to edge, and one thin wash laid across all of it in a
// single stroke that overruns both ends, for the one state that no piece was
// holding and that lives on every piece at once. The right third is what
// lies past the last rung: black pools under flat mist, and reeds.
const paintMineralSealed: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const brokenX = r.x + 62;
  const wholeX = r.x + 196;

  const at = (x: number, y: number): P => ({ x: brokenX + x, y: mid + y });
  const fractures: Fracture[] = [
    { upright: true, pts: [at(-18, -36), at(-9, -18), at(-18, -4), at(-10, 10), at(-16, 36)] },
    { upright: true, pts: [at(18, -36), at(11, -12), at(20, 4), at(12, 36)] },
    { upright: false, pts: [at(-50, 3), at(-24, -4), at(-4, 5), at(14, -5), at(50, 2)] },
  ];
  mineralBody(g, rnd, MINERAL_A, slabOutline(brokenX, mid), fractures, 3.4, 0.3);

  mineralBody(g, rnd, MINERAL_A, slabOutline(wholeX, mid), [], 0, 0);
  wash(
    g,
    rnd,
    [
      { x: wholeX - 60, y: mid - 27 },
      { x: wholeX + 50, y: mid - 36 },
      { x: wholeX + 62, y: mid + 27 },
      { x: wholeX - 50, y: mid + 36 },
    ],
    YELLOW_OCHRE,
    0.14
  );

  const shore = r.x + 300;
  pool(g, rnd, shore + 30, r.y + 22, 27, 8);
  pool(g, rnd, shore + 80, r.y + 48, 31, 9);
  pool(g, rnd, shore + 34, r.y + 71, 25, 7);
  const mists: [number, number, number][] = [
    [shore + 8, r.y + 12, 52],
    [shore + 46, r.y + 36, 64],
    [shore + 4, r.y + 59, 50],
    [shore + 66, r.y + 62, 46],
    [shore + 70, r.y + 18, 40],
  ];
  for (const [x, y, len] of mists) {
    handLine(g, rnd, x, y, x + len, y + jitter(rnd, 0.6), 1.6, BOG_MIST, 0.5);
    handLine(g, rnd, x + len * 0.25, y + 3, x + len * 0.8, y + 3, 1.3, BOG_MIST, 0.3);
  }
  const reedClumps: [number, number][] = [
    [shore + 2, r.y + 36],
    [shore + 62, r.y + 82],
    [shore + 104, r.y + 34],
  ];
  for (const [x, base] of reedClumps) {
    for (let k = 0; k < 3; k++) {
      const rx = x + k * 3.4;
      const tall = 10 + jitter(rnd, 2.5);
      const lean = jitter(rnd, 1.6);
      handLine(g, rnd, rx, base, rx + lean, base - tall, 1.4, BOG_REED, 0.95);
      g.lineStyle(2.4, BOG_REED, 0.95);
      g.lineBetween(rx + lean, base - tall, rx + lean * 0.8, base - tall + 3.2);
    }
  }
};

export const PLATES: Record<string, PlatePainter> = {
  '7-history': paintRecord,
  '7-decoherence': paintAreaLaw,
  '7-pass': paintHerbertsmithiteGolem,
  '7-release': paintMineralSealed,
};
