import { CHARCOAL, CHALK, RED_OCHRE, YELLOW_OCHRE, dab, handLine, handPath, jitter, wash } from './brush';
import type { G, PlatePainter, Rnd } from './brush';

// The Winding Borders: afternoon, a floor of flat sunken domains with a lit
// ledge wherever two different ones meet. Its own earths are the two dead
// colours of the domains, a teal for the phase that carries the integer one
// and an ochre for the phase that carries zero. The seam between them is the
// bright thing on every plate: yellow ochre with chalk laid along it.
const DEAD_TEAL = 0x3a726e;
const DEAD_OCHRE = 0xa37b33;
// The earth of the next world, for the one sign of it in the release plate.
const STORM_INDIGO = 0x4a5296;
const STORM_INDIGO_PALE = 0x8f97cf;

type Pt = { x: number; y: number };

// The seam: a broad stroke of yellow ochre with a thinner one of chalk along
// its middle.
function seam(g: G, rnd: Rnd, pts: Pt[], closed = false) {
  handPath(g, rnd, pts, 3.8, YELLOW_OCHRE, 0.95, closed);
  handPath(g, rnd, pts, 1.5, CHALK, 0.95, closed);
}

// One carrier of the edge channel: an arrow along its direction of travel
// (`angle`), with a short tick that leaves the shaft upward for spin up
// (`spin` 1) or downward for spin down (-1). The tick keeps to the wall's own
// up and down whatever way the arrow runs, since the spin axis is fixed.
function laneArrow(g: G, rnd: Rnd, x: number, y: number, angle: number, spin: 1 | -1, color: number, alpha = 0.95) {
  const half = 6.5;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tip = { x: x + dx * half, y: y + dy * half };
  handLine(g, rnd, x - dx * half, y - dy * half, tip.x, tip.y, 1.7, color, alpha);
  g.lineStyle(1.6, color, alpha);
  for (const side of [-1, 1]) {
    const a = angle + Math.PI + side * 0.62;
    g.lineBetween(tip.x, tip.y, tip.x + Math.cos(a) * 4.4, tip.y + Math.sin(a) * 4.4);
  }
  spinTick(g, rnd, x - dx * 2.2, y - dy * 2.2, spin, color, alpha);
}

// The spin of a carrier: a short stroke up or down from the point given,
// ending in a small knob.
function spinTick(g: G, rnd: Rnd, x: number, y: number, spin: 1 | -1, color: number, alpha = 0.95) {
  const end = { x: x + jitter(rnd, 0.4), y: y - spin * 5.6 };
  g.lineStyle(1.5, color, alpha);
  g.lineBetween(x, y, end.x, end.y);
  g.fillStyle(color, alpha);
  g.fillCircle(end.x, end.y, 1.25);
}

// A magnetic flaw: a mark of red ochre carrying a spin arrow of its own. Its
// arrow lies across the carriers' up and down, because only a moment with a
// part transverse to their spin axis can flip a spin.
function magneticFlaw(g: G, rnd: Rnd, x: number, y: number) {
  dab(g, rnd, x, y, 4.8, RED_OCHRE, 0.95);
  const a = -0.34 + jitter(rnd, 0.06);
  const reach = 11.5;
  const tip = { x: x + Math.cos(a) * reach, y: y + Math.sin(a) * reach };
  handLine(g, rnd, x - Math.cos(a) * reach, y - Math.sin(a) * reach, tip.x, tip.y, 2, RED_OCHRE, 0.95);
  g.lineStyle(1.8, RED_OCHRE, 0.95);
  for (const side of [-1, 1]) {
    const b = a + Math.PI + side * 0.6;
    g.lineBetween(tip.x, tip.y, tip.x + Math.cos(b) * 4.8, tip.y + Math.sin(b) * 4.8);
  }
}

// A carrier that has stopped: a dot where its arrow was, in its lane's own
// pigment.
function stillDot(g: G, rnd: Rnd, x: number, y: number, color: number) {
  dab(g, rnd, x, y, 1.7, color, 0.95);
}

