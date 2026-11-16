import { CHARCOAL, CHALK, RED_OCHRE, YELLOW_OCHRE, dab, handLine, handPath, handRing, jitter, wash } from './brush';
import type { G, PlatePainter, Rnd } from './brush';

// The Vortex Glacier: overcast twilight on an open sheet of ice. Its own
// earths are a pale ice-cyan for the line work and a deeper one for the ice
// itself. The rock is dark here, so no line is drawn in charcoal on it:
// charcoal is the black of the ceramic, the shadow in a pit, and the join
// across a chalk dot.
const ICE = 0xa9c8cc;
const DEEP_ICE = 0x6f9aa3;

// The two pigments of the coast ahead, for the one sign of it in the last
// plate: the green of its aurora and the dim blue of its sea.
const AURORA_GREEN = 0x5fb86a;
const SEA_BLUE = 0x5b7fbf;

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

// A short arrow centred on (x, y): the phase of a grain, or a push.
function arrow(g: G, rnd: Rnd, x: number, y: number, len: number, angle: number, color: number, alpha = 0.92, width = 1.5) {
  const dx = (Math.cos(angle) * len) / 2;
  const dy = (Math.sin(angle) * len) / 2;
  handLine(g, rnd, x - dx, y - dy, x + dx, y + dy, width, color, alpha);
  barbs(g, rnd, { x: x + dx, y: y + dy }, angle, Math.min(3.6, len * 0.36), width, color, alpha);
}

// A spin of the coast ahead, the sign world6.ts paints it with: an upright
// stroke standing on its foot, with an arrow head.
function spin(g: G, rnd: Rnd, footX: number, footY: number, len: number, color: number, alpha = 0.92) {
  handLine(g, rnd, footX, footY, footX, footY - len, 1.5, color, alpha);
  barbs(g, rnd, { x: footX, y: footY - len }, -Math.PI / 2, 3, 1.4, color, alpha);
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

// A line through `corners` with every corner rounded off and a point every
// few pixels, so that it bends the way a pulled stroke does and the hand
// wobbles all the way along it.
function route(g: G, rnd: Rnd, corners: Pt[], bend: number, width: number, color: number, alpha: number) {
  const soft: Pt[] = [corners[0]];
  for (let i = 1; i < corners.length - 1; i++) {
    const a = corners[i - 1];
    const b = corners[i];
    const c = corners[i + 1];
    const toA = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const toC = Math.hypot(c.x - b.x, c.y - b.y) || 1;
    const ra = Math.min(bend, toA / 2) / toA;
    const rc = Math.min(bend, toC / 2) / toC;
    const p = { x: b.x + (a.x - b.x) * ra, y: b.y + (a.y - b.y) * ra };
    const q = { x: b.x + (c.x - b.x) * rc, y: b.y + (c.y - b.y) * rc };
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const u = 1 - t;
      soft.push({
        x: u * u * p.x + 2 * u * t * b.x + t * t * q.x,
        y: u * u * p.y + 2 * u * t * b.y + t * t * q.y,
      });
    }
  }
  soft.push(corners[corners.length - 1]);
  const pts: Pt[] = [];
  for (let i = 0; i < soft.length - 1; i++) {
    const a = soft[i];
    const b = soft[i + 1];
    const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 5));
    for (let s = 0; s < steps; s++)
      pts.push({
        x: a.x + ((b.x - a.x) * s) / steps,
        y: a.y + ((b.y - a.y) * s) / steps,
      });
  }
  pts.push(soft[soft.length - 1]);
  handPath(g, rnd, pts, width, color, alpha);
}

// Half of a carrier: a half disc whose round side looks toward `side` (-1
// left, +1 right). A left half and a right half put together are one full
// dot.
function halfDisc(g: G, rnd: Rnd, x: number, y: number, radius: number, side: -1 | 1, color: number, alpha = 0.95) {
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI;
    pts.push({
      x: x + side * Math.cos(a) * (radius + jitter(rnd, 0.4)),
      y: y + Math.sin(a) * (radius + jitter(rnd, 0.4)),
    });
  }
  g.fillStyle(color, alpha);
  g.fillPoints(pts, true);
}

