import Phaser from 'phaser';

// Phaser runs every filled path through earcut, a general polygon
// triangulator, on every frame the shape is drawn. A shape whose triangles
// are already known pays a general algorithm for an answer that is fixed, and
// the terrain draws well over a thousand fills a frame -- earcut was the
// single largest cost in the paint pass. So every fill here says what it
// knows about its own triangles:
//
// - A projected terrain tile is a convex quad: two triangles, always.
// - A point list may carry its own triangulation (`TriangulatedPoints.tris`),
//   worked out once for a shape that is only ever moved, scaled or projected
//   afterwards: a traced tile outline and its shadow strips (terrain/paint.ts),
//   a tree crown (art/trees.ts). A triangulation survives every one of those
//   maps -- the ground projection included, which carries straight lines to
//   straight lines -- so the triangles of the shape as drawn are the triangles
//   of the shape as stored, and cover exactly the pixels earcut's would.
// - A convex shape is a fan from its first point (fillConvex), which is also
//   how every ellipse and dot is filled (fillOval).
//
// The known triangles are used under WebGL only. The Canvas renderer has no
// triangulator to save -- it fills a path natively -- and it antialiases the
// shared edge of two abutting triangles on both sides, which leaves a hairline
// through every translucent fill split into more than one. So a Canvas frame
// fills these as paths. The quad is two triangles under both renderers:
// Canvas tiles are opaque, and art/canvasRenderer.ts seals same-colour opaque
// triangles together.
export type TriangulatedPoints<P extends { x: number; y: number } = { x: number; y: number }> = P[] & { tris?: number[] };

// Fills a polygon whose points run in order around it. Four points are taken
// to be a convex quad (every projected tile is one); a shape that can be
// concave carries at least seven (a traced outline has its four corners plus
// EDGE_SUBDIVISIONS-1 points along every boundary edge, art/contours.ts), and
// takes its own triangulation if it brought one, the general path if not.
export function fillPolygon(g: Phaser.GameObjects.Graphics, pts: TriangulatedPoints) {
  if (pts.length === 4) {
    const [a, b, c, d] = pts;
    g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
    g.fillTriangle(a.x, a.y, c.x, c.y, d.x, d.y);
    return;
  }
  const tris = pts.tris;
  if (!tris || !drawnByWebGL(g)) {
    g.fillPoints(pts, true);
    return;
  }
  for (let i = 0; i < tris.length; i += 3) {
    const a = pts[tris[i]];
    const b = pts[tris[i + 1]];
    const c = pts[tris[i + 2]];
    g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
  }
}

// Fills a shape known to be convex, its points in order around it, as a fan
// of triangles from the first point -- under WebGL; a path under Canvas (see
// above).
export function fillConvex(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[]) {
  if (pts.length < 3 || !drawnByWebGL(g)) {
    g.fillPoints(pts, true);
    return;
  }
  const a = pts[0];
  for (let i = 2; i < pts.length; i++) {
    const b = pts[i - 1];
    const c = pts[i];
    g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
  }
}

// The triangles of a simple polygon, as indices into its points, for a shape
// that is triangulated once and filled many times through fillPolygon -- or
// null where that would not paint what the triangulator paints. Any
// triangulation of a simple polygon covers exactly the polygon, so for one of
// those the stored triangles and earcut's own fill the same pixels however
// the shape is later moved or projected. A polygon that crosses itself has no
// such answer: what earcut makes of the crossing depends on where its points
// happen to lie, so it is left to earcut on every frame. The cover is checked
// as well as the crossing, which catches the touching cases a crossing test
// lets through.
export function triangulate(pts: { x: number; y: number }[]): number[] | null {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(a, b, pts[j], pts[(j + 1) % n])) return null;
    }
  }
  const flat: number[] = [];
  for (const p of pts) flat.push(p.x, p.y);
  const tris = Phaser.Geom.Polygon.Earcut(flat);
  let covered = 0;
  for (let i = 0; i < tris.length; i += 3) {
    covered += Math.abs(signedArea([pts[tris[i]], pts[tris[i + 1]], pts[tris[i + 2]]]));
  }
  const area = Math.abs(signedArea(pts));
  return Math.abs(covered - area) <= 1e-9 * Math.max(1, area) ? tris : null;
}

