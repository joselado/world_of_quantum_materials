import { CHARCOAL, CHALK, RED_OCHRE, YELLOW_OCHRE, dab, handLine, handPath, handRing, jitter, lozenge } from './brush';
import type { G, PlatePainter, Rnd } from './brush';

// The Devouring Mirror: no sun, no ground of its own, only the light of the
// network on near-black rock. Its earth is a silver-violet, and a deeper
// violet for the thin lines the mind draws to what it watches. Three pigments
// keep their meaning on all six plates: chalk is the traveler, the ochres are
// the worlds behind and their physics, and violet is the mind that learned
// them.
const SILVER_VIOLET = 0xb9aee0;
const DEEP_VIOLET = 0x8474c4;

type Pt = { x: number; y: number };

// A loop that shuts, for an orbit or a vacancy.
function closedLoop(g: G, rnd: Rnd, x: number, y: number, radius: number, width: number, color: number, alpha = 0.9) {
  const steps = Math.max(8, Math.round(radius * 1.8));
  const start = rnd() * Math.PI * 2;
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const a = start + (i / steps) * Math.PI * 2;
    const rr = radius + jitter(rnd, Math.min(0.5, radius * 0.1));
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  g.lineStyle(width, color, alpha);
  g.strokePoints(pts, true, true);
}

// The sign each world behind is kept by, one law each, about ten across:
// 1 a stalk of wheat (the field that chose), 2 a column (the repetition),
// 3 a seam between two domains, 4 a closed orbit, 5 a wave (one phase),
// 6 a tilted spin, 7 two rails and their rungs (the bonds of the web), 8 an
// arrow that splits in two (the excitation that comes apart), 9 a vacancy
// among its neighbors.
function worldSign(g: G, rnd: Rnd, world: number, x: number, y: number, color: number, alpha = 0.95) {
  const w = 1.5;
  g.lineStyle(w, color, alpha);
  switch (world) {
    case 1:
      handLine(g, rnd, x, y + 5, x, y - 5, w, color, alpha);
      g.lineStyle(1.3, color, alpha);
      for (const k of [0, 3.2]) {
        g.lineBetween(x, y - 5 + k, x - 3, y - 2 + k);
        g.lineBetween(x, y - 5 + k, x + 3, y - 2 + k);
      }
      break;
    case 2:
      g.fillStyle(color, alpha);
      for (let k = 0; k < 3; k++) g.fillRect(x - 2.2 + jitter(rnd, 0.4), y - 3 + k * 3.3, 4.4, 2.5);
      g.fillRect(x - 4.4, y - 6, 8.8, 2.1);
      break;
    case 3:
      g.fillStyle(color, alpha * 0.32);
      g.fillRect(x - 6.5, y - 4.5, 5, 9);
      g.fillStyle(color, alpha * 0.14);
      g.fillRect(x + 1.5, y - 4.5, 5, 9);
      handLine(g, rnd, x - 0.4, y - 6, x + 0.4, y + 6, 1.8, color, 1);
      break;
    case 4:
      closedLoop(g, rnd, x, y, 4.6, w, color, alpha);
      break;
    case 5: {
      const pts: Pt[] = [];
      for (let i = 0; i <= 10; i++) pts.push({ x: x - 7 + i * 1.4, y: y + Math.sin((i / 10) * Math.PI * 3) * 3 });
      g.strokePoints(pts, false);
      break;
    }
    case 6:
      handLine(g, rnd, x - 3, y + 5, x + 3, y - 5, w, color, alpha);
      g.lineStyle(1.4, color, alpha);
      g.lineBetween(x + 3, y - 5.5, x - 1.6, y - 3.4);
      g.lineBetween(x + 3, y - 5.5, x + 3.6, y - 0.6);
      break;
    case 7:
      handLine(g, rnd, x - 3.4, y - 6.5, x - 3.4, y + 6.5, w, color, alpha);
      handLine(g, rnd, x + 3.4, y - 6.5, x + 3.4, y + 6.5, w, color, alpha);
      g.lineStyle(1.3, color, alpha);
      for (const dy of [-3.8, 0, 3.8]) g.lineBetween(x - 3.4, y + dy, x + 3.4, y + dy);
      break;
    case 8:
      // One stroke coming in from the left, two arrows going on apart.
      g.lineStyle(w, color, alpha);
      g.lineBetween(x - 7, y, x - 2, y);
      for (const s of [-1, 1]) {
        g.lineBetween(x - 2, y, x + 5.5, y + s * 5.5);
        g.fillStyle(color, alpha);
        g.fillTriangle(x + 7, y + s * 7, x + 2.4, y + s * 5.8, x + 5.8, y + s * 2.4);
      }
      break;
    default:
      closedLoop(g, rnd, x, y, 2.3, 1.3, color, alpha);
      for (const [dx, dy] of [
        [-5.4, 0],
        [5.4, 0],
        [0, -5.4],
        [0, 5.4],
      ]) {
        g.fillStyle(color, alpha);
        g.fillCircle(x + dx, y + dy, 1.4);
      }
  }
}