// Tarnished silver, mixed on the wall from chalk greyed with charcoal.
function silver(g: G, rnd: Rnd, outline: Pt[]) {
  wash(g, rnd, outline, CHALK, 0.36);
  wash(g, rnd, outline, CHARCOAL, 0.1);
}

// The floor as a set of domains: the cell of every seed is the ground nearer
// to it than to any other seed, cut out of the box one neighbor at a time.
// `nb[i]` names the seed across the edge from `pts[i]` to the next point, or
// -1 where the edge is the box's own.
interface Domain {
  seed: Pt;
  pts: Pt[];
  nb: number[];
}

function domains(seeds: Pt[], box: { x: number; y: number; w: number; h: number }): Domain[] {
  return seeds.map((seed, i) => {
    let pts: Pt[] = [
      { x: box.x, y: box.y },
      { x: box.x + box.w, y: box.y },
      { x: box.x + box.w, y: box.y + box.h },
      { x: box.x, y: box.y + box.h },
    ];
    let nb = [-1, -1, -1, -1];
    seeds.forEach((other, j) => {
      if (j === i) return;
      const nx = other.x - seed.x;
      const ny = other.y - seed.y;
      const side = (p: Pt) => (p.x - (seed.x + other.x) / 2) * nx + (p.y - (seed.y + other.y) / 2) * ny;
      const keptPts: Pt[] = [];
      const keptNb: number[] = [];
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k];
        const b = pts[(k + 1) % pts.length];
        const da = side(a);
        const db = side(b);
        const cross = () => ({ x: a.x + ((b.x - a.x) * da) / (da - db), y: a.y + ((b.y - a.y) * da) / (da - db) });
        if (da <= 0) {
          keptPts.push(a);
          keptNb.push(nb[k]);
          if (db > 0) {
            keptPts.push(cross());
            keptNb.push(j);
          }
        } else if (db <= 0) {
          keptPts.push(cross());
          keptNb.push(nb[k]);
        }
      }
      pts = keptPts;
      nb = keptNb;
    });
    return { seed, pts, nb };
  });
}

// The first chapter: the floor of sunken domains, seen from above. Each
// domain is one phase and is washed in its dead colour: ochre for the phase
// whose integer is zero, teal for the phase whose integer is one. The integer
// is painted the way a count is, one tally stroke in every teal domain and
// none in an ochre one. A border is a seam exactly where the two integers
// across it differ, so the bright road runs along every teal-ochre border and
// along no other: where two domains of one kind touch there is only a thin
// dark joint. The interiors are left empty, since nothing lives in them.
const paintDomainFloor: PlatePainter = (g, r, rnd) => {
  const box = { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 };
  // The seeds, left to right: a domain that takes the wall's whole height,
  // then two stacked ones, and so on, the kinds alternating along the wall.
  // The first and the last stacked pair are of one kind each, so the border
  // inside the pair is one across which nothing changes. The middle pair is
  // of two kinds, and each of its domains meets its own kind on one side.
  // Kind 1 is teal, kind 0 is ochre.
  const layout: [number, number, 0 | 1][] = [
    [0.04, 0.42, 1],
    [0.18, 0.2, 0],
    [0.22, 0.8, 0],
    [0.36, 0.52, 1],
    [0.5, 0.2, 0],
    [0.54, 0.8, 1],
    [0.68, 0.46, 0],
    [0.81, 0.2, 1],
    [0.85, 0.8, 1],
    [0.98, 0.54, 0],
  ];
  const kind = layout.map((l) => l[2]);
  const cells = domains(
    layout.map(([fx, fy]) => ({ x: box.x + box.w * fx, y: box.y + box.h * fy })),
    box
  );

  // The washes, each drawn in a little from its border so that the rock
  // shows between two domains.
  cells.forEach((cell, i) => {
    const cx = cell.pts.reduce((sum, p) => sum + p.x, 0) / cell.pts.length;
    const cy = cell.pts.reduce((sum, p) => sum + p.y, 0) / cell.pts.length;
    const inset = cell.pts.map((p) => {
      const d = Math.hypot(cx - p.x, cy - p.y) || 1;
      return { x: p.x + ((cx - p.x) / d) * 3, y: p.y + ((cy - p.y) / d) * 3 };
    });
    wash(g, rnd, inset, kind[i] ? DEAD_TEAL : DEAD_OCHRE, kind[i] ? 0.36 : 0.32);
  });

  // The borders, each drawn once: a dark joint between two of a kind, the
  // seam between two that differ.
  const each = (want: boolean, draw: (a: Pt, b: Pt) => void) =>
    cells.forEach((cell, i) =>
      cell.nb.forEach((j, k) => {
        if (j > i && (kind[i] !== kind[j]) === want) draw(cell.pts[k], cell.pts[(k + 1) % cell.pts.length]);
      })
    );
  each(false, (a, b) => handLine(g, rnd, a.x, a.y, b.x, b.y, 1.4, CHARCOAL, 0.6));
  each(true, (a, b) => seam(g, rnd, [a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b]));

  // The integer of each domain: one stroke where it is one, none where it
  // is zero.
  cells.forEach((cell, i) => {
    if (!kind[i]) return;
    const cx = cell.pts.reduce((sum, p) => sum + p.x, 0) / cell.pts.length;
    const cy = cell.pts.reduce((sum, p) => sum + p.y, 0) / cell.pts.length;
    handLine(g, rnd, cx + jitter(rnd, 0.8), cy - 6.5, cx + jitter(rnd, 0.8), cy + 6.5, 2.6, CHARCOAL, 0.95);
  });
};