function signedArea(pts: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function segmentsCross(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }): boolean {
  const side = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

// Asked on every fill, so the answer is kept for the renderer it was given for.
let askedOf: unknown = null;
let webgl = false;

function drawnByWebGL(g: Phaser.GameObjects.Graphics): boolean {
  const renderer = g.scene.sys.game.renderer;
  if (renderer !== askedOf) {
    askedOf = renderer;
    webgl = renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer;
  }
  return webgl;
}

// Phaser draws an ellipse as a polygon, and takes 32 points for it whatever
// size the ellipse lands at on screen. The terrain repaints every visible tile
// every frame, so an accent that draws a few ellipses per tile pays that count
// a few hundred times a frame -- a tree crown a couple of pixels wide costing
// the same ~100 graphics commands as one filling the frame is what makes the
// wooded worlds the most expensive ones to draw.
//
// The point count comes from the shape's own on-screen size instead, against a
// fixed error budget. For an n-gon on a radius-r ellipse the widest gap between
// polygon and curve is r*(1 - cos(PI/n)), so holding that under about half a
// pixel needs n on the order of PI*sqrt(r): every bucket below is chosen to sit
// inside that budget, which is what makes the cheaper counts invisible rather
// than merely faster.
//
// The buckets are discrete on purpose. A count that slid continuously with
// distance would re-tessellate a silhouette on every frame the player moves,
// and an edge that re-cuts itself each frame crawls -- which trades a cost
// problem for a worse-looking one. Stepping between a small number of counts
// means a shape holds one tessellation across a whole range of depths.
const ELLIPSE_STEPS: { maxRadius: number; steps: number }[] = [
  { maxRadius: 2, steps: 6 },
  { maxRadius: 6, steps: 10 },
  { maxRadius: 15, steps: 14 },
  { maxRadius: 40, steps: 20 },
  { maxRadius: 90, steps: 28 },
];

const MAX_ELLIPSE_STEPS = 32;

// A filled circle at a point count matched to its size, the same budget
// `ellipseSteps` holds every other round shape to. Phaser's own `fillCircle`
// goes through `arc`, which the renderer expands into about a hundred
// segments whatever the radius is -- so a two-pixel spark costs the same
// hundred-odd triangles as a shape filling the screen, and the game draws
// those by the hundred per frame in the bog, the star field and every attack.
export function fillDot(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number) {
  fillOval(g, x, y, r * 2, r * 2);
}

// A filled ellipse: Phaser's own fillEllipse outline, point for point, at a
// point count sized to it (ellipseSteps unless the caller says otherwise),
// filled as the convex shape it is rather than through the triangulator.
export function fillOval(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, steps = ellipseSteps(width, height)) {
  fillConvex(g, new Phaser.Geom.Ellipse(x, y, width, height).getPoints(steps));
}

// The point count to draw an ellipse of this width and height with, for
// fillOval or Phaser's `smoothness` argument on strokeEllipse. Sized off the
// larger semi-axis, since that is where the polygon error shows first.
export function ellipseSteps(width: number, height: number): number {
  const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
  for (const bucket of ELLIPSE_STEPS) {
    if (radius <= bucket.maxRadius) return bucket.steps;
  }
  return MAX_ELLIPSE_STEPS;
}

// A rounded rectangle at a corner point count matched to its radius. Phaser's
// own fillRoundedRect/strokeRoundedRect build each corner with `arc`, which
// the renderer expands into a hundred points whatever the radius, so a plate
// with 6px corners is a four-hundred-point path run through the triangulator
// and stroked segment by segment on every frame it renders -- two of them cost
// a battle as much render time as everything else on its screen. Each corner
// here takes a quarter of the points `ellipseSteps` gives the full circle,
// which holds the same sub-pixel error budget. The radius is clamped to half
// the shorter side, as Phaser clamps it.
export function roundedRectPoints(x: number, y: number, width: number, height: number, radius: number): { x: number; y: number }[] {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const steps = Math.max(2, Math.ceil(ellipseSteps(r * 2, r * 2) / 4));
  // Clockwise from the top edge, as Phaser's own path runs: top-right,
  // bottom-right, bottom-left, top-left, each corner a quarter turn.
  const corners = [
    { cx: x + width - r, cy: y + r, from: -Math.PI / 2 },
    { cx: x + width - r, cy: y + height - r, from: 0 },
    { cx: x + r, cy: y + height - r, from: Math.PI / 2 },
    { cx: x + r, cy: y + r, from: Math.PI },
  ];
  const pts: { x: number; y: number }[] = [];
  for (const c of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = c.from + (i / steps) * (Math.PI / 2);
      pts.push({ x: c.cx + Math.cos(a) * r, y: c.cy + Math.sin(a) * r });
    }
  }
  return pts;
}

export function fillRoundedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, radius: number) {
  g.fillPoints(roundedRectPoints(x, y, width, height, radius), true);
}

export function strokeRoundedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, radius: number) {
  g.strokePoints(roundedRectPoints(x, y, width, height, radius), true);
}