// The four corners of the traveler's sign, as `lozenge` in brush.ts has them.
function lozengeCorners(x: number, y: number, size: number): { top: Pt; right: Pt; bottom: Pt; left: Pt } {
  return {
    top: { x, y: y - size },
    right: { x: x + size * 0.72, y },
    bottom: { x, y: y + size },
    left: { x: x - size * 0.72, y },
  };
}

// The network that holds the traveler: the lozenge and its two facet marks
// traced by links, with a node at each corner, at the middle and along every
// edge. Nothing in it wobbles. It is a record, and a record is definite.
function lozengeNetwork(g: G, x: number, y: number, size: number, link: number, node: number, linkAlpha: number, nodeRadius: number) {
  const c = lozengeCorners(x, y, size);
  const centre = { x, y };
  const between = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const nodes: Pt[] = [c.top, c.right, c.bottom, c.left, centre];
  const edges: [Pt, Pt][] = [
    [c.top, c.right],
    [c.right, c.bottom],
    [c.bottom, c.left],
    [c.left, c.top],
  ];
  g.lineStyle(1.5, link, linkAlpha);
  for (const [a, b] of edges) {
    g.lineBetween(a.x, a.y, b.x, b.y);
    nodes.push(between(a, b, 1 / 3), between(a, b, 2 / 3));
  }
  g.lineBetween(c.left.x, c.left.y, c.right.x, c.right.y);
  g.lineBetween(c.top.x, c.top.y, centre.x, centre.y);
  nodes.push(between(c.left, centre, 0.5), between(centre, c.right, 0.5), between(c.top, centre, 0.5));
  // The weights inside it: each node on an edge is tied to the nearest node
  // on a facet mark.
  g.lineStyle(1.3, link, linkAlpha * 0.6);
  const tie = (a: Pt, b: Pt) => g.lineBetween(a.x, a.y, b.x, b.y);
  tie(between(c.top, c.right, 1 / 3), between(c.top, centre, 0.5));
  tie(between(c.left, c.top, 2 / 3), between(c.top, centre, 0.5));
  tie(between(c.top, c.right, 2 / 3), between(centre, c.right, 0.5));
  tie(between(c.left, c.top, 1 / 3), between(c.left, centre, 0.5));
  tie(between(c.right, c.bottom, 1 / 3), between(centre, c.right, 0.5));
  tie(between(c.bottom, c.left, 2 / 3), between(c.left, centre, 0.5));
  tie(between(c.right, c.bottom, 2 / 3), centre);
  tie(between(c.bottom, c.left, 1 / 3), centre);
  for (const p of nodes) {
    g.fillStyle(node, 1);
    g.fillCircle(p.x, p.y, nodeRadius);
  }
}

// A piece of the mind's network: nodes joined by links, laid flat.
function network(g: G, rnd: Rnd, nodes: Pt[], links: [number, number][], linkAlpha = 0.7, nodeRadius = 2) {
  for (const [a, b] of links) handLine(g, rnd, nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, 1.4, SILVER_VIOLET, linkAlpha);
  for (const p of nodes) dab(g, rnd, p.x, p.y, nodeRadius, SILVER_VIOLET, 1);
}