// The second chapter, read left to right: the road's rule, the damage that
// does not break it, and the flaw that does. The seam runs the whole width
// between a teal domain above and an ochre one below. Along it go two lanes
// of carriers: chalk arrows running right with their spin up, charcoal arrows
// running left with their spin down, so that direction and spin are locked.
// At the pile of rubble both lanes bend around and go on, each in its own
// direction. At the magnetic flaw one chalk carrier is turned back: it
// crosses into the other lane, takes its pigment and comes out running left
// with its spin down. The seam itself goes on past the flaw as bright as
// before.
const paintLockedLanes: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const left = r.x + 3;
  const right = r.x + r.w - 3;
  const reach = 33;
  const lane = 11;
  const rubbleX = r.x + r.w * 0.47;
  const flawX = r.x + r.w * 0.79;

  wash(
    g,
    rnd,
    [
      { x: left, y: mid - reach },
      { x: right, y: mid - reach },
      { x: right, y: mid },
      { x: left, y: mid },
    ],
    DEAD_TEAL,
    0.34
  );
  wash(
    g,
    rnd,
    [
      { x: left, y: mid },
      { x: right, y: mid },
      { x: right, y: mid + reach },
      { x: left, y: mid + reach },
    ],
    DEAD_OCHRE,
    0.34
  );

  seam(g, rnd, [
    { x: left, y: mid },
    { x: left + (right - left) * 0.25, y: mid + 0.8 },
    { x: left + (right - left) * 0.5, y: mid - 0.6 },
    { x: left + (right - left) * 0.75, y: mid + 0.6 },
    { x: right, y: mid },
  ]);

  // How far a lane stands off the seam at x: its own width, and further
  // where it goes around the rubble.
  const off = (x: number) => lane + 13 * Math.exp(-(((x - rubbleX) / 24) ** 2));
  const slope = (x: number) => (off(x + 1) - off(x - 1)) / 2;
  const turnFrom = flawX - 46;
  for (let x = left + 12; x < right - 6; x += 25) {
    // Spin up runs right, in chalk, on the teal side.
    if (x < turnFrom - 14 || x > flawX + 18) laneArrow(g, rnd, x, mid - off(x), Math.atan2(-slope(x), 1), 1, CHALK);
    // Spin down runs left, in charcoal, on the ochre side.
    const xl = x + 10;
    if (xl < turnFrom - 20 || xl > flawX + 18) laneArrow(g, rnd, xl, mid + off(xl), Math.atan2(-slope(xl), -1), -1, CHARCOAL);
  }

  // The rubble on the seam: charcoal dabs, heaped.
  for (let i = 0; i < 11; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 9;
    dab(g, rnd, rubbleX + Math.cos(a) * d * 1.2, mid + Math.sin(a) * d * 0.8, 2.4 + rnd() * 2, CHARCOAL, 0.92);
  }

  // The carrier that is turned back at the flaw. It comes in along the chalk
  // lane with its spin up, swings around short of the flaw, and leaves along
  // the charcoal lane with its spin down.
  const bend = flawX - 17;
  const turn: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    turn.push({ x: bend + Math.cos(a) * 9, y: mid + Math.sin(a) * lane });
  }
  const upper = turn.slice(0, 5);
  const lower = turn.slice(4);
  handPath(g, rnd, [{ x: turnFrom, y: mid - lane }, ...upper], 1.9, CHALK, 0.95);
  spinTick(g, rnd, turnFrom + 9, mid - lane, 1, CHALK);
  const out = { x: turnFrom, y: mid + lane };
  handPath(g, rnd, [...lower, out], 1.9, CHARCOAL, 0.95);
  g.lineStyle(1.6, CHARCOAL, 0.95);
  for (const side of [-1, 1]) {
    g.lineBetween(out.x, out.y, out.x + Math.cos(side * 0.62) * 4.4, out.y + Math.sin(side * 0.62) * 4.4);
  }
  spinTick(g, rnd, turnFrom + 12, mid + lane, -1, CHARCOAL);

  magneticFlaw(g, rnd, flawX, mid);
};