// A body of black ceramic as a mosaic: corner points, and the grains as
// lists of corners. Two grains that share two corners share a seam.
interface Mosaic {
  corners: Pt[];
  grains: number[][];
}

interface Edge {
  a: Pt;
  b: Pt;
  seam: boolean;
}

function edgesOf(m: Mosaic): Edge[] {
  const count = new Map<string, { i: number; j: number; n: number }>();
  for (const grain of m.grains) {
    for (let k = 0; k < grain.length; k++) {
      const i = grain[k];
      const j = grain[(k + 1) % grain.length];
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      const seen = count.get(key);
      if (seen) seen.n++;
      else count.set(key, { i, j, n: 1 });
    }
  }
  return [...count.values()].map((e) => ({
    a: m.corners[e.i],
    b: m.corners[e.j],
    seam: e.n > 1,
  }));
}

function centre(pts: Pt[]): Pt {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

// The way every phase arrow of the ceramic points: one phase agreed between
// all the grains.
const AGREED = -0.95;

// The mosaic as the golem carries it. Each grain is black, and holds one
// small phase arrow, the same way in every grain. The outer edge is dull;
// every seam between two grains is a thin bright line with a short ochre
// bridge across it, a weak link: the two grains do not touch, and the
// current crosses the gap.
function paintMosaic(g: G, rnd: Rnd, m: Mosaic, arrowLen: number) {
  for (const grain of m.grains) {
    wash(
      g,
      rnd,
      grain.map((i) => m.corners[i]),
      CHARCOAL,
      0.5
    );
  }
  const edges = edgesOf(m);
  for (const e of edges) {
    if (!e.seam) handLine(g, rnd, e.a.x, e.a.y, e.b.x, e.b.y, 1.5, DEEP_ICE, 0.8);
  }
  for (const e of edges) {
    if (!e.seam) continue;
    handLine(g, rnd, e.a.x, e.a.y, e.b.x, e.b.y, 1.6, ICE, 1);
    const mx = (e.a.x + e.b.x) / 2;
    const my = (e.a.y + e.b.y) / 2;
    const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) || 1;
    const nx = (-(e.b.y - e.a.y) / len) * 3.4;
    const ny = ((e.b.x - e.a.x) / len) * 3.4;
    g.lineStyle(2, YELLOW_OCHRE, 0.95);
    g.lineBetween(mx - nx, my - ny, mx + nx, my + ny);
  }
  for (const grain of m.grains) {
    const c = centre(grain.map((i) => m.corners[i]));
    arrow(g, rnd, c.x, c.y, arrowLen, AGREED, CHALK, 0.9, 1.4);
  }
}

// A block of the ceramic lying on the ice, as corner points around (x, y),
// its top-left: ten corners on the rim and two inside.
function blockCorners(x: number, y: number): Pt[] {
  const local: [number, number][] = [
    [0, 2],
    [30, 0],
    [72, 1],
    [102, 0],
    [103, 20],
    [101, 46],
    [66, 45],
    [26, 46],
    [1, 44],
    [-1, 26],
    [40, 18],
    [63, 28],
  ];
  return local.map(([lx, ly]) => ({ x: x + lx, y: y + ly }));
}
const BLOCK_RIM = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const BLOCK_GRAINS = [
  [0, 1, 10, 9],
  [1, 2, 11, 10],
  [2, 3, 4, 11],
  [9, 10, 7, 8],
  [10, 11, 6, 7],
  [11, 4, 5, 6],
];

