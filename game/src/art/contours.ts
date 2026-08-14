// Smoothed walkable/non-walkable boundary geometry for the overworld ground
// plane. The grid itself stays a plain integer tile grid (OverworldScene's
// movement, encounters and wall extrusion all read it unchanged) -- this
// module only decides what *shape* each tile's ground fill is drawn as, so a
// path edge that turns reads as a curve rather than a stair-step of
// axis-aligned quads.
//
// Everything here is in continuous tile space and camera-independent: tile
// (x, y) spans [x - 0.5, x + 0.5] x [y - 0.5, y + 0.5], and lattice corner
// (i, j) sits at (i - 0.5, j - 0.5). OverworldScene builds this once per
// world-state alongside its terrain plan and only projects the result each
// frame.

export interface ContourPoint {
  x: number;
  y: number;
}

export interface ContourShadow {
  band: number; // 0 = nearest the boundary (darkest)
  points: ContourPoint[];
}

export interface TileContour {
  // The tile's ground-plane outline, wound the same way OverworldScene's
  // plain quad is (far-left, far-right, near-right, near-left) so the two are
  // interchangeable at the draw call.
  outline: ContourPoint[];
  // Soft contact-shadow strips hugging this tile's share of the boundary, one
  // strip per band per unbroken run of boundary sides. On a walkable tile they
  // lie just inside the floor; on a solid tile they cover the sliver of its
  // top that overhangs the boundary, so the same junction is shaded from both
  // sides. A run is one strip rather than one per side precisely so two strips
  // can never overlap at a turn and stack their alphas into an ink blot.
  shadow: ContourShadow[];
  // The walkable side's lit lip, just inside the shadow: a polyline per run of
  // boundary sides, stroked pale so the floor catches an edge light against
  // the darker mass beyond it. Empty on a solid tile.
  rim: ContourPoint[][];
}

// How far the smoothed boundary is pulled toward the walkable side of the
// grid line before any smoothing. This bias is what lets the curve move in
// *both* directions during smoothing while never entering a solid tile's
// footprint -- which in turn is what keeps extruded wall faces (drawn from the
// untouched grid line) exactly where they always were. Without it only convex
// corners could move, and a diagonal staircase would smooth into a scallop
// instead of a diagonal.
const INSET = 0.25;
// Per-axis cap on how far a lattice corner may travel, kept under half a tile
// so a deformed tile polygon can never fold over itself.
const MAX_OFFSET = 0.45;
const SMOOTH_ITERATIONS = 3;
const SMOOTH_LAMBDA = 0.5;
// Sub-segments each boundary tile-edge is drawn as. Both tiles sharing the
// edge use the same sub-points, so the curve is watertight.
const EDGE_SUBDIVISIONS = 4;
// Contact-shadow band depths, measured from the boundary curve. The walkable
// side gets two stacked bands for a soft falloff; the solid side gets one
// covering its whole overhang.
const FLOOR_SHADOW_BANDS: Array<[number, number]> = [
  [0, 0.13],
  [0.13, 0.3],
];
const SOLID_SHADOW_BANDS: Array<[number, number]> = [[0, INSET]];
// How far inside the boundary the lit lip runs -- inside the darkest shadow
// band's own start, so the two read as one edge rather than two lines.
const RIM_OFFSET = 0.045;

interface BoundaryEdge {
  a: number; // lattice corner index
  b: number;
  nx: number; // inward normal (toward the walkable side), axis-aligned unit
  ny: number;
  // The straight grid line this edge lies on, as a tile-space coordinate on
  // the normal axis -- smoothed points may never cross to its outward side.
  base: number;
  subs: ContourPoint[]; // interior points, ordered from `a` toward `b`
}

