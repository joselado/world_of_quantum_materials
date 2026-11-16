import { CHALK, RED_OCHRE, dab, handLine, handPath, jitter, wash } from './brush';
import type { G, PlatePainter, Rnd } from './brush';

// The Broken Coast: night under a green aurora, a shingle beach between a sea
// of swells and a field of checkered rock. The rock of this wall is nearly
// black, so every line is chalk or one of the coast's own pigments: the cool
// grey of its rock, the dim blue of its sea, and the green of its aurora. A
// swell carries the two signs of the spin on it, dim red where the spins lean
// one way and dim blue where they lean the other; the red is the wall's own
// red ochre.
const ROCK_GREY = 0x8a9098;
const SEA_BLUE = 0x5b7fbf;
const AURORA_GREEN = 0x5fb86a;

// The white-gold of the lanes ahead, for the one sign of them in the last
// plate.
const WHITE_GOLD = 0xe6d59a;

interface Pt {
  x: number;
  y: number;
}

// The two barbs of an arrow head at `tip`, for a stroke that runs along
// `angle`.
function barbs(g: G, rnd: Rnd, tip: Pt, angle: number, size: number, width: number, color: number, alpha: number) {
  g.lineStyle(width, color, alpha);
  for (const side of [-1, 1]) {
    const a = angle + Math.PI + side * 0.62 + jitter(rnd, 0.08);
    g.lineBetween(tip.x, tip.y, tip.x + Math.cos(a) * size, tip.y + Math.sin(a) * size);
  }
}

// A spin: a stroke standing on its foot with an arrow head at its tip.
// `lean` turns it about the foot, away from upright, positive to the right.
// The foot never moves; only the head does. A `held` spin is pulled in one
// stiff stroke with almost no wobble: it cannot turn.
function spin(g: G, rnd: Rnd, footX: number, footY: number, len: number, lean: number, color: number, alpha = 0.92, held = false) {
  const tip = {
    x: footX + Math.sin(lean) * len,
    y: footY - Math.cos(lean) * len,
  };
  if (held) {
    const bow = jitter(rnd, 0.3);
    g.lineStyle(1.6, color, alpha);
    g.strokePoints(
      [
        { x: footX, y: footY },
        { x: (footX + tip.x) / 2 + bow, y: (footY + tip.y) / 2 },
        { x: tip.x, y: tip.y },
      ],
      false
    );
  } else {
    handLine(g, rnd, footX, footY, tip.x, tip.y, 1.6, color, alpha);
  }
  barbs(g, rnd, tip, Math.atan2(tip.y - footY, tip.x - footX), Math.min(3.6, len * 0.26), 1.5, color, alpha);
}

// The pigment a spin is painted in: chalk while it stands upright, dim red
// where it leans one way and dim blue where it leans the other, the two
// signs of the transverse spin that the swells of this sea carry.
const leanColor = (lean: number) => (lean > 0.11 ? RED_OCHRE : lean < -0.11 ? SEA_BLUE : CHALK);

// A small arrow centred on (x, y): the direction of the spins in a piece of
// iron, or in a square of the rock.
function arrow(g: G, rnd: Rnd, x: number, y: number, len: number, angle: number, color: number, alpha = 0.9, width = 1.4) {
  const dx = (Math.cos(angle) * len) / 2;
  const dy = (Math.sin(angle) * len) / 2;
  handLine(g, rnd, x - dx, y - dy, x + dx, y + dy, width, color, alpha);
  barbs(g, rnd, { x: x + dx, y: y + dy }, angle, Math.min(3.2, len * 0.38), width, color, alpha);
}

// A curve y = f(x) from x1 to x2, pulled by hand.
function curve(g: G, rnd: Rnd, x1: number, x2: number, f: (x: number) => number, width: number, color: number, alpha = 0.92) {
  const pts: Pt[] = [];
  const steps = Math.max(2, Math.round((x2 - x1) / 3.5));
  for (let i = 0; i <= steps; i++) {
    const x = x1 + ((x2 - x1) * i) / steps;
    pts.push({ x, y: f(x) });
  }
  handPath(g, rnd, pts, width, color, alpha);
}