// The Vortex Glacier's first chapter. The ice is one wave: a single even
// line with one phase from end to end, and under and over it the carriers,
// every one of them paired, drawn two by two. The field comes down from the
// top in ochre and does not enter: its lines turn aside over the ice and run
// along it, or pass around its ends. At two points the wave gives way, its
// height falling to nothing: a pit, with the flux that got in trapped at the
// bottom as one ochre dab, the lines that feed it bundled down into it, and
// the current that circles it as a whorl. Both whorls turn the same way,
// because the trapped flux all points one way. No pair is drawn at a pit:
// the core is not superconducting.
const paintOneWave: PlatePainter = (g, r, rnd) => {
  const left = r.x;
  const right = r.x + r.w;
  const top = r.y;
  const bottom = r.y + r.h;
  const iceLeft = left + 19;
  const iceRight = right - 19;
  const surface = top + 30;
  const waveY = top + 55;
  const pits = [left + 132, left + 322];

  wash(
    g,
    rnd,
    [
      { x: iceLeft, y: surface },
      { x: iceRight, y: surface },
      { x: iceRight, y: bottom - 1 },
      { x: iceLeft, y: bottom - 1 },
    ],
    DEEP_ICE,
    0.26
  );

  // The carriers, two by two, in two rows.
  const nearPit = (x: number, reach: number) => pits.some((p) => Math.abs(x - p) < reach);
  for (const [y, shift] of [
    [waveY - 15, 14],
    [waveY + 19, 0],
  ]) {
    for (let x = iceLeft + 12 + shift; x < iceRight - 10; x += 28) {
      if (nearPit(x, 22)) continue;
      const py = y + jitter(rnd, 1);
      dab(g, rnd, x - 2.8, py, 1.7, ICE, 0.9);
      dab(g, rnd, x + 2.8, py + jitter(rnd, 0.5), 1.7, ICE, 0.9);
    }
  }

  // The wave: even everywhere, and flat where it meets a pit.
  const height = (x: number) => pits.reduce((a, p) => a * Math.min(1, Math.max(0, (Math.abs(x - p) - 7) / 24)), 6);
  const wave = (x: number) => waveY + height(x) * Math.sin(((x - iceLeft) / 34) * Math.PI * 2);
  const stops = [iceLeft + 3, ...pits.flatMap((p) => [p - 7, p + 7]), iceRight - 3];
  for (let i = 0; i < stops.length; i += 2) curve(g, rnd, stops[i], stops[i + 1], wave, 1.8, CHALK, 0.95);

  for (const p of pits) pit(g, rnd, p, waveY);

  // The field. A line that comes down far from a pit turns over the ice and
  // runs along it to the pit, the farther line above the nearer one, and all
  // of them go down together.
  const field = (corners: Pt[]) => route(g, rnd, corners, 9, 1.4, YELLOW_OCHRE, 0.85);
  for (const p of pits) {
    field([
      { x: p + jitter(rnd, 1), y: top + 1 },
      { x: p, y: waveY - 1 },
    ]);
    for (const side of [-1, 1]) {
      const feeders: [number, number, number][] = [
        [31, 4.6, 4.5],
        [64, 2.3, 10],
      ];
      for (const [away, land, lift] of feeders) {
        const x0 = p + side * (away + jitter(rnd, 3));
        const x1 = p + side * land;
        const level = surface - lift;
        field([
          { x: x0 + jitter(rnd, 2), y: top + 1 },
          { x: x0, y: level - 1 },
          { x: x1 + side * 1.5, y: level + 1 },
          { x: x1, y: surface + 4 },
          { x: p + side * land * 0.3, y: waveY - 2 },
        ]);
      }
    }
  }
  // The lines nearest the ends of the ice go around it.
  const around: [number, number, number][] = [
    [left + 34, left + 6, 10],
    [left + 60, left + 13, 4.5],
    [right - 34, right - 6, 10],
    [right - 60, right - 13, 4.5],
  ];
  for (const [x0, x1, lift] of around) {
    const level = surface - lift;
    field([
      { x: x0 + jitter(rnd, 2), y: top + 1 },
      { x: x0, y: level - 1 },
      { x: x1, y: level + 1 },
      { x: x1 + jitter(rnd, 1), y: bottom - 2 },
    ]);
  }

  // The trapped flux: the only light the glacier has.
  for (const p of pits) dab(g, rnd, p, waveY, 2.1, YELLOW_OCHRE, 1);
};

