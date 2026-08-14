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

// The point count to draw an ellipse of this width and height with, for
// Phaser's `smoothness` argument on fillEllipse/strokeEllipse. Sized off the
// larger semi-axis, since that is where the polygon error shows first.
export function ellipseSteps(width: number, height: number): number {
  const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
  for (const bucket of ELLIPSE_STEPS) {
    if (radius <= bucket.maxRadius) return bucket.steps;
  }
  return MAX_ELLIPSE_STEPS;
}