// The outline of a block of grains: a rough slab with corners knocked off,
// `w` wide and `h` tall with its top-left corner at (x, y).
function slabOutline(rnd: Rnd, x: number, y: number, w: number, h: number): Pt[] {
  const j = () => jitter(rnd, 1.6);
  return [
    { x: x + 5 + j(), y: y + j() },
    { x: x + w * 0.52 + j(), y: y - 1.5 + j() },
    { x: x + w - 6 + j(), y: y + j() },
    { x: x + w + j(), y: y + h * 0.45 + j() },
    { x: x + w - 4 + j(), y: y + h + j() },
    { x: x + w * 0.45 + j(), y: y + h + 1.5 + j() },
    { x: x + 4 + j(), y: y + h + j() },
    { x: x + j(), y: y + h * 0.55 + j() },
  ];
}

// The golem's silhouette, as offsets from the point between its feet: two
// legs, a broad trunk with a hanging arm each side, and a block of a head.
const GOLEM: [number, number][] = [
  [-14, 0],
  [-15, -21],
  [-27, -19],
  [-30, -44],
  [-17, -48],
  [-9, -46],
  [-11, -61],
  [8, -63],
  [10, -47],
  [18, -48],
  [30, -43],
  [27, -20],
  [15, -22],
  [14, 0],
  [3, 0],
  [2, -16],
  [-2, -17],
  [-4, 0],
];
// Where its grains meet, in the same offsets: each run of points is one
// dark line across the body.
const GOLEM_GRAINS: [number, number][][] = [
  [
    [-9, -46],
    [0, -44],
    [10, -47],
  ],
  [
    [-17, -48],
    [-14, -33],
    [-15, -21],
  ],
  [
    [18, -48],
    [16, -34],
    [15, -22],
  ],
  [
    [-15, -21],
    [-1, -24],
    [15, -22],
  ],
  [
    [-14, -33],
    [0, -35],
    [16, -34],
  ],
  [
    [0, -44],
    [-1, -24],
    [0, -16],
  ],
  [
    [-11, -55],
    [0, -53],
    [0, -44],
  ],
  [
    [-29, -31],
    [-15, -30],
  ],
  [
    [29, -32],
    [16, -30],
  ],
  [
    [-15, -11],
    [-4, -9],
  ],
  [
    [14, -10],
    [3, -8],
  ],
];