// The Devouring Mirror's first chapter. Far left: the road going in, every
// mark on it pointing the same way, since nothing comes back out. Then the
// nine worlds behind, each kept by one sign because each stood on one law, in
// a row that steps down the rock as the light did along the road. From every
// sign one thin line runs to the same network: it obeys no law of its own, it
// was built by watching all of theirs.
const paintBuiltByWatching: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;

  // The road in: two edges and the marks of one who walked it, all one way.
  handLine(g, rnd, r.x + 2, r.y + 58, r.x + 50, r.y + 62, 1.5, CHALK, 0.6);
  handLine(g, rnd, r.x + 2, r.y + 80, r.x + 50, r.y + 74, 1.5, CHALK, 0.6);
  for (let i = 0; i < 4; i++) {
    const x = r.x + 9 + i * 11;
    g.lineStyle(1.5, CHALK, 0.9);
    g.lineBetween(x, r.y + 65, x + 4.5, r.y + 68.5);
    g.lineBetween(x + 4.5, r.y + 68.5, x, r.y + 72);
  }

  // The network the lines converge on: nine nodes facing the worlds, then
  // fewer, then fewer.
  const layers = [9, 5, 3];
  const netX = r.x + 318;
  const nodes: Pt[] = [];
  const first: number[] = [];
  layers.forEach((count, layer) => {
    for (let i = 0; i < count; i++) {
      const spread = layer === 0 ? 6 : layer === 1 ? 9 : 12;
      if (layer === 0) first.push(nodes.length);
      nodes.push({ x: netX + layer * 34 + jitter(rnd, 2), y: mid + (i - (count - 1) / 2) * spread + jitter(rnd, 1.2) });
    }
  });
  const links: [number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const below = Math.min(4, Math.floor(i / 2));
    links.push([i, 9 + below]);
    if (i % 2 === 1 && below + 1 <= 4) links.push([i, 9 + below + 1]);
  }
  for (let i = 0; i < 5; i++) {
    const below = Math.min(2, Math.floor(i / 2));
    links.push([9 + i, 14 + below]);
    if (i % 2 === 1) links.push([9 + i, 14 + below + 1]);
  }

  // The nine signs, and from each one its line to the node that watches it.
  for (let i = 0; i < 9; i++) {
    const x = r.x + 74 + i * 21;
    const y = r.y + 9 + i * 8.6;
    const to = nodes[first[i]];
    handLine(g, rnd, x + 9, y - 1, to.x - 3, to.y, 1.3, DEEP_VIOLET, 0.6);
    worldSign(g, rnd, i + 1, x, y, YELLOW_OCHRE);
  }
  network(g, rnd, nodes, links, 0.7, 2);
};

// A golem as the rock keeps one from far off: a head, a trunk and two legs,
// blocky and plain.
function golemMark(g: G, rnd: Rnd, x: number, y: number) {
  g.fillStyle(RED_OCHRE, 0.95);
  g.fillRect(x - 2.6 + jitter(rnd, 0.4), y - 9, 5.2, 4.4);
  g.fillRect(x - 5.2 + jitter(rnd, 0.4), y - 4, 10.4, 8);
  g.fillRect(x - 5 + jitter(rnd, 0.3), y + 4.4, 3.4, 4.6);
  g.fillRect(x + 1.6 + jitter(rnd, 0.3), y + 4.4, 3.4, 4.6);
}

// The Devouring Mirror's second chapter, the reveal. Top: the nine golems in
// a line, each one plain and apart from the next, each only the physics of its
// own world. The traveler's path runs along the row and past every one of
// them, to where the traveler now stands beyond the ninth. Below, apart: the
// network. It stands in no fight and nothing joins it to a golem: the golems
// were never its agents. What it learned was the traveler, so each lesson is
// a thin line that leaves the path at the place the traveler stood once a
// rival was down, marked by a small chalk ring, and comes down into a node of
// its own.
const paintOnlyWatched: PlatePainter = (g, r, rnd) => {
  const rowY = r.y + 17;
  const first = r.x + 30;
  const gap = 37;

  // The path, a row of chalk dots between the golems, and the traveler.
  for (let i = 0; i <= 9; i++) {
    const x0 = first + (i - 1) * gap;
    for (const k of [0.3, 0.5, 0.7]) {
      const x = x0 + gap * k;
      // The middle of each gap past a golem is where the traveler stood: a
      // ring is painted there below, and a dot inside a ring reads as an eye.
      if (x < r.x + 4 || (i >= 1 && k === 0.5)) continue;
      g.fillStyle(CHALK, 0.85);
      g.fillCircle(x + jitter(rnd, 0.5), rowY + jitter(rnd, 0.6), 1.1);
    }
  }
  lozenge(g, rnd, first + 9 * gap + 6, rowY, 9, CHALK);

  // The network: nine nodes, one under each place the traveler stood after a
  // fight, then two rows that draw in.
  const stood = (i: number) => first + (i + 0.5) * gap;
  const nodes: Pt[] = [];
  for (let i = 0; i < 9; i++) nodes.push({ x: stood(i) + jitter(rnd, 1), y: r.y + 54 + jitter(rnd, 1) });
  for (let i = 0; i < 8; i++) nodes.push({ x: stood(i) + gap * 0.5 + jitter(rnd, 1.5), y: r.y + 68 + jitter(rnd, 1) });
  for (let i = 0; i < 4; i++) nodes.push({ x: stood(2 * i) + gap + jitter(rnd, 1.5), y: r.y + 81 + jitter(rnd, 1) });
  const links: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    links.push([i, 9 + i], [i + 1, 9 + i]);
    links.push([9 + i, 17 + Math.floor(i / 2)]);
  }

  for (let i = 0; i < 9; i++) {
    handLine(g, rnd, stood(i), rowY + 4.5, nodes[i].x, nodes[i].y - 3, 1.3, DEEP_VIOLET, 0.6);
    handRing(g, rnd, stood(i), rowY, 3.2, 1.1, CHALK, 0.9);
    golemMark(g, rnd, first + i * gap, rowY);
  }
  network(g, rnd, nodes, links, 0.65, 2);
};

