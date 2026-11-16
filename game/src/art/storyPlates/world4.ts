import { CHALK, YELLOW_OCHRE, dab, handLine, handPath, jitter, wash } from './brush';
import type { G, PlatePainter, Rnd } from './brush';

// The Storm Flats: stormy dusk and no sun, flat bands under a field. Its own
// earth is one storm indigo, ground at three strengths from pale to deep,
// since the world owns a single hue and a ramp of it.
const STORM_INDIGO_PALE = 0x8f97cf;
const STORM_INDIGO = 0x4a5296;
const STORM_INDIGO_DEEP = 0x262a5e;
// The earth of the next world, for the one sign of it in the release plate.
const ICE_CYAN = 0xa9cfd3;

type Pt = { x: number; y: number };

// A loop that closes on itself: one turn, the end of the stroke meeting its
// start. The brushes' own ring is left a little open, and here the closing
// is the point.
function closedLoop(g: G, rnd: Rnd, x: number, y: number, radius: number, width: number, color: number, alpha = 0.95) {
  const pts: Pt[] = [];
  const steps = Math.max(10, Math.round(radius * 1.8));
  const start = rnd() * Math.PI * 2;
  for (let i = 0; i < steps; i++) {
    const a = start + (i / steps) * Math.PI * 2;
    const rr = radius + jitter(rnd, Math.min(0.6, radius * 0.08));
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  handPath(g, rnd, pts, width, color, alpha, true);
}

// A loop that fails to close: the stroke drifts outward as it turns, so that
// after a full turn its end passes outside its start and misses it by `miss`
// times the radius.
function openSpiral(g: G, rnd: Rnd, x: number, y: number, radius: number, miss: number, width: number, color: number, alpha = 0.95) {
  const pts: Pt[] = [];
  const turns = 1.12;
  const steps = Math.round(radius * 2.2 * turns);
  const start = -Math.PI * 0.75 + jitter(rnd, 0.5);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + t * turns * Math.PI * 2;
    const rr = radius * (1 - miss * 0.45 + miss * t * turns);
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  handPath(g, rnd, pts, width, color, alpha);
}

// One count: a tally stroke.
function tally(g: G, rnd: Rnd, x: number, y: number, len: number, color: number) {
  handLine(g, rnd, x + jitter(rnd, 0.7), y - len / 2, x + jitter(rnd, 0.7), y + len / 2, 2.2, color, 0.95);
}

// A spin: a short upright arrow, pointing up the wall (`dir` 1) or down it
// (-1). The moments of this material stand perpendicular to its sheets.
function spin(g: G, rnd: Rnd, x: number, y: number, len: number, dir: 1 | -1, color: number, alpha = 0.95) {
  const tip = { x: x + jitter(rnd, 0.4), y: y - (dir * len) / 2 };
  handLine(g, rnd, x, y + (dir * len) / 2, tip.x, tip.y, 1.6, color, alpha);
  g.lineStyle(1.5, color, alpha);
  g.lineBetween(tip.x, tip.y, tip.x - 2.8, tip.y + dir * 3.2);
  g.lineBetween(tip.x, tip.y, tip.x + 2.8, tip.y + dir * 3.2);
}

// The surveyor's road: a stem that divides in two, and from the end of each
// arm the same figure again, smaller by one fixed ratio. Every fork is the
// first one scaled down, which is what made the map impossible to finish.
function forkRoad(g: G, rnd: Rnd, x: number, y: number, scale: number, splits: number) {
  const stem = 13 * scale;
  const arm = 30 * scale;
  const spread = 19.5 * scale;
  const width = Math.max(1.35, 2.7 * Math.sqrt(scale));
  handLine(g, rnd, x, y, x + stem, y, width, STORM_INDIGO_PALE, 0.95);
  for (const side of [-1, 1]) {
    const end = { x: x + stem + arm, y: y + side * spread };
    handLine(g, rnd, x + stem, y, end.x, end.y, width, STORM_INDIGO_PALE, 0.95);
    if (splits > 1) forkRoad(g, rnd, end.x, end.y, scale * 0.56, splits - 1);
  }
}

// The first chapter, read left to right. On the left the road as the
// surveyor mapped it, four splits deep, every split the same shape as the
// first. On the right the reason: under the field every path is bent until
// it closes into an orbit, and the orbits sit on flat levels, one above the
// other and evenly spaced, the same number of orbits on each. All the orbits
// of one level are the same size, and the orbits of a higher level are
// wider, as the square root of the odd numbers.
const paintForkAndLevels: PlatePainter = (g, r, rnd) => {
  forkRoad(g, rnd, r.x + 5, r.y + r.h / 2, 1, 4);

  // The levels and their orbits.
  const levelsLeft = r.x + r.w * 0.4;
  const levelsRight = r.x + r.w - 5;
  const spacing = 26;
  const lowest = r.y + r.h - 5;
  const perLevel = 8;
  const step = (levelsRight - levelsLeft) / perLevel;
  for (let n = 0; n < 3; n++) {
    const y = lowest - n * spacing;
    handLine(g, rnd, levelsLeft, y, levelsRight, y, 1.8, STORM_INDIGO_PALE, 0.95);
    const radius = 4.6 * Math.sqrt(2 * n + 1);
    for (let i = 0; i < perLevel; i++) {
      closedLoop(g, rnd, levelsLeft + step * (i + 0.5) + jitter(rnd, 1), y - radius - 1.5, radius, 1.5, STORM_INDIGO_PALE);
    }
  }
};

// The second chapter, read left to right. On the left the counting: closed
// loops, each around exactly one dot, one quantum of flux, and a tally
// stroke under each, with the flat evenly spaced levels below. On the right
// the same loops with their phase scrambled: the stroke no longer comes back
// to its start, and each is an open spiral whose ends miss. The dot inside
// is still there, since the field has not changed, but there is no tally
// under a loop that does not close. Below them the three levels lose their
// places and run together into one blurred slope.
const paintScrambledLoops: PlatePainter = (g, r, rnd) => {
  const loopY = r.y + 17;
  const loopR = 10;
  const tallyY = r.y + 38;
  const levels = [r.y + 54, r.y + 66, r.y + 78];
  const countedLeft = r.x + 8;
  const countedRight = r.x + r.w * 0.31;

  for (let i = 0; i < 4; i++) {
    const x = countedLeft + 13 + i * ((countedRight - countedLeft - 26) / 3);
    closedLoop(g, rnd, x, loopY, loopR, 1.8, STORM_INDIGO_PALE);
    dab(g, rnd, x, loopY, 2, CHALK, 0.95);
    tally(g, rnd, x, tallyY, 10, CHALK);
  }
  for (const y of levels) handLine(g, rnd, countedLeft, y, countedRight, y, 1.8, STORM_INDIGO_PALE, 0.95);

  const lostLeft = r.x + r.w * 0.42;
  const lostRight = r.x + r.w - 8;
  for (let i = 0; i < 5; i++) {
    const x = lostLeft + 14 + i * ((lostRight - lostLeft - 30) / 4);
    openSpiral(g, rnd, x, loopY + 1 + jitter(rnd, 1.5), loopR, 0.4 + i * 0.09, 1.8, STORM_INDIGO_PALE);
    dab(g, rnd, x, loopY + 1, 2, CHALK, 0.95);
  }

  // The slope the levels smear into: a thin slanted wash, and the three
  // lines breaking up into short strokes and dabs that drift onto it.
  const slopeAt = (x: number) => r.y + 80 - ((x - lostLeft) / (lostRight - lostLeft)) * 30;
  wash(
    g,
    rnd,
    [
      { x: lostLeft + 6, y: slopeAt(lostLeft) - 13 },
      { x: lostRight, y: slopeAt(lostRight) - 7 },
      { x: lostRight, y: slopeAt(lostRight) + 7 },
      { x: lostLeft + 6, y: slopeAt(lostLeft) + 4 },
    ],
    STORM_INDIGO,
    0.3
  );
  levels.forEach((y) => {
    for (let x = lostLeft; x < lostRight - 8; x += 13) {
      const t = (x - lostLeft) / (lostRight - lostLeft);
      const pull = Math.min(1, t * 1.6);
      const at = (px: number) => y + (slopeAt(px) - y) * pull + jitter(rnd, 1 + 4 * t);
      if (rnd() < 0.75 - 0.35 * t) handLine(g, rnd, x, at(x), x + 8, at(x + 8), 1.6, STORM_INDIGO_PALE, 0.9 - 0.3 * t);
      else dab(g, rnd, x + 4, at(x + 4), 1.6, STORM_INDIGO_PALE, 0.8);
    }
  });
};

// A sheet of ordered spins, or a piece of one: a dark slab from x1 to x2
// with a row of upright spins inside it, all pointing the same way: chalk
// for a sheet whose spins point up, yellow ochre for one whose spins point
// down.
function sheet(g: G, rnd: Rnd, x1: number, x2: number, y: number, height: number, dir: 1 | -1) {
  const j = () => jitter(rnd, 0.9);
  const slab = [
    { x: x1 + j(), y: y + j() },
    { x: x2 + j(), y: y + j() },
    { x: x2 + j(), y: y + height + j() },
    { x: x1 + j(), y: y + height + j() },
  ];
  g.fillStyle(STORM_INDIGO_DEEP, 0.8);
  g.fillPoints(slab, true);
  handPath(g, rnd, slab, 1.3, STORM_INDIGO, 0.9, true);
  const count = Math.max(1, Math.round((x2 - x1) / 9));
  const step = (x2 - x1) / count;
  for (let i = 0; i < count; i++) {
    spin(g, rnd, x1 + step * (i + 0.5), y + height / 2, height - 3.5, dir, dir > 0 ? CHALK : YELLOW_OCHRE);
  }
}

// A stack of sheets, top to bottom. Each entry is the pieces of one sheet as
// [x1, x2] offsets from `x`; the spins point up in the top sheet and turn
// over from each sheet to the next, which is this material's order: every
// sheet a ferromagnet, the stack an antiferromagnet. An odd number of sheets
// leaves one sheet's moment uncancelled, and that is what lets the stack
// carry a whole number with no field applied.
function stack(g: G, rnd: Rnd, x: number, top: number, height: number, gap: number, sheets: [number, number][][]) {
  sheets.forEach((pieces, row) => {
    for (const [x1, x2] of pieces) {
      sheet(g, rnd, x + x1, x + x2, top + row * (height + gap) + jitter(rnd, 0.5), height, row % 2 === 0 ? 1 : -1);
    }
  });
}

// The third chapter: the Polycrystalline Manganese Bismuth Telluride Golem,
// where the road divides. Its body is five dark sheets stacked: a head, the
// shoulders, the chest with both arms out, a waist with the hands beside
// it, and the legs. In each sheet the spins all point one way, and the way
// turns over from sheet to sheet. Five is odd, and the three sheets that
// point up hold more spins than the two that point down, so the body has a
// moment left over, the same way up as the stack in the release plate. It
// is this moment, not a field, that would quantize it: no field sign is
// painted anywhere on the plate. Every sheet is interrupted, cut into
// pieces with rock showing between them.
const paintLayeredGolem: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const cx = r.x + r.w * 0.5;
  const height = 13;
  const gap = 2.5;
  const top = r.y + (r.h - (5 * height + 4 * gap)) / 2;

  // The road: in from the left, and dividing where the golem stands.
  handLine(g, rnd, r.x + 6, mid, cx - 46, mid, 2.7, STORM_INDIGO_PALE, 0.95);
  for (const side of [-1, 1]) {
    handLine(g, rnd, cx + 46, mid + side * 5, cx + 120, mid + side * 30, 2.7, STORM_INDIGO_PALE, 0.95);
    handLine(g, rnd, cx + 120, mid + side * 30, r.x + r.w - 6, mid + side * 30, 2.7, STORM_INDIGO_PALE, 0.95);
  }

  stack(g, rnd, cx, top, height, gap, [
    [
      [-11, -1.5],
      [1.5, 11],
    ],
    [
      [-24, -9],
      [-6, 24],
    ],
    [
      [-40, -16],
      [-13, 12],
      [15, 40],
    ],
    [
      [-39, -30],
      [-15, 4],
      [7, 15],
      [30, 39],
    ],
    [
      [-21, -13],
      [-10.5, -4],
      [4, 21],
    ],
  ]);
};