export function buildContourGrid(walkable: boolean[][], gridW: number, gridH: number): (TileContour | null)[][] {
  const walk = (x: number, y: number) => x >= 0 && y >= 0 && x < gridW && y < gridH && !!walkable[y]?.[x];
  const stride = gridW + 1;
  const idx = (i: number, j: number) => j * stride + i;
  const cornerCount = stride * (gridH + 1);

  const edges: BoundaryEdge[] = [];
  const horizontalEdge = new Int32Array(cornerCount).fill(-1);
  const verticalEdge = new Int32Array(cornerCount).fill(-1);

  for (let j = 0; j <= gridH; j++) {
    for (let i = 0; i <= gridW; i++) {
      // Horizontal edge (i,j)-(i+1,j) separates tile (i, j-1) from tile (i, j).
      if (i < gridW && walk(i, j - 1) !== walk(i, j)) {
        horizontalEdge[idx(i, j)] = edges.length;
        edges.push({ a: idx(i, j), b: idx(i + 1, j), nx: 0, ny: walk(i, j) ? 1 : -1, base: j - 0.5, subs: [] });
      }
      // Vertical edge (i,j)-(i,j+1) separates tile (i-1, j) from tile (i, j).
      if (j < gridH && walk(i - 1, j) !== walk(i, j)) {
        verticalEdge[idx(i, j)] = edges.length;
        edges.push({ a: idx(i, j), b: idx(i, j + 1), nx: walk(i, j) ? 1 : -1, ny: 0, base: i - 0.5, subs: [] });
      }
    }
  }
  if (edges.length === 0) return [];

  // Per-corner incidence is all the adjacency the smoothing needs: an ordinary
  // boundary corner has exactly two edges, while a diagonal pinch has four and
  // stays pinned -- its inward normals cancel, and moving it would disagree
  // between the two regions that share it.
  const incident: number[][] = Array.from({ length: cornerCount }, () => []);
  for (let e = 0; e < edges.length; e++) {
    incident[edges[e].a].push(e);
    incident[edges[e].b].push(e);
  }

  const isBoundary = new Uint8Array(cornerCount);
  const posX = new Float64Array(cornerCount);
  const posY = new Float64Array(cornerCount);
  for (let c = 0; c < cornerCount; c++) {
    if (incident[c].length === 0) continue;
    isBoundary[c] = 1;
    let nx = 0;
    let ny = 0;
    for (const e of incident[c]) {
      nx += edges[e].nx;
      ny += edges[e].ny;
    }
    const len = Math.hypot(nx, ny);
    posX[c] = latticeX(c, stride) + (len > 0 ? (nx / len) * INSET : 0);
    posY[c] = latticeY(c, stride) + (len > 0 ? (ny / len) * INSET : 0);
  }

  const clampCorner = (c: number) => {
    const bx = latticeX(c, stride);
    const by = latticeY(c, stride);
    let dx = posX[c] - bx;
    let dy = posY[c] - by;
    for (const e of incident[c]) {
      if (edges[e].nx !== 0 && dx * edges[e].nx < 0) dx = 0;
      if (edges[e].ny !== 0 && dy * edges[e].ny < 0) dy = 0;
    }
    posX[c] = bx + clamp(dx, -MAX_OFFSET, MAX_OFFSET);
    posY[c] = by + clamp(dy, -MAX_OFFSET, MAX_OFFSET);
  };

  const across = (e: number, c: number) => (edges[e].a === c ? edges[e].b : edges[e].a);

  for (let pass = 0; pass < SMOOTH_ITERATIONS; pass++) {
    const nextX = Float64Array.from(posX);
    const nextY = Float64Array.from(posY);
    for (let c = 0; c < cornerCount; c++) {
      if (!isBoundary[c] || incident[c].length !== 2) continue;
      const p = across(incident[c][0], c);
      const q = across(incident[c][1], c);
      nextX[c] = posX[c] + SMOOTH_LAMBDA * ((posX[p] + posX[q]) / 2 - posX[c]);
      nextY[c] = posY[c] + SMOOTH_LAMBDA * ((posY[p] + posY[q]) / 2 - posY[c]);
    }
    posX.set(nextX);
    posY.set(nextY);
    for (let c = 0; c < cornerCount; c++) if (isBoundary[c]) clampCorner(c);
  }

  // Curve each boundary edge through its own smoothed endpoints, using the
  // next corner along the boundary on either side as the spline's outer
  // control points (centripetal Catmull-Rom, which will not cusp or loop the
  // way the uniform form can on the tight turns a tile grid produces).
  for (const edge of edges) {
    const prev = neighbourAcross(edge.a, edge, incident, edges);
    const next = neighbourAcross(edge.b, edge, incident, edges);
    const p0 = { x: posX[prev], y: posY[prev] };
    const p1 = { x: posX[edge.a], y: posY[edge.a] };
    const p2 = { x: posX[edge.b], y: posY[edge.b] };
    const p3 = { x: posX[next], y: posY[next] };
    for (let k = 1; k < EDGE_SUBDIVISIONS; k++) {
      const p = catmullRom(p0, p1, p2, p3, k / EDGE_SUBDIVISIONS);
      if (edge.ny !== 0) {
        p.x = clamp(p.x, Math.min(p1.x, p2.x), Math.max(p1.x, p2.x));
        p.y = edge.base + clamp((p.y - edge.base) * edge.ny, 0, MAX_OFFSET) * edge.ny;
      } else {
        p.y = clamp(p.y, Math.min(p1.y, p2.y), Math.max(p1.y, p2.y));
        p.x = edge.base + clamp((p.x - edge.base) * edge.nx, 0, MAX_OFFSET) * edge.nx;
      }
      edge.subs.push(p);
    }
  }

  const at = (c: number): ContourPoint =>
    isBoundary[c] ? { x: posX[c], y: posY[c] } : { x: latticeX(c, stride), y: latticeY(c, stride) };

  const grid: (TileContour | null)[][] = [];
  for (let y = 0; y < gridH; y++) {
    const row: (TileContour | null)[] = [];
    for (let x = 0; x < gridW; x++) {
      const corners = [idx(x, y), idx(x + 1, y), idx(x + 1, y + 1), idx(x, y + 1)];
      if (!corners.some((c) => isBoundary[c])) {
        row.push(null);
        continue;
      }
      // Sides in the same winding as the plain quad: far, right, near, left.
      const sides: Array<{ edge: number; forward: boolean }> = [
        { edge: horizontalEdge[idx(x, y)], forward: true },
        { edge: verticalEdge[idx(x + 1, y)], forward: true },
        { edge: horizontalEdge[idx(x, y + 1)], forward: false },
        { edge: verticalEdge[idx(x, y)], forward: false },
      ];
      const seams = sides.map(({ edge: e, forward }) => {
        if (e < 0) return null;
        const seam = [at(edges[e].a), ...edges[e].subs, at(edges[e].b)];
        if (!forward) seam.reverse();
        return seam;
      });

      const outline: ContourPoint[] = [];
      for (let s = 0; s < 4; s++) {
        outline.push(at(corners[s]));
        const seam = seams[s];
        if (seam) for (let k = 1; k < seam.length - 1; k++) outline.push(seam[k]);
      }

      const walkableTile = walk(x, y);
      const bands = walkableTile ? FLOOR_SHADOW_BANDS : SOLID_SHADOW_BANDS;
      const sign = walkableTile ? 1 : -1;
      const shadow: ContourShadow[] = [];
      const rim: ContourPoint[][] = [];
      for (const run of boundaryRuns(sides.map(({ edge: e }) => e))) {
        const chain = buildChain(run, seams, sides, edges);
        bands.forEach(([inner, outer], band) => {
          shadow.push({
            band,
            points: offsetChain(chain, inner * sign).concat(offsetChain(chain, outer * sign).reverse()),
          });
        });
        if (walkableTile) rim.push(offsetChain(chain, RIM_OFFSET));
      }
      row.push({ outline, shadow, rim });
    }
    grid.push(row);
  }
  return grid;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function latticeX(c: number, stride: number): number {
  return (c % stride) - 0.5;
}

function latticeY(c: number, stride: number): number {
  return Math.floor(c / stride) - 0.5;
}

// The boundary corner adjacent to `corner` along the boundary but not through
// `edge` -- the spline control point beyond that end. Falls back to the corner
// itself where the boundary branches (a diagonal pinch), which flattens the
// curve toward that end rather than guessing a direction.
function neighbourAcross(corner: number, edge: BoundaryEdge, incident: number[][], edges: BoundaryEdge[]): number {
  const inc = incident[corner];
  if (inc.length !== 2) return corner;
  for (const e of inc) {
    if (edges[e] === edge) continue;
    return edges[e].a === corner ? edges[e].b : edges[e].a;
  }
  return corner;
}

function catmullRom(p0: ContourPoint, p1: ContourPoint, p2: ContourPoint, p3: ContourPoint, t: number): ContourPoint {
  const step = (a: ContourPoint, b: ContourPoint) => Math.max(1e-4, Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)));
  const t0 = 0;
  const t1 = t0 + step(p0, p1);
  const t2 = t1 + step(p1, p2);
  const t3 = t2 + step(p2, p3);
  const u = t1 + (t2 - t1) * t;
  const mix = (a: ContourPoint, b: ContourPoint, ta: number, tb: number): ContourPoint => {
    const w = (tb - u) / (tb - ta);
    return { x: a.x * w + b.x * (1 - w), y: a.y * w + b.y * (1 - w) };
  };
  const a1 = mix(p0, p1, t0, t1);
  const a2 = mix(p1, p2, t1, t2);
  const a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2);
  const b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