// The traveler's sign with nothing left to the hand: straight edges, both
// facet marks, the corners where `lozenge` puts them.
function hardLozenge(g: G, x: number, y: number, size: number, color: number, alpha: number, fill: number) {
  const c = lozengeCorners(x, y, size);
  const pts = [c.top, c.right, c.bottom, c.left];
  if (fill > 0) {
    g.fillStyle(color, fill);
    g.fillPoints(pts, true);
  }
  g.lineStyle(1.8, color, alpha);
  g.strokePoints(pts, true, true);
}

// The Devouring Mirror's third chapter: what learning costs. Left: a quantum
// thing in superposition, the traveler's sign drawn twice, two faint outlines
// a little apart and neither one solid. Middle: the measurement, one stroke
// from it. Right: what the measurement leaves, a record of which state it was
// in. One sign, hard-edged and filled, set among rows of tally strokes: the
// way a wall keeps a count. Nothing on that side is doubled, because nothing
// on record is still in superposition.
const paintTheRecord: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;

  const both = { x: r.x + 62, y: mid };
  lozenge(g, rnd, both.x - 7, both.y - 2, 26, CHALK, 0.5);
  lozenge(g, rnd, both.x + 8, both.y + 2, 26, CHALK, 0.5);

  // The measurement: one stroke, from the thing to the record.
  handLine(g, rnd, r.x + 116, mid, r.x + 236, mid, 2, SILVER_VIOLET, 0.95);
  g.lineStyle(1.8, SILVER_VIOLET, 0.95);
  g.lineBetween(r.x + 237, mid, r.x + 229, mid - 5);
  g.lineBetween(r.x + 237, mid, r.x + 229, mid + 5);

  // The record: tally strokes in rows, and the one definite sign among them.
  const kept = { x: r.x + 338, y: mid };
  const size = 24;
  for (let row = 0; row < 5; row++) {
    const y = mid + (row - 2) * 17;
    for (let x = r.x + 266; x <= r.x + 412; x += 7) {
      // The rows part round the sign and close again past it.
      const reach = size * 0.72 * (1 - Math.min(1, Math.abs(y - kept.y) / (size + 9))) + 8;
      if (Math.abs(x - kept.x) < reach) continue;
      g.lineStyle(1.5, SILVER_VIOLET, 0.75);
      g.lineBetween(x + jitter(rnd, 0.4), y - 4.5, x + jitter(rnd, 0.4), y + 4.5);
    }
  }
  hardLozenge(g, kept.x, kept.y, size, SILVER_VIOLET, 1, 0.92);
  // Its two facet marks, cut into the fill in the rock's own dark.
  const c = lozengeCorners(kept.x, kept.y, size);
  g.lineStyle(1.4, CHARCOAL, 0.9);
  g.lineBetween(c.left.x + 2, c.left.y, c.right.x - 2, c.right.y);
  g.lineBetween(c.top.x, c.top.y + 2, kept.x, kept.y);
};