// A passage of ice from x1 to x2 around the height y: a thin wash with a
// pale line all the way round it.
function passage(g: G, rnd: Rnd, x1: number, x2: number, y: number, halfHeight: number) {
  wash(
    g,
    rnd,
    [
      { x: x1, y: y - halfHeight },
      { x: x2, y: y - halfHeight },
      { x: x2, y: y + halfHeight },
      { x: x1, y: y + halfHeight },
    ],
    DEEP_ICE,
    0.3
  );
  handLine(g, rnd, x1, y - halfHeight, x2, y - halfHeight, 1.5, ICE, 0.85);
  handLine(g, rnd, x1, y + halfHeight, x2, y + halfHeight, 1.5, ICE, 0.85);
  handLine(g, rnd, x1, y - halfHeight, x1, y + halfHeight, 1.5, ICE, 0.85);
  handLine(g, rnd, x2, y - halfHeight, x2, y + halfHeight, 1.5, ICE, 0.85);
}

// The second chapter: the split traveler, and how it is undone. On the left
// a long passage with half a carrier at each end, the two halves facing away
// from each other and joined by nothing but a faint dotted line down the
// whole length: what they are is kept in that distance, and neither end
// holds it. On the right the same passage pressed short from both ends. The
// halves touch, and are one ordinary dot; the dotted line is gone, and with
// it what was stored. The halves themselves are not touched: only the
// length of the passage has changed.
const paintSplitTraveler: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const halfHeight = 15;
  const radius = 10;

  const longLeft = r.x + 14;
  const longRight = r.x + 232;
  passage(g, rnd, longLeft, longRight, mid, halfHeight);
  const endLeft = longLeft + 17;
  const endRight = longRight - 17;
  for (let x = endLeft + 7; x < endRight - 5; x += 8) {
    g.fillStyle(CHALK, 0.7);
    g.fillCircle(x, mid + jitter(rnd, 0.5), 1.1);
  }
  halfDisc(g, rnd, endLeft, mid, radius, -1, CHALK);
  halfDisc(g, rnd, endRight, mid, radius, 1, CHALK);

  const shortLeft = r.x + 298;
  const shortRight = r.x + 364;
  const shortMid = (shortLeft + shortRight) / 2;
  passage(g, rnd, shortLeft, shortRight, mid, halfHeight);
  halfDisc(g, rnd, shortMid - 0.8, mid, radius, -1, CHALK);
  halfDisc(g, rnd, shortMid + 0.8, mid, radius, 1, CHALK);
  g.lineStyle(1.3, CHARCOAL, 0.75);
  g.lineBetween(shortMid, mid - radius + 1.5, shortMid, mid + radius - 1.5);

  // The press on both ends of the passage.
  arrow(g, rnd, shortLeft - 19, mid, 22, 0, RED_OCHRE, 0.95, 2);
  arrow(g, rnd, shortRight + 19, mid, 22, Math.PI, RED_OCHRE, 0.95, 2);
};