// The last chapter of the world, read left to right. First the sheets as
// they stood, every one interrupted. Then the same five sheets whole, each
// row of spins unbroken and turning over from sheet to sheet, and beside
// them one loop that closes on itself with a single tally stroke: the stack
// carries a whole number again, and the number is one. No figure stands
// here. On the right, the land ahead: an open glacier, flat pale ice with
// two small pits in it.
const paintSheetsSettle: PlatePainter = (g, r, rnd) => {
  const height = 11;
  const gap = 3;
  const top = r.y + (r.h - (5 * height + 4 * gap)) / 2;

  stack(g, rnd, r.x + 50, top, height, gap, [
    [
      [-38, -13],
      [-9, 12],
      [16, 38],
    ],
    [
      [-38, -3],
      [1, 38],
    ],
    [
      [-38, -20],
      [-16, 19],
      [23, 38],
    ],
    [
      [-38, 8],
      [12, 38],
    ],
    [
      [-38, -8],
      [-4, 38],
    ],
  ]);

  const wholeX = r.x + r.w * 0.38;
  stack(g, rnd, wholeX, top, height, gap, [[[-38, 38]], [[-38, 38]], [[-38, 38]], [[-38, 38]], [[-38, 38]]]);

  const loopX = wholeX + 68;
  const loopY = r.y + r.h / 2 - 8;
  closedLoop(g, rnd, loopX, loopY, 12, 1.9, STORM_INDIGO_PALE);
  tally(g, rnd, loopX, loopY + 26, 11, CHALK);

  // The glacier ahead.
  const iceLeft = r.x + r.w * 0.72;
  const iceRight = r.x + r.w - 6;
  const iceTop = r.y + 30;
  const iceFloor = r.y + r.h - 12;
  const iceW = iceRight - iceLeft;
  const iceH = iceFloor - iceTop;
  wash(
    g,
    rnd,
    [
      { x: iceLeft + 6, y: iceTop + 2 },
      { x: iceLeft + iceW * 0.45, y: iceTop - 2 },
      { x: iceRight - 8, y: iceTop + 1 },
      { x: iceRight, y: iceTop + iceH * 0.5 },
      { x: iceRight - 5, y: iceFloor },
      { x: iceLeft + iceW * 0.5, y: iceFloor + 2 },
      { x: iceLeft + 9, y: iceFloor - 1 },
      { x: iceLeft, y: iceTop + iceH * 0.55 },
    ],
    ICE_CYAN,
    0.38
  );
  for (const [fx, fy] of [
    [0.3, 0.42],
    [0.72, 0.62],
  ]) {
    const x = iceLeft + iceW * fx;
    const y = iceTop + iceH * fy;
    dab(g, rnd, x, y, 3.4, STORM_INDIGO_DEEP, 0.9);
    closedLoop(g, rnd, x, y, 5.6, 1.4, ICE_CYAN, 0.95);
  }
};

export const PLATES: Record<string, PlatePainter> = {
  '4-history': paintForkAndLevels,
  '4-decoherence': paintScrambledLoops,
  '4-pass': paintLayeredGolem,
  '4-release': paintSheetsSettle,
};
