import Phaser from 'phaser';

// How many straight segments a circle or an arc is drawn with.
//
// Phaser's WebGL renderer expands every `arc` of a Graphics into a hundred
// points whatever its radius or its sweep, and gives a circle shape a hundred
// segments too. A two-pixel dot then costs what a circle filling the screen
// does, a short dash of a broken ring costs what the whole ring does, and
// every one of those points is run through the triangulator when the object
// is first drawn and carried through a matrix on every frame after. The
// guardians' avatars are built almost wholly of circles: at Phaser's count
// the Lab carries fifty thousand vertices a frame, at this one fifteen.
//
// The count here is the fewest segments that keep the polygon within
// ARC_MAX_ERROR_PX of the true circle at the shape's own size, between
// ARC_MIN_STEPS and Phaser's hundred for a full turn, and the same share of
// that for a partial arc. The bound is that tight because these shapes are
// scaled up by the containers they stand in and drawn at the display's own
// resolution: a twentieth of a pixel here is still a third of a drawn pixel
// on a shape enlarged twice on a 3x display. A circle of radius 5 comes to 23
// segments, one of radius 20 to 45, and from a radius of 100 the count is
// Phaser's.
//
// A thick stroke is the exception. Phaser draws a stroke wider than
// ARC_THICK_STROKE as a quad a segment with a triangle laid over every join,
// and wherever the stroke is translucent, by its own alpha or its object's,
// each join shows as a faint spoke where the two overlap. A hundred joins
// blur into an even tone; twenty stand out. So an arc laid down while the
// line is that wide keeps Phaser's hundred points, whatever it ends up
// being used for.
//
// One rule for everything round, so that the same call draws the same
// polygon whatever it is drawn into: a Graphics' `arc` (and so `fillCircle`,
// `strokeCircle` and Phaser's rounded rects, which are built from it), the
// per-frame layer's `arc` (art/fastGraphics.ts), a circle shape
// (shapes.ts's installArcSteps) and shapes.ts's strokeArc.
export const ARC_MAX_ERROR_PX = 0.05;
export const ARC_MIN_STEPS = 8;
export const ARC_MAX_STEPS = 100;
export const ARC_THICK_STROKE = 2;

// Off, a Graphics' `arc` is Phaser's own again: the reference the sized
// arcs are compared against (DEVELOPMENT.md's "Checking the vector layers").
// `?vectors=phaser` starts with it off. Read when an arc is drawn, so it can
// be switched between two drawings in one frame.
let sized = true;
export function setSizedArcs(on: boolean): void {
  sized = on;
}
export function sizedArcs(): boolean {
  return sized;
}

// Segments for a full circle of this radius.
export function circleSteps(radius: number): number {
  // An n-gon inscribed in a circle of radius r lies r * (1 - cos(PI / n))
  // inside it at the middle of each side.
  const r = Math.abs(radius);
  const steps = r > ARC_MAX_ERROR_PX ? Math.ceil(Math.PI / Math.acos(1 - ARC_MAX_ERROR_PX / r)) : ARC_MIN_STEPS;
  return Math.min(ARC_MAX_STEPS, Math.max(ARC_MIN_STEPS, steps));
}

// The angle an arc sweeps, signed, the way Phaser reads `arc(x, y, radius,
// startAngle, endAngle, anticlockwise)`.
export function arcSweep(startAngle: number, endAngle: number, anticlockwise: boolean): number {
  const full = Math.PI * 2;
  let sweep = endAngle - startAngle;
  if (anticlockwise) {
    if (sweep < -full) sweep = -full;
    else if (sweep > 0) sweep = -full + (sweep % full);
  } else if (sweep > full) sweep = full;
  else if (sweep < 0) sweep = full + (sweep % full);
  return sweep;
}

// Segments for an arc of this radius and sweep.
export function arcSteps(radius: number, sweep: number): number {
  return Math.max(1, Math.ceil((circleSteps(radius) * Math.abs(sweep)) / (Math.PI * 2)));
}

// The points of an arc, start to end, handed to `emit` in order. `overshoot`
// is Phaser's: the arc is carried that fraction of its sweep past its end
// before the end point closes it, for a thick stroke that has to join up.
export function eachArcPoint(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  anticlockwise: boolean,
  overshoot: number,
  emit: (x: number, y: number) => void
): void {
  const sweep = arcSweep(startAngle, endAngle, anticlockwise);
  const steps = arcSteps(radius, sweep);
  const last = (1 + overshoot) * steps - 1e-9;
  for (let i = 0; i < last; i++) {
    const a = startAngle + (sweep * i) / steps;
    emit(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
  }
  const a = startAngle + sweep;
  emit(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
}

// Before any Graphics exists (main.ts). Under WebGL a Graphics' `arc` lays
// its points down as `lineTo`s at the count above, which is what Phaser's
// renderer does with an arc command at its own count: the first point opens
// a subpath where none is open and continues the open one otherwise, exactly
// as `lineTo` does. The Canvas renderer draws an arc as an arc, so there the
// command is left alone.
export function installGraphicsArcs(): void {
  if (new URLSearchParams(window.location.search).get('vectors') === 'phaser') sized = false;
  type Arc = (
    this: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    anticlockwise?: boolean,
    overshoot?: number
  ) => Phaser.GameObjects.Graphics;
  // The line width in force: the last one set since the Graphics was last
  // cleared, and none before that.
  type Lined = Phaser.GameObjects.Graphics & { __arcLine?: number };
  const proto = Phaser.GameObjects.Graphics.prototype as unknown as {
    arc: Arc;
    lineStyle: (this: Lined, lineWidth: number, color: number, alpha?: number) => Phaser.GameObjects.Graphics;
    clear: (this: Lined) => Phaser.GameObjects.Graphics;
  };
  const lineStyle = proto.lineStyle;
  proto.lineStyle = function (lineWidth, color, alpha) {
    this.__arcLine = lineWidth;
    return lineStyle.call(this, lineWidth, color, alpha);
  };
  const clear = proto.clear;
  proto.clear = function () {
    this.__arcLine = 0;
    return clear.call(this);
  };
  const arc = proto.arc;
  proto.arc = function (this: Lined, x, y, radius, startAngle, endAngle, anticlockwise = false, overshoot = 0) {
    if (!sized || (this.__arcLine ?? 0) > ARC_THICK_STROKE || this.scene.sys.game.renderer.type !== Phaser.WEBGL) {
      return arc.call(this, x, y, radius, startAngle, endAngle, anticlockwise, overshoot);
    }
    eachArcPoint(x, y, radius, startAngle, endAngle, anticlockwise, overshoot, (px, py) => this.lineTo(px, py));
    return this;
  };
}