// The shingle of the beach: a line of grey pebbles.
function shingle(g: G, rnd: Rnd, x1: number, x2: number, y: number) {
  for (let x = x1; x < x2; x += 5.5) dab(g, rnd, x + jitter(rnd, 1.8), y + jitter(rnd, 1.6), 0.9 + rnd() * 0.6, ROCK_GREY, 0.6);
}

// The aurora: one thin green band, the only light this coast has. It is a
// band and not a glow.
function aurora(g: G, rnd: Rnd, x1: number, x2: number, y: number) {
  const pts: Pt[] = [];
  for (let x = x1; x <= x2; x += 6) pts.push({ x, y: y + 1.6 * Math.sin((x - x1) / 13) });
  handPath(g, rnd, pts, 2.6, AURORA_GREEN, 0.75);
}

// A piece of iron: corner points, and its domains as lists of corners. Two
// domains that share two corners share a wall.
interface Iron {
  corners: Pt[];
  domains: number[][];
}

interface Edge {
  i: number;
  j: number;
  a: Pt;
  b: Pt;
  wall: boolean;
}

function edgesOf(m: Iron): Edge[] {
  const count = new Map<string, { i: number; j: number; n: number }>();
  for (const domain of m.domains) {
    for (let k = 0; k < domain.length; k++) {
      const i = domain[k];
      const j = domain[(k + 1) % domain.length];
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      const seen = count.get(key);
      if (seen) seen.n++;
      else count.set(key, { i: Math.min(i, j), j: Math.max(i, j), n: 1 });
    }
  }
  return [...count.values()].map((e) => ({
    i: e.i,
    j: e.j,
    a: m.corners[e.i],
    b: m.corners[e.j],
    wall: e.n > 1,
  }));
}

function inside(p: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

// How near a point is to the rim of a domain, as the distance to its closest
// edge.
function rimDistance(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
    best = Math.min(best, Math.hypot(p.x - a.x - t * (b.x - a.x), p.y - a.y - t * (b.y - a.y)));
  }
  return best;
}

// Iron as it is painted here. Each domain is a thin wash of grey filled with
// small arrows that all point the way of `angles` for that domain: inside a
// domain every spin agrees. The rim is grey and the walls between domains
// are grey lines. `keepOff` leaves room for a wave that crosses the iron, and
// `rowStep` is how far apart the rows of arrows are.
// The wall named by `sliding` (its two corners) is drawn twice, a little
// apart, with short strokes between the two: a wall that has moved.
function paintIron(g: G, rnd: Rnd, m: Iron, angles: number[], keepOff?: (p: Pt) => boolean, sliding?: [number, number], rowStep = 9.5) {
  m.domains.forEach((domain, d) => {
    const poly = domain.map((i) => m.corners[i]);
    wash(g, rnd, poly, ROCK_GREY, 0.2 + (d % 3) * 0.05);
  });
  const edges = edgesOf(m);
  for (const e of edges) {
    if (e.wall) continue;
    handLine(g, rnd, e.a.x, e.a.y, e.b.x, e.b.y, 1.6, ROCK_GREY, 0.95);
  }
  for (const e of edges) {
    if (!e.wall) continue;
    handLine(g, rnd, e.a.x, e.a.y, e.b.x, e.b.y, 1.4, ROCK_GREY, 0.95);
    if (!sliding || e.i !== Math.min(...sliding) || e.j !== Math.max(...sliding)) continue;
    const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) || 1;
    const nx = (-(e.b.y - e.a.y) / len) * 6;
    const ny = ((e.b.x - e.a.x) / len) * 6;
    handLine(g, rnd, e.a.x + nx, e.a.y + ny, e.b.x + nx, e.b.y + ny, 1.4, CHALK, 0.75);
    g.lineStyle(1.4, CHALK, 0.8);
    for (const t of [0.2, 0.5, 0.8]) {
      const px = e.a.x + (e.b.x - e.a.x) * t;
      const py = e.a.y + (e.b.y - e.a.y) * t;
      g.lineBetween(px + nx * 0.2, py + ny * 0.2, px + nx * 0.8, py + ny * 0.8);
    }
  }
  // The arrows, on a grid turned to nothing in particular, each domain
  // starting from its own middle so the rows do not line up across a wall.
  m.domains.forEach((domain, d) => {
    const poly = domain.map((i) => m.corners[i]);
    const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
    const step = 10.5;
    for (let j = -6; j <= 6; j++) {
      for (let i = -6; i <= 6; i++) {
        const p = {
          x: cx + i * step + (j % 2 === 0 ? 0 : step / 2),
          y: cy + j * rowStep,
        };
        if (!inside(p, poly) || rimDistance(p, poly) < 4.6) continue;
        if (keepOff && keepOff(p)) continue;
        arrow(g, rnd, p.x + jitter(rnd, 0.5), p.y + jitter(rnd, 0.5), 7.5, angles[d] + jitter(rnd, 0.06), CHALK, 0.9, 1.4);
      }
    }
  });
}