// The Polycrystalline YBCO Golem's body, feet at the origin and up negative:
// eleven grains that share their corners, so every seam between two grains
// is one line. A head, a chest of four, two arms of two and two legs.
const GOLEM_CORNERS: [number, number][] = [
  [-24, -55], // 0 chest top left
  [-9, -56], // 1 head base left
  [0, -55], // 2 chest top middle
  [10, -56], // 3 head base right
  [24, -56], // 4 chest top right
  [-25, -36], // 5 chest left middle
  [2, -38], // 6 chest centre
  [25, -39], // 7 chest right middle
  [-23, -18], // 8 chest bottom left
  [-7, -17], // 9 left leg inner top
  [-1, -18], // 10 chest bottom middle
  [6, -18], // 11 right leg inner top
  [23, -19], // 12 chest bottom right
  [-11, -68], // 13 head
  [-2, -74], // 14 head
  [9, -71], // 15 head
  [-38, -52], // 16 left shoulder
  [-42, -34], // 17 left elbow
  [-46, -14], // 18 left fist
  [-30, -13], // 19 left fist
  [38, -53], // 20 right shoulder
  [43, -36], // 21 right elbow
  [47, -15], // 22 right fist
  [31, -14], // 23 right fist
  [-6, 3], // 24 left foot
  [-24, 3], // 25 left foot
  [25, 3], // 26 right foot
  [7, 3], // 27 right foot
];
const GOLEM_GRAINS = [
  [1, 13, 14, 15, 3, 2],
  [0, 1, 2, 6, 5],
  [2, 3, 4, 7, 6],
  [5, 6, 10, 9, 8],
  [6, 7, 12, 11, 10],
  [0, 16, 17, 5],
  [5, 17, 18, 19],
  [4, 20, 21, 7],
  [7, 21, 22, 23],
  [8, 9, 24, 25],
  [11, 12, 26, 27],
];

// A standing stone of the pass, cut from the ice.
function iceStone(g: G, rnd: Rnd, x: number, base: number, height: number, w: number) {
  const pts = [
    { x: x - w / 2, y: base },
    { x: x - w / 2 + 1.5, y: base - height * 0.8 },
    { x: x + 0.5, y: base - height },
    { x: x + w / 2, y: base - height * 0.72 },
    { x: x + w / 2 + 0.5, y: base },
  ];
  wash(g, rnd, pts, DEEP_ICE, 0.42);
  handPath(g, rnd, pts, 1.5, ICE, 0.9);
}

// A vortex pit seen from above: the dark bowl with its lit rim and the
// current that circles it. Every whorl turns the same way, because the
// trapped flux all points one way. The flux itself, the one ochre dab at the
// bottom, is put on by the plate, after whatever runs down into the pit.
function pit(g: G, rnd: Rnd, x: number, y: number) {
  const whorl: Pt[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    const a = 0.9 - t * Math.PI * 2.5;
    const rad = 15.5 - t * 6.5;
    whorl.push({ x: x + Math.cos(a) * rad, y: y + Math.sin(a) * rad });
  }
  handPath(g, rnd, whorl, 1.4, ICE, 0.85);
  g.fillStyle(CHARCOAL, 0.85);
  g.fillCircle(x, y, 6);
  handRing(g, rnd, x, y, 6.2, 1.5, ICE, 0.95);
}

// The third chapter: the Polycrystalline YBCO Golem pulling itself out of
// the frost, between the two stones of its pass. Its body is a mosaic of
// black grains. Every grain carries one phase arrow and all the arrows point
// the same way: one phase, agreed between a thousand pieces. Every seam is a
// weak link, a bright line with a bridge across it where the current crosses
// the gap. Behind it lies the open ice, with one pit in it.
const paintCeramicGolem: PlatePainter = (g, r, rnd) => {
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  const cx = r.x + r.w * 0.66;
  const frost = bottom - 8;
  const stretch = 1.12;

  // The sheet of ice, and the frost the golem stands in.
  wash(
    g,
    rnd,
    [
      { x: r.x + 6, y: frost - 34 },
      { x: cx - 96, y: frost - 34 },
      { x: cx - 80, y: frost - 4 },
      { x: right - 8, y: frost - 4 },
      { x: right - 8, y: bottom - 1 },
      { x: r.x + 6, y: bottom - 1 },
    ],
    DEEP_ICE,
    0.28
  );
  pit(g, rnd, r.x + 78, frost - 14);
  dab(g, rnd, r.x + 78, frost - 14, 2.1, YELLOW_OCHRE, 1);

  iceStone(g, rnd, cx - 76, frost + 2, 44, 13);
  iceStone(g, rnd, cx + 77, frost + 2, 41, 13);

  paintMosaic(
    g,
    rnd,
    {
      corners: GOLEM_CORNERS.map(([x, y]) => ({
        x: cx + x * stretch,
        y: frost + y,
      })),
      grains: GOLEM_GRAINS,
    },
    8.5
  );

  // The frost it breaks: shards thrown up around its legs.
  for (const [x, lean] of [
    [-36, -1],
    [-30, -1],
    [0, 1],
    [31, 1],
    [37, 1],
  ]) {
    const sx = cx + x + jitter(rnd, 1.5);
    handLine(g, rnd, sx, frost + 4, sx + lean * 3, frost - 5 + jitter(rnd, 1.5), 1.4, ICE, 0.9);
    handLine(g, rnd, sx + lean * 3, frost - 5, sx + lean * 6.5, frost + 4, 1.4, ICE, 0.9);
  }
};