// One entry per point of an unbroken run of boundary sides, carrying the
// direction that point moves in when the run is offset inward. At the join
// between two sides the two normals are summed rather than averaged, which
// makes the offset a proper miter: the offset polyline stays a constant
// perpendicular distance from both sides instead of cutting the corner.
interface ChainPoint {
  p: ContourPoint;
  nx: number;
  ny: number;
}

// The tile's boundary sides grouped into maximal runs of consecutive sides
// (cyclically, so a run may wrap from side 3 back to side 0). A tile whose
// four sides are all boundary yields one closed run.
function boundaryRuns(sideEdges: number[]): number[][] {
  const present = sideEdges.map((e) => e >= 0);
  const count = present.filter(Boolean).length;
  if (count === 0) return [];
  if (count === 4) return [[0, 1, 2, 3]];
  let start = 0;
  while (present[start] || !present[(start + 1) % 4]) {
    start++;
    if (start >= 4) return [];
  }
  const runs: number[][] = [];
  let current: number[] = [];
  for (let k = 1; k <= 4; k++) {
    const s = (start + k) % 4;
    if (present[s]) {
      current.push(s);
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

function buildChain(
  run: number[],
  seams: (ContourPoint[] | null)[],
  sides: Array<{ edge: number; forward: boolean }>,
  edges: BoundaryEdge[]
): ChainPoint[] {
  const closed = run.length === 4;
  // A side's inward normal in the tile's own traversal order; `forward` does
  // not affect it, since the normal points at the walkable region either way.
  const normal = (s: number) => ({ nx: edges[sides[s].edge].nx, ny: edges[sides[s].edge].ny });
  const chain: ChainPoint[] = [];
  run.forEach((s, i) => {
    const seam = seams[s]!;
    const n = normal(s);
    const joined = i > 0 ? normal(run[i - 1]) : closed ? normal(run[run.length - 1]) : null;
    chain.push({ p: seam[0], nx: n.nx + (joined?.nx ?? 0), ny: n.ny + (joined?.ny ?? 0) });
    for (let k = 1; k < seam.length - 1; k++) chain.push({ p: seam[k], nx: n.nx, ny: n.ny });
    if (i === run.length - 1 && !closed) chain.push({ p: seam[seam.length - 1], nx: n.nx, ny: n.ny });
  });
  return chain;
}

function offsetChain(chain: ChainPoint[], distance: number): ContourPoint[] {
  return chain.map(({ p, nx, ny }) => ({ x: p.x + nx * distance, y: p.y + ny * distance }));
}