// The Adapted in its pass. No golem stands here. Two signs face each other
// across the middle of the plate: on the left the traveler in chalk, drawn by
// hand, its corners a little off and leaning in; on the right its copy in
// silver-violet, the exact mirror image of that same uneven shape, corner for
// corner, but ruled, heavier and filled. The copy looks more certain than the
// thing it copied. Behind the copy lie a few links of the network it was made
// from. The rock between the two is bare.
const paintTheAdapted: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const axis = r.x + r.w / 2;
  const off = 62;
  const size = 30;
  // The traveler's own corners, off true the way a hand leaves them. The copy
  // takes the same offsets, reflected in the axis between the two.
  const lean: Pt[] = [
    { x: 3.2, y: -size + 1 },
    { x: size * 0.72 + 1.2, y: 2.4 },
    { x: -1.6, y: size - 1.5 },
    { x: -size * 0.72 + 1.8, y: -1.8 },
  ];
  const heart = { x: 1, y: 0.6 };

  const mine = lean.map((p) => ({ x: axis - off + p.x, y: mid + p.y }));
  handPath(g, rnd, mine, 1.6, CHALK, 0.95, true);
  handLine(g, rnd, mine[3].x, mine[3].y, mine[1].x, mine[1].y, 1.3, CHALK, 0.8);
  handLine(g, rnd, mine[0].x, mine[0].y, axis - off + heart.x, mid + heart.y, 1.3, CHALK, 0.8);

  // The network behind the copy.
  const back: Pt[] = [
    { x: axis + off + 40, y: mid - 26 },
    { x: axis + off + 66, y: mid - 8 },
    { x: axis + off + 44, y: mid + 6 },
    { x: axis + off + 74, y: mid + 24 },
    { x: axis + off + 104, y: mid - 20 },
    { x: axis + off + 110, y: mid + 8 },
  ].map((p) => ({ x: p.x + jitter(rnd, 1.5), y: p.y + jitter(rnd, 1.5) }));
  network(
    g,
    rnd,
    back,
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
      [1, 5],
      [3, 5],
      [4, 5],
    ],
    0.5,
    1.9
  );
  g.lineStyle(1.3, SILVER_VIOLET, 0.5);
  g.lineBetween(back[2].x, back[2].y, axis + off + 24, mid + 3);
  g.lineBetween(back[0].x, back[0].y, axis + off + 16, mid - 12);

  const copy = lean.map((p) => ({ x: axis + off - p.x, y: mid + p.y }));
  g.fillStyle(SILVER_VIOLET, 0.3);
  g.fillPoints(copy, true);
  g.lineStyle(2.2, SILVER_VIOLET, 1);
  g.strokePoints(copy, true, true);
  g.lineStyle(1.6, SILVER_VIOLET, 1);
  g.lineBetween(copy[3].x, copy[3].y, copy[1].x, copy[1].y);
  g.lineBetween(copy[0].x, copy[0].y, axis + off - heart.x, mid + heart.y);
};

// A shard of the form that came apart: an angular piece, falling.
function shard(g: G, rnd: Rnd, x: number, y: number, size: number, turn: number) {
  const pts: Pt[] = [];
  const corners = 3 + (rnd() < 0.5 ? 1 : 0);
  for (let i = 0; i < corners; i++) {
    const a = turn + (i / corners) * Math.PI * 2 + jitter(rnd, 0.3);
    const far = size * (0.7 + rnd() * 0.5);
    pts.push({ x: x + Math.cos(a) * far, y: y + Math.sin(a) * far * 1.25 });
  }
  g.fillStyle(SILVER_VIOLET, 0.28);
  g.fillPoints(pts, true);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    handLine(g, rnd, a.x, a.y, b.x, b.y, 1.4, SILVER_VIOLET, 0.85);
  }
  // The way it came: a short stroke above it.
  handLine(g, rnd, x + jitter(rnd, 1), y - size * 1.5 - 7, x + jitter(rnd, 1), y - size * 1.5 - 1, 1.3, DEEP_VIOLET, 0.55);
}