// The fourth chapter. On the left the ceramic as it was: a block of grains,
// seams bright, a bridge across each. In the middle the same block with the
// weak links fused: no seam is left, and one unbroken wave runs through it
// and out onto the ice on both sides. The phase is one thing, not an
// agreement. No figure stands anywhere. On the right, ahead, the coast: long
// swells with a row of spins standing on them, all pointing the same way,
// under a thin band of green aurora.
const paintFusedLinks: PlatePainter = (g, r, rnd) => {
  const top = r.y + 19;
  const floor = top + 47;

  // The ice the blocks lie on.
  wash(
    g,
    rnd,
    [
      { x: r.x + 4, y: floor },
      { x: r.x + 286, y: floor },
      { x: r.x + 286, y: floor + 9 },
      { x: r.x + 4, y: floor + 9 },
    ],
    DEEP_ICE,
    0.3
  );

  paintMosaic(g, rnd, { corners: blockCorners(r.x + 14, top), grains: BLOCK_GRAINS }, 9);

  const fused = blockCorners(r.x + 160, top);
  const rim = BLOCK_RIM.map((i) => fused[i]);
  wash(g, rnd, rim, CHARCOAL, 0.5);
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i];
    const b = rim[(i + 1) % rim.length];
    handLine(g, rnd, a.x, a.y, b.x, b.y, 1.5, DEEP_ICE, 0.9);
  }
  const waveY = top + 23;
  curve(g, rnd, r.x + 142, r.x + 282, (x) => waveY + 7 * Math.sin(((x - r.x - 142) / 30) * Math.PI * 2), 1.8, CHALK, 0.95);

  // The coast ahead.
  const seaLeft = r.x + 312;
  const seaRight = r.x + r.w - 6;
  const aurora: Pt[] = [];
  for (let x = seaLeft; x <= seaRight; x += 6) aurora.push({ x, y: r.y + 9 + 1.6 * Math.sin((x - seaLeft) / 13) });
  handPath(g, rnd, aurora, 2.6, AURORA_GREEN, 0.75);
  for (const [y, shift] of [
    [r.y + 46, 0],
    [r.y + 74, 7],
  ]) {
    const swell = (x: number) => y + 2.4 * Math.sin((x - seaLeft + shift * 3) / 9);
    curve(g, rnd, seaLeft, seaRight, swell, 1.6, SEA_BLUE, 0.9);
    for (let x = seaLeft + 6 + shift; x < seaRight - 3; x += 13) spin(g, rnd, x, swell(x) - 2.5, 11, CHALK, 0.92);
  }
};

export const PLATES: Record<string, PlatePainter> = {
  '5-history': paintOneWave,
  '5-decoherence': paintSplitTraveler,
  '5-pass': paintCeramicGolem,
  '5-release': paintFusedLinks,
};