const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;
const RIGHT = 0;
const LEFT = Math.PI;

// The Broken Coast's first chapter. On the left the sea, a ferromagnet: a
// row of spins that all point up, the choice the sea made long ago, standing
// on flat water. Under it the same row with one spin tipped and the tilt
// running down the coast: each spin leans a little more than the last, then
// back, then the other way, red where it leans one way and blue where it
// leans the other, and the water under their feet rises and falls with them.
// The height of the tilt does not change along the row. That wave is a
// magnon, and every swell is one. On the right, past the shingle, the rock:
// squares of two greys, every square pointing against its four neighbours,
// an antiferromagnet. Half way across, the pattern slips by one square, two
// like squares meet, and the rock is broken along that wall. Over all of it
// the aurora.
const paintSeaAndRock: PlatePainter = (g, r, rnd) => {
  const top = r.y;
  const bottom = r.y + r.h;
  const seaLeft = r.x + 6;
  const count = 18;
  const step = 14.6;
  const len = 15;
  const first = seaLeft + 9;
  const seaRight = first + (count - 1) * step + 9;

  aurora(g, rnd, r.x + 8, r.x + r.w - 8, top + 4);

  wash(
    g,
    rnd,
    [
      { x: seaLeft, y: top + 14 },
      { x: seaRight, y: top + 14 },
      { x: seaRight, y: bottom - 1 },
      { x: seaLeft, y: bottom - 1 },
    ],
    SEA_BLUE,
    0.13
  );

  // The ordered sea.
  const stillFoot = top + 38;
  for (let i = 0; i < count; i++) spin(g, rnd, first + i * step, stillFoot, len, 0, CHALK);
  handLine(g, rnd, seaLeft + 3, stillFoot + 5, seaRight - 3, stillFoot + 5, 1.5, SEA_BLUE, 0.9);

  // The magnon. The first spins still stand; from there the tilt runs on,
  // twelve spins to a wavelength.
  const waveFoot = top + 70;
  const phase = (x: number) => (Math.max(0, x - first - 2 * step) / (12 * step)) * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const x = first + i * step;
    const lean = 0.62 * Math.sin(phase(x));
    spin(g, rnd, x, waveFoot, len, lean, leanColor(lean));
  }
  // The water stands highest where the spins are upright between a lean to
  // the left and a lean to the right, so every spin stands square on it.
  curve(g, rnd, seaLeft + 3, seaRight - 3, (x) => waveFoot + 9 - 4.2 * Math.cos(phase(x)), 1.5, SEA_BLUE, 0.9);

  // The beach.
  for (const y of [top + 30, top + 46, top + 62, top + 78]) shingle(g, rnd, seaRight + 6, seaRight + 20, y);

  // The rock. One rule gives both the grey of a square and the way it
  // points, so the two can never disagree; past the wall the rule is shifted
  // by one square.
  const cols = 6;
  const rows = 5;
  const cell = 14;
  const wallAfter = 3;
  const wallGap = 4.5;
  const rockLeft = seaRight + 28;
  const rockTop = top + 14;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const light = (col + row + (col >= wallAfter ? 1 : 0)) % 2 === 0;
      const x = rockLeft + col * cell + (col >= wallAfter ? wallGap : 0);
      const y = rockTop + row * cell;
      const square = [
        { x: x + 0.7 + jitter(rnd, 0.6), y: y + 0.7 + jitter(rnd, 0.6) },
        { x: x + cell - 0.7 + jitter(rnd, 0.6), y: y + 0.7 + jitter(rnd, 0.6) },
        {
          x: x + cell - 0.7 + jitter(rnd, 0.6),
          y: y + cell - 0.7 + jitter(rnd, 0.6),
        },
        { x: x + 0.7 + jitter(rnd, 0.6), y: y + cell - 0.7 + jitter(rnd, 0.6) },
      ];
      g.fillStyle(ROCK_GREY, light ? 0.62 : 0.2);
      g.fillPoints(square, true);
      arrow(g, rnd, x + cell / 2, y + cell / 2, 8.5, light ? UP : DOWN, CHALK, 0.95, 1.5);
    }
  }
};