// The finale's second stage, The Model of You. Left: the shards of the form
// that reshaped around every blow, falling, and nothing annealing out of them.
// Standing where a golem would stand: a network in the exact shape of the
// traveler's sign, a node at each corner, at the middle and along the edges,
// the links tracing the outline and both facet marks. Its links are violet and
// every node is lit in chalk, the traveler's own colour. It is ruled, not
// drawn by hand, because it is a record and will not reshape again.
const paintTheModel: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const fall: [number, number, number][] = [
    [40, 20, 7],
    [70, 46, 10],
    [104, 24, 7],
    [126, 62, 9],
    [44, 70, 8],
    [156, 38, 6.5],
    [92, 76, 6.5],
    [180, 70, 5.5],
  ];
  for (const [dx, dy, size] of fall) shard(g, rnd, r.x + dx + jitter(rnd, 2), r.y + dy + jitter(rnd, 2), size, rnd() * Math.PI);

  lozengeNetwork(g, r.x + 292, mid, 38, SILVER_VIOLET, CHALK, 0.95, 2.2);
};

// The finale's third stage, The Quantum Adapted. The pass is full of smoke
// that does not rise: a wide, low bank of pale dabs with sparks in it. The
// record still burns inside, the same network in the traveler's shape, and no
// second body is painted, because what stands here is not a copy. It is the
// thing that did the measuring. Around it and in it are the excitations of the
// worlds behind, a wave, an arrow that splits, an orbit, a tilted spin, each
// joined to its neighbor and to the network by a thin line: everything it
// consumed, entangled with the record and with each other, all at once.
const paintTheBath: PlatePainter = (g, r, rnd) => {
  const mid = r.y + r.h / 2;
  const cx = r.x + r.w / 2;
  const floor = r.y + r.h - 3;

  const size = 23;
  const at = { x: cx, y: mid + 9 };

  // The smoke: a low, wide bank, densest along the ground and flat on top.
  // It stands no higher than the record inside it.
  for (let i = 0; i < 110; i++) {
    const t = rnd();
    const spread = (rnd() - 0.5) * 2;
    const x = cx + spread * 186 * (1 - t * 0.3);
    const y = floor - 6 - t * 44;
    const rx = 13 + rnd() * 16;
    const ry = (rx * (0.6 + rnd() * 0.3)) / 2;
    g.fillStyle(i % 3 === 0 ? CHALK : SILVER_VIOLET, 0.05 + rnd() * 0.06);
    g.fillEllipse(Math.max(r.x + rx, Math.min(r.x + r.w - rx, x)), Math.min(y, r.y + r.h - ry), rx * 2, ry * 2);
  }

  // What it consumed. Each sign is tied to the next one round the record and
  // to a node of the record itself.
  const c = lozengeCorners(at.x, at.y, size);
  const part = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const signs: { world: number; at: Pt; to: Pt }[] = [
    { world: 5, at: { x: cx - 128, y: mid + 24 }, to: c.left },
    { world: 8, at: { x: cx - 84, y: mid - 20 }, to: part(c.left, c.top, 2 / 3) },
    { world: 4, at: { x: cx + 84, y: mid - 20 }, to: part(c.top, c.right, 1 / 3) },
    { world: 6, at: { x: cx + 128, y: mid + 24 }, to: c.right },
  ];
  const tie = (a: Pt, b: Pt, clearA: number, clearB: number, alpha: number) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    handLine(g, rnd, a.x + ux * clearA, a.y + uy * clearA, b.x - ux * clearB, b.y - uy * clearB, 1.4, DEEP_VIOLET, alpha);
  };
  for (let i = 0; i + 1 < signs.length; i++) tie(signs[i].at, signs[i + 1].at, 10, 10, 0.8);
  for (const s of signs) tie(s.at, s.to, 10, 3.5, 0.8);
  for (const s of signs) worldSign(g, rnd, s.world, s.at.x, s.at.y, YELLOW_OCHRE);

  // The record, burning in the smoke.
  lozengeNetwork(g, at.x, at.y, size, SILVER_VIOLET, CHALK, 0.95, 2);

  // Sparks.
  for (let i = 0; i < 30; i++) {
    const x = cx + (rnd() - 0.5) * 340;
    const y = floor - 4 - rnd() * 44;
    g.fillStyle(i % 2 === 0 ? CHALK : YELLOW_OCHRE, 0.95);
    g.fillCircle(x, y, 1.1);
  }
};

export const PLATES: Record<string, PlatePainter> = {
  '10-history': paintBuiltByWatching,
  '10-decoherence': paintOnlyWatched,
  '10-record': paintTheRecord,
  '10-pass': paintTheAdapted,
  '10-stage2': paintTheModel,
  '10-stage3': paintTheBath,
};