// The third chapter: the Polycrystalline Bismuth Telluride Golem standing on
// the seam, a teal domain above the seam and an ochre one below. It is a
// body of tarnished-silver grains with dark lines where grain meets grain.
// The seam does not pass under it: the bright line climbs its outline and
// comes down the other side, so that the figure is the boundary. Along the
// lit line sit the carriers of the two lanes, chalk on one side and charcoal
// on the other, and every one of them is a dot: none has a direction,
// because nothing moves along the light.
const paintSilverGolem: PlatePainter = (g, r, rnd) => {
  const left = r.x + 3;
  const right = r.x + r.w - 3;
  const base = r.y + r.h - 17;
  const cx = r.x + r.w / 2;
  const top = r.y + 3;
  const floor = r.y + r.h - 2;

  wash(
    g,
    rnd,
    [
      { x: left, y: top + 14 },
      { x: right, y: top + 14 },
      { x: right, y: base },
      { x: left, y: base },
    ],
    DEAD_TEAL,
    0.34
  );
  wash(
    g,
    rnd,
    [
      { x: left, y: base },
      { x: right, y: base },
      { x: right, y: floor },
      { x: left, y: floor },
    ],
    DEAD_OCHRE,
    0.34
  );

  const body = GOLEM.map(([dx, dy]) => ({ x: cx + dx + jitter(rnd, 0.8), y: base + dy + jitter(rnd, 0.8) }));
  // Under the body the rock is cleared of the teal, then the silver goes on.
  g.fillStyle(CHALK, 0.42);
  g.fillPoints(body, true);
  silver(g, rnd, body);
  for (const run of GOLEM_GRAINS) {
    handPath(
      g,
      rnd,
      run.map(([dx, dy]) => ({ x: cx + dx, y: base + dy })),
      1.4,
      CHARCOAL,
      0.85
    );
  }

  // The seam: in from the left to the first foot, around the figure, and
  // out from the other foot to the right.
  seam(g, rnd, [
    { x: left, y: base },
    { x: left + (body[0].x - left) * 0.5, y: base + 0.7 },
    body[0],
  ]);
  seam(g, rnd, body, true);
  seam(g, rnd, [body[13], { x: body[13].x + (right - body[13].x) * 0.5, y: base - 0.7 }, { x: right, y: base }]);

  // The stopped carriers. Along the open seam they keep their lanes, chalk
  // on the teal side and charcoal on the ochre side.
  for (let x = left + 14; x < right - 8; x += 21) {
    if (Math.abs(x - cx) < 40) continue;
    stillDot(g, rnd, x, base - 7, CHALK);
    stillDot(g, rnd, x + 9, base + 7, CHARCOAL);
  }
  // Around the figure the chalk lane goes on as dots too, a step apart along
  // the lit outline and just outside it. The soles and the gap between the
  // legs are left out.
  let carried = 6;
  for (let i = 0; i < 13; i++) {
    const a = body[i];
    const b = body[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    // The outline runs clockwise on the wall, so its outside is to the left
    // of the direction of travel.
    const ox = (b.y - a.y) / len;
    const oy = -(b.x - a.x) / len;
    for (carried += len; carried >= 12; carried -= 12) {
      const t = (len - (carried - 12)) / len;
      const px = a.x + (b.x - a.x) * t + ox * 5.5;
      const py = a.y + (b.y - a.y) * t + oy * 5.5;
      if (py > r.y + 1.5 && py < base - 4) stillDot(g, rnd, px, py, CHALK);
    }
  }
};

// The last chapter of the world, read left to right. First the silver as it
// stood: a block of grains, dark lines between them, its top edge lit, and
// on that edge the carriers of both lanes stopped as dots. Then the same
// silver with the disorder drained out of it: one clean block, and along its
// lit edge the two lanes run again, chalk to the right with spin up and
// charcoal to the left with spin down. The flaws are still where they were,
// marks of red ochre on the edge, but they have lost the spin arrow that
// made them able to flip a carrier, and both lanes go straight by. The bulk
// under the edge is empty in both blocks. No figure stands here. On the
// right, the land ahead: flat bands of storm indigo, one above the other,
// and one jagged stroke of a strike over them.
const paintCurrentsWalk: PlatePainter = (g, r, rnd) => {
  const edge = r.y + 31;
  const depth = 40;

  // The silver as it stood.
  const stoodX = r.x + 8;
  const stoodW = 92;
  const stood = slabOutline(rnd, stoodX, edge, stoodW, depth);
  silver(g, rnd, stood);
  const cracks: [number, number][][] = [
    [
      [0.3, 0],
      [0.36, 0.5],
      [0.26, 1],
    ],
    [
      [0.66, 0],
      [0.6, 0.42],
      [0.7, 1],
    ],
    [
      [0, 0.55],
      [0.36, 0.5],
    ],
    [
      [0.6, 0.42],
      [1, 0.45],
    ],
    [
      [0.36, 0.5],
      [0.48, 0.72],
      [0.45, 1],
    ],
  ];
  for (const run of cracks) {
    handPath(
      g,
      rnd,
      run.map(([fx, fy]) => ({ x: stoodX + stoodW * fx, y: edge + depth * fy })),
      1.4,
      CHARCOAL,
      0.85
    );
  }
  handPath(g, rnd, stood, 1.3, CHARCOAL, 0.6, true);
  seam(g, rnd, [stood[0], stood[1], stood[2]]);
  for (let x = stoodX + 12; x < stoodX + stoodW - 8; x += 19) {
    stillDot(g, rnd, x, edge - 8, CHALK);
    stillDot(g, rnd, x + 8, edge + 8, CHARCOAL);
  }

  // The silver with its currents walking.
  const freeX = r.x + 132;
  const freeW = 152;
  const free = slabOutline(rnd, freeX, edge, freeW, depth);
  silver(g, rnd, free);
  handPath(g, rnd, free, 1.3, CHARCOAL, 0.6, true);
  seam(g, rnd, [free[0], free[1], free[2]]);
  for (let x = freeX + 16; x < freeX + freeW - 10; x += 25) {
    laneArrow(g, rnd, x, edge - 11, 0, 1, CHALK);
    laneArrow(g, rnd, x + 11, edge + 11, Math.PI, -1, CHARCOAL);
  }
  for (const fx of [0.24, 0.55, 0.83]) {
    dab(g, rnd, freeX + freeW * fx, edge + jitter(rnd, 0.6), 3.4, RED_OCHRE, 0.8);
  }

  // The land ahead: three flat bands of one hue, pale to deep, and a strike.
  const aheadX = r.x + r.w * 0.74;
  const aheadW = r.w * 0.24;
  const bandTop = r.y + 44;
  const bandH = 11;
  [0.26, 0.4, 0.56].forEach((alpha, i) => {
    const y = bandTop + i * bandH;
    wash(
      g,
      rnd,
      [
        { x: aheadX, y: y + 1 },
        { x: aheadX + aheadW, y: y + 1 },
        { x: aheadX + aheadW, y: y + bandH - 1 },
        { x: aheadX, y: y + bandH - 1 },
      ],
      STORM_INDIGO,
      alpha
    );
    handLine(g, rnd, aheadX, y, aheadX + aheadW, y, 1.4, STORM_INDIGO_PALE, 0.85);
  });
  const strikeX = aheadX + aheadW * 0.55;
  handPath(
    g,
    rnd,
    [
      { x: strikeX + 7, y: r.y + 5 },
      { x: strikeX - 2, y: r.y + 16 },
      { x: strikeX + 5, y: r.y + 21 },
      { x: strikeX - 6, y: r.y + 33 },
      { x: strikeX + 1, y: r.y + 36 },
      { x: strikeX - 4, y: r.y + 42 },
    ],
    1.8,
    STORM_INDIGO_PALE,
    0.95
  );
};

export const PLATES: Record<string, PlatePainter> = {
  '3-history': paintDomainFloor,
  '3-decoherence': paintLockedLanes,
  '3-pass': paintSilverGolem,
  '3-release': paintCurrentsWalk,
};