// The second chapter, the same row of spins before and after. On the left
// the longest wave: from one spin to the next the lean changes only a
// little, so the row is almost one whole turn of every spin together, which
// costs nothing, and the water under it is one long, low rise. On the right
// the Decoherence has pinned the direction. The order is untouched: every
// spin still points up, as the sea chose. But each one is now held at its
// tip by a stone, turning costs something, and the water is flat.
const paintPinnedSea: PlatePainter = (g, r, rnd) => {
  const foot = r.y + r.h / 2 + 15;
  const count = 13;
  const step = 14.6;
  const len = 27;
  const span = (count - 1) * step;

  const freeLeft = r.x + 18;
  for (let i = 0; i < count; i++) {
    const lean = -0.46 * Math.cos((i / (count - 1)) * Math.PI);
    spin(g, rnd, freeLeft + i * step, foot, len, lean, leanColor(lean));
  }
  curve(g, rnd, freeLeft - 8, freeLeft + span + 8, (x) => foot + 13 - 7 * Math.sin(((x - freeLeft) / span) * Math.PI), 1.6, SEA_BLUE, 0.9);

  const heldLeft = r.x + r.w - 14 - span;
  for (let i = 0; i < count; i++) {
    const x = heldLeft + i * step;
    spin(g, rnd, x, foot, len, 0, CHALK, 0.92, true);
    // The stone that sits on its head and holds it.
    const y = foot - len - 3;
    const stone = [
      { x: x - 4.6 + jitter(rnd, 0.5), y: y - 3.2 + jitter(rnd, 0.4) },
      { x: x + 0.4 + jitter(rnd, 0.5), y: y - 4 + jitter(rnd, 0.4) },
      { x: x + 4.8 + jitter(rnd, 0.5), y: y - 2.6 + jitter(rnd, 0.4) },
      { x: x + 4.4 + jitter(rnd, 0.5), y: y + 2.6 + jitter(rnd, 0.4) },
      { x: x - 4.4 + jitter(rnd, 0.5), y: y + 2.8 + jitter(rnd, 0.4) },
    ];
    g.fillStyle(ROCK_GREY, 1);
    g.fillPoints(stone, true);
  }
  handLine(g, rnd, heldLeft - 8, foot + 8, heldLeft + span + 8, foot + 8, 1.6, SEA_BLUE, 0.9);
};

// The Polycrystalline Iron Golem's body, feet at the origin and up negative:
// eight domains that share their corners, so every wall between two domains
// is one line. A head, a chest of three side by side, two arms and two legs.
// The walls of the chest stand upright, so a wave that comes in from the side
// has to cross them one after another.
const GOLEM_CORNERS: [number, number][] = [
  [-28, -56], // 0 chest top left
  [-9, -57], // 1 head base left
  [10, -57], // 2 head base right
  [28, -57], // 3 chest top right
  [-29, -37], // 4 chest left side, where the arm ends
  [29, -39], // 5 chest right side, where the arm ends
  [-27, -19], // 6 chest bottom left
  [-8, -18], // 7 left leg inner top
  [7, -19], // 8 right leg inner top
  [27, -20], // 9 chest bottom right
  [-11, -69], // 10 head
  [-2, -75], // 11 head
  [9, -72], // 12 head
  [-45, -53], // 13 left arm
  [-49, -28], // 14 left arm
  [-36, -18], // 15 left arm
  [45, -54], // 16 right arm
  [50, -31], // 17 right arm
  [37, -20], // 18 right arm
  [-7, 0], // 19 left foot
  [-28, 0], // 20 left foot
  [29, 0], // 21 right foot
  [8, 0], // 22 right foot
];
const GOLEM_DOMAINS = [
  [1, 10, 11, 12, 2],
  [0, 1, 7, 6, 4],
  [1, 2, 8, 7],
  [2, 3, 5, 9, 8],
  [0, 13, 14, 15, 4],
  [3, 16, 17, 18, 5],
  [6, 7, 19, 20],
  [8, 9, 21, 22],
];
// The way each domain points. No two that share a wall agree.
const GOLEM_ANGLES = [RIGHT, UP, DOWN, RIGHT, LEFT, UP, RIGHT, LEFT];

// A standing stone of the pass, of the coast's grey rock.
function rockStone(g: G, rnd: Rnd, x: number, base: number, height: number, w: number) {
  const pts = [
    { x: x - w / 2, y: base },
    { x: x - w / 2 + 1.5, y: base - height * 0.8 },
    { x: x + 0.5, y: base - height },
    { x: x + w / 2, y: base - height * 0.72 },
    { x: x + w / 2 + 0.5, y: base },
  ];
  wash(g, rnd, pts, ROCK_GREY, 0.4);
  handPath(g, rnd, pts, 1.5, ROCK_GREY, 0.95, true);
}

// The third chapter: the Polycrystalline Iron Golem risen off the beach,
// between the two stones of its pass. Its body is cut into domains. Inside a
// domain every arrow agrees, and no two neighbouring domains agree with each
// other. The walls between them are lines, and one is drawn twice: push the
// golem and the walls slide. A swell comes in from the sea at full height,
// enters the body, and loses height with every wall until nothing is left of
// it: nothing started here finishes. Nothing comes out of its back.
const paintIronGolem: PlatePainter = (g, r, rnd) => {
  const cx = r.x + r.w * 0.64;
  const beach = r.y + r.h - 6;
  const stretch = 1.2;
  const bodyLeft = cx - 48 * stretch;
  const waveY = beach - 39;

  // The sea the swell comes in over, and the beach.
  wash(
    g,
    rnd,
    [
      { x: r.x + 6, y: waveY - 13 },
      { x: cx - 100, y: waveY - 13 },
      { x: cx - 100, y: waveY + 15 },
      { x: r.x + 6, y: waveY + 15 },
    ],
    SEA_BLUE,
    0.13
  );
  shingle(g, rnd, r.x + 10, r.x + r.w - 10, beach + 2);
  rockStone(g, rnd, cx - 84, beach + 1, 30, 13);
  rockStone(g, rnd, cx + 86, beach + 1, 28, 13);

  // The swell: even over the sea, dying inside the iron.
  const height = (x: number) => (x < bodyLeft ? 6 : 6 * Math.exp(-(x - bodyLeft) / 27));
  const waveEnd = bodyLeft + 60;
  const wave = (x: number) => waveY + height(x) * Math.sin(((x - bodyLeft) / 25) * Math.PI * 2);

  paintIron(
    g,
    rnd,
    {
      corners: GOLEM_CORNERS.map(([x, y]) => ({
        x: cx + x * stretch,
        y: beach + y,
      })),
      domains: GOLEM_DOMAINS,
    },
    GOLEM_ANGLES,
    (p) => p.x < waveEnd && Math.abs(p.y - waveY) < height(p.x) + 5,
    [2, 8]
  );
  curve(g, rnd, r.x + 8, waveEnd, wave, 1.8, SEA_BLUE, 0.98);
};

// A block of iron lying on the beach, as corner points around (x, y), its
// top-left: ten corners on the rim and two inside.
function blockCorners(x: number, y: number): Pt[] {
  const local: [number, number][] = [
    [0, 2],
    [32, 0],
    [70, 1],
    [104, 0],
    [105, 22],
    [103, 48],
    [64, 47],
    [28, 48],
    [1, 46],
    [-1, 25],
    [38, 21],
    [66, 27],
  ];
  return local.map(([lx, ly]) => ({ x: x + lx, y: y + ly }));
}
const BLOCK_RIM = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const BLOCK_DOMAINS = [
  [0, 1, 10, 9],
  [1, 2, 11, 10],
  [2, 3, 4, 11],
  [9, 10, 7, 8],
  [10, 11, 6, 7],
  [11, 4, 5, 6],
];
const BLOCK_ANGLES = [UP, LEFT, DOWN, RIGHT, UP, LEFT];

// The fourth chapter. On the left the iron as it was, cut into domains that
// point every way. In the middle the same block after grain has grown into
// grain: no wall is left, every arrow points the same way, and it is one
// magnet. A wave enters it, crosses it without losing any height, and runs
// out along the coast. No figure stands anywhere. On the right, ahead, the
// next world hangs in the black with no ground under it: lanes joined by
// rungs, in white-gold.
const paintOneMagnet: PlatePainter = (g, r, rnd) => {
  const top = r.y + 17;
  const beach = top + 53;

  shingle(g, rnd, r.x + 6, r.x + 292, beach);

  paintIron(g, rnd, { corners: blockCorners(r.x + 10, top), domains: BLOCK_DOMAINS }, BLOCK_ANGLES);

  const whole = blockCorners(r.x + 150, top);
  const waveY = top + 24;
  paintIron(g, rnd, { corners: whole, domains: [BLOCK_RIM] }, [UP], (p) => Math.abs(p.y - waveY) < 8, undefined, 14.5);
  curve(g, rnd, r.x + 128, r.x + 296, (x) => waveY + 6 * Math.sin(((x - r.x - 128) / 25) * Math.PI * 2), 1.8, SEA_BLUE, 0.98);

  // The lanes ahead: three of them, and the rungs between.
  const laneLeft = r.x + 330;
  const laneRight = r.x + r.w - 10;
  const laneTop = r.y + 26;
  const gap = 15;
  for (let k = 0; k < 3; k++) {
    handLine(g, rnd, laneLeft + k * 3, laneTop + k * gap, laneRight - (2 - k) * 3, laneTop + k * gap - 3, 1.7, WHITE_GOLD, 0.95);
  }
  for (let k = 0; k < 2; k++) {
    for (let x = laneLeft + 12 + k * 9; x < laneRight - 8; x += 19) {
      const slope = -3 / (laneRight - laneLeft);
      const y = laneTop + k * gap + (x - laneLeft) * slope;
      handLine(g, rnd, x, y, x + jitter(rnd, 0.8), y + gap, 1.5, WHITE_GOLD, 0.9);
    }
  }
};

export const PLATES: Record<string, PlatePainter> = {
  '6-history': paintSeaAndRock,
  '6-decoherence': paintPinnedSea,
  '6-pass': paintIronGolem,
  '6-release': paintOneMagnet,
};
