import Phaser from 'phaser';
import { ARC_THICK_STROKE, eachArcPoint, sizedArcs } from './arcs';

// A Graphics for art that is drawn again on every frame.
//
// A Phaser Graphics is retained: each drawing call appends to a command list,
// and on every frame the object renders the WebGL renderer walks that list
// again, rebuilding each path, triangulating each fill and transforming and
// batching each vertex one call at a time. For art that is cleared and drawn
// afresh every frame (the overworld's terrain, three to seven thousand
// triangles a frame) that is the work done twice: once to say what to draw,
// once more to turn the saying into vertices, and the second pass costs more
// than the first.
//
// This is the same object with the list taken out. Each drawing call writes
// its finished triangles straight into a vertex array, in the layout Phaser's
// own batch uses, and rendering is one block copy of that array into the
// batch. The triangles are the ones a plain Graphics would have made: every
// fill and stroke below follows the renderer's own tessellation
// (GraphicsWebGLRenderer and MultiPipeline in Phaser's source), vertex for
// vertex, and an arc takes the same points a plain Graphics' does
// (art/arcs.ts), so a frame drawn through this and a frame drawn through a
// plain Graphics are the same picture. Shader, blending, batching, context loss and the display scale are
// all still Phaser's.
//
// What it supports is what a path-and-fill painter needs: fillStyle,
// lineStyle, fillGradientStyle, beginPath, moveTo, lineTo, closePath, arc,
// fillPath, strokePath, fillRect and fillTriangle, and so every Graphics
// method built from those (fillPoints, strokePoints, lineBetween, strokeRect,
// fillEllipse, strokeEllipse, fillCircle, strokeCircle, the rounded
// rectangles). The transform stack (save, restore, translate, scale, rotate),
// lineGradientStyle and strokeTriangle are not: a call to one of them lands in
// the command list this object never draws, which a dev build refuses out
// loud at the next frame.
//
// Two things are read when a style is set rather than when the frame is
// drawn: the object's own alpha, and the assumption that the camera drawing
// it is opaque. Art that fades as a whole wants a plain Graphics.
//
// The Canvas renderer has no batch to copy into, and it fills paths natively
// rather than re-tessellating them, so under it `addFastGraphics` hands back a
// plain Graphics and nothing here runs.

// Words per vertex in the batch: x, y, u, v, texture unit, tint effect, tint.
const WORDS = 7;
// "Fill with the tint, ignore the texture": what every Graphics vertex carries.
const TINT_FILL = 2;
// The step Phaser's renderer walks an arc in, as a fraction of its sweep.
const ARC_STEP = 0.01;
const PI2 = Math.PI * 2;

const getTint = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha;
const earcut = Phaser.Geom.Polygon.Earcut;

// The cosine and sine of each of `steps` equal turns, kept per step count.
const unitCircles = new Map<number, Float64Array>();
function unitCircle(steps: number): Float64Array {
  let unit = unitCircles.get(steps);
  if (!unit) {
    unit = new Float64Array(steps * 2);
    for (let i = 0; i < steps; i++) {
      const angle = PI2 * (i / steps);
      unit[i * 2] = Math.cos(angle);
      unit[i * 2 + 1] = Math.sin(angle);
    }
    unitCircles.set(steps, unit);
  }
  return unit;
}

interface BatchPipeline {
  vertexViewF32: Float32Array;
  vertexViewU32: Uint32Array;
  vertexCount: number;
  vertexCapacity: number;
  currentBatch: { start: number; count: number } | null;
  currentShader: { vertexComponentCount: number };
  setTexture2D(): number;
  flush(): void;
}

// A plain Graphics under the Canvas renderer, or when the URL asks for
// Phaser's own drawing of every vector with `?vectors=phaser` (the reference
// a pixel comparison of the two is taken against).
export function addFastGraphics(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const webgl = scene.sys.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer;
  const reference = new URLSearchParams(window.location.search).get('vectors') === 'phaser';
  if (!webgl || reference) return scene.add.graphics();
  const g = new FastGraphics(scene);
  scene.add.existing(g);
  return g;
}

export class FastGraphics extends Phaser.GameObjects.Graphics {
  private buffer = new ArrayBuffer(0);
  private f32 = new Float32Array(this.buffer);
  private u32 = new Uint32Array(this.buffer);
  // Vertices written since the last clear, and how many the array holds.
  private count = 0;
  private room = 0;

  private fillTL = 0xffffffff;
  private fillTR = 0xffffffff;
  private fillBL = 0xffffffff;
  private fillBR = 0xffffffff;
  private strokeTint = 0xffffffff;
  private lineW = 1;
  // The line width set since the last clear, which is what decides how an
  // arc is tessellated (art/arcs.ts).
  private arcLine = 0;

  // The path under construction: one flat list of x, y, line width per
  // subpath, as the renderer keeps one point list per moveTo.
  private paths: number[][] = [];
  private path: number[] | null = null;
  private pathOpen = true;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.reserve(4096);
  }

  // Room for `n` more vertices. A grown array is prefilled with the words
  // that never change (u, v and the texture unit are zero, as the buffer
  // already is), so a drawing call writes three words a vertex.
  private reserve(n: number) {
    if (this.count + n <= this.room) return;
    let room = Math.max(4096, this.room);
    while (room < this.count + n) room *= 2;
    const buffer = new ArrayBuffer(room * WORDS * 4);
    const f32 = new Float32Array(buffer);
    const u32 = new Uint32Array(buffer);
    u32.set(this.u32.subarray(0, this.count * WORDS));
    for (let i = 0; i < room; i++) f32[i * WORDS + 5] = TINT_FILL;
    this.buffer = buffer;
    this.f32 = f32;
    this.u32 = u32;
    this.room = room;
  }

  private tri(x0: number, y0: number, t0: number, x1: number, y1: number, t1: number, x2: number, y2: number, t2: number) {
    if (this.count + 3 > this.room) this.reserve(3);
    const f32 = this.f32;
    const u32 = this.u32;
    let i = this.count * WORDS;
    f32[i] = x0;
    f32[i + 1] = y0;
    u32[i + 6] = t0;
    i += WORDS;
    f32[i] = x1;
    f32[i + 1] = y1;
    u32[i + 6] = t1;
    i += WORDS;
    f32[i] = x2;
    f32[i + 1] = y2;
    u32[i + 6] = t2;
    this.count += 3;
  }

  // Phaser's batchQuad: corners given top-left, bottom-left, bottom-right,
  // top-right, drawn as the two triangles TL-BL-BR and TL-BR-TR.
  private quad(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    tl: number,
    tr: number,
    bl: number,
    br: number
  ) {
    this.tri(x0, y0, tl, x1, y1, bl, x2, y2, br);
    this.tri(x0, y0, tl, x2, y2, br, x3, y3, tr);
  }

  clear(): this {
    this.count = 0;
    this.arcLine = 0;
    this.paths.length = 0;
    this.path = null;
    this.pathOpen = true;
    this.commandBuffer.length = 0;
    if (this.defaultFillColor > -1) this.fillStyle(this.defaultFillColor, this.defaultFillAlpha);
    if (this.defaultStrokeColor > -1) this.lineStyle(this.defaultStrokeWidth, this.defaultStrokeColor, this.defaultStrokeAlpha);
    return this;
  }

  fillStyle(color: number, alpha = 1): this {
    const tint = getTint(color, alpha * this.alpha);
    this.fillTL = tint;
    this.fillTR = tint;
    this.fillBL = tint;
    this.fillBR = tint;
    return this;
  }

  fillGradientStyle(
    topLeft: number,
    topRight: number,
    bottomLeft: number,
    bottomRight: number,
    alphaTopLeft = 1,
    alphaTopRight = alphaTopLeft,
    alphaBottomLeft = alphaTopLeft,
    alphaBottomRight = alphaTopLeft
  ): this {
    const a = this.alpha;
    this.fillTL = getTint(topLeft, alphaTopLeft * a);
    this.fillTR = getTint(topRight, alphaTopRight * a);
    this.fillBL = getTint(bottomLeft, alphaBottomLeft * a);
    this.fillBR = getTint(bottomRight, alphaBottomRight * a);
    return this;
  }

  lineStyle(lineWidth: number, color: number, alpha = 1): this {
    this.lineW = lineWidth;
    this.arcLine = lineWidth;
    this.strokeTint = getTint(color, alpha * this.alpha);
    // What Graphics.strokeRect reads for its half-width overhang.
    (this as unknown as { _lineWidth: number })._lineWidth = lineWidth;
    return this;
  }

  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): this {
    this.tri(x0, y0, this.fillTL, x1, y1, this.fillTR, x2, y2, this.fillBL);
    return this;
  }

  // A filled ellipse of `steps` sides, as the fan from its first point that
  // art/shapes.ts's fillOval draws: the same points Phaser's Ellipse.getPoints
  // gives (centre plus half-size times the cosine and sine of each step's
  // angle), written without building them as objects first. An accent draws a
  // few of these per tile, a few hundred times a frame.
  fillOvalFan(x: number, y: number, width: number, height: number, steps: number): this {
    if (steps < 3) return this;
    const unit = unitCircle(steps);
    const hw = width / 2;
    const hh = height / 2;
    const tl = this.fillTL;
    const tr = this.fillTR;
    const bl = this.fillBL;
    const ax = x + hw * unit[0];
    const ay = y + hh * unit[1];
    let bx = x + hw * unit[2];
    let by = y + hh * unit[3];
    for (let i = 2; i < steps; i++) {
      const cx = x + hw * unit[i * 2];
      const cy = y + hh * unit[i * 2 + 1];
      this.tri(ax, ay, tl, bx, by, tr, cx, cy, bl);
      bx = cx;
      by = cy;
    }
    return this;
  }

  fillRect(x: number, y: number, width: number, height: number): this {
    const xw = x + width;
    const yh = y + height;
    this.quad(x, y, x, yh, xw, yh, xw, y, this.fillTL, this.fillTR, this.fillBL, this.fillBR);
    return this;
  }

  beginPath(): this {
    this.paths.length = 0;
    this.path = null;
    this.pathOpen = true;
    return this;
  }

  moveTo(x: number, y: number): this {
    this.path = [x, y, this.lineW];
    this.paths.push(this.path);
    return this;
  }

  lineTo(x: number, y: number): this {
    if (this.path) this.path.push(x, y, this.lineW);
    else this.moveTo(x, y);
    return this;
  }

  closePath(): this {
    this.pathOpen = false;
    const p = this.path;
    if (p && p.length) p.push(p[0], p[1], p[2]);
    return this;
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise = false, overshoot = 0): this {
    // The same points a plain Graphics lays down for this call (art/arcs.ts).
    if (sizedArcs() && this.arcLine <= ARC_THICK_STROKE) {
      eachArcPoint(x, y, radius, startAngle, endAngle, anticlockwise, overshoot, (px, py) => this.lineTo(px, py));
      return this;
    }
    let sweep = endAngle - startAngle;
    if (anticlockwise) {
      if (sweep < -PI2) sweep = -PI2;
      else if (sweep > 0) sweep = -PI2 + (sweep % PI2);
    } else if (sweep > PI2) sweep = PI2;
    else if (sweep < 0) sweep = PI2 + (sweep % PI2);

    let iteration = 0;
    if (!this.path) {
      this.moveTo(x + Math.cos(startAngle) * radius, y + Math.sin(startAngle) * radius);
      iteration += ARC_STEP;
    }
    const p = this.path!;
    while (iteration < 1 + overshoot) {
      const a = sweep * iteration + startAngle;
      p.push(x + Math.cos(a) * radius, y + Math.sin(a) * radius, this.lineW);
      iteration += ARC_STEP;
    }
    const a = sweep + startAngle;
    p.push(x + Math.cos(a) * radius, y + Math.sin(a) * radius, this.lineW);
    return this;
  }

  // Each subpath through the same triangulator, on the same point list, the
  // renderer would have handed it.
  fillPath(): this {
    for (const p of this.paths) {
        const flat: number[] = [];
      for (let i = 0; i < p.length; i += 3) flat.push(p[i], p[i + 1]);
      const tris = earcut(flat);
      for (let i = 0; i < tris.length; i += 3) {
        const a = tris[i] * 2;
        const b = tris[i + 1] * 2;
        const c = tris[i + 2] * 2;
        this.tri(flat[a], flat[a + 1], this.fillTL, flat[b], flat[b + 1], this.fillTR, flat[c], flat[c + 1], this.fillBL);
      }
    }
    return this;
  }

  // One quad a segment, each end as wide as the line was when its point was
  // added, and from a width of 2 upward a second quad across every joint
  // (and across the seam of a closed path), which is the renderer's whole
  // line join.
  strokePath(): this {
    const tint = this.strokeTint;
    const lineWidth = this.lineW;
    const closed = !this.pathOpen;
    for (const p of this.paths) {
        const segments = p.length / 3 - 1;
      let hasPrev = false;
      let prevX0 = 0;
      let prevY0 = 0;
      let prevX1 = 0;
      let prevY1 = 0;
      let hasFirst = false;
      let firstX0 = 0;
      let firstY0 = 0;
      let firstX1 = 0;
      let firstY1 = 0;
      for (let s = 0; s < segments; s++) {
        const i = s * 3;
        const ax = p[i];
        const ay = p[i + 1];
        const aw = p[i + 2] / 2;
        const bx = p[i + 3];
        const by = p[i + 4];
        const bw = p[i + 5] / 2;
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;
        const al0 = (aw * (by - ay)) / len;
        const al1 = (aw * (ax - bx)) / len;
        const bl0 = (bw * (by - ay)) / len;
        const bl1 = (bw * (ax - bx)) / len;
        const brX = bx - bl0;
        const brY = by - bl1;
        const blX = ax - al0;
        const blY = ay - al1;
        const trX = bx + bl0;
        const trY = by + bl1;
        const tlX = ax + al0;
        const tlY = ay + al1;
        this.quad(tlX, tlY, blX, blY, brX, brY, trX, trY, tint, tint, tint, tint);
        if (lineWidth <= 2) continue;
        if (s > 0 && hasPrev) {
          this.quad(tlX, tlY, blX, blY, prevX0, prevY0, prevX1, prevY1, tint, tint, tint, tint);
        } else {
          firstX0 = tlX;
          firstY0 = tlY;
          firstX1 = blX;
          firstY1 = blY;
          hasFirst = true;
        }
        if (closed && s === segments - 1 && hasFirst) {
          this.quad(brX, brY, trX, trY, firstX0, firstY0, firstX1, firstY1, tint, tint, tint, tint);
        } else {
          prevX0 = brX;
          prevY0 = brY;
          prevX1 = trX;
          prevY1 = trY;
          hasPrev = true;
        }
      }
    }
    return this;
  }

  renderWebGL(
    renderer: Phaser.Renderer.WebGL.WebGLRenderer,
    src: Phaser.GameObjects.Graphics,
    camera: Phaser.Cameras.Scene2D.Camera,
    parentMatrix: Phaser.GameObjects.Components.TransformMatrix
  ) {
    if (import.meta.env.DEV && this.commandBuffer.length > 0) {
      throw new Error('FastGraphics: a drawing call it does not support was made on it (see art/fastGraphics.ts)');
    }
    if (this.count === 0) return;

    camera.addToRenderList(src);
    const pipelines = renderer.pipelines;
    const pipeline = pipelines.set(this.pipeline, src) as unknown as BatchPipeline;
    pipelines.preBatch(src);

    const m = Phaser.GameObjects.GetCalcMatrix(src, camera, parentMatrix).calc;
    const identity = m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;

    let done = 0;
    while (done < this.count) {
      if (!pipeline.currentBatch) pipeline.setTexture2D();
      let free = pipeline.vertexCapacity - pipeline.vertexCount;
      free -= free % 3;
      if (free < 3) {
        pipeline.flush();
        continue;
      }
      const n = Math.min(free, this.count - done);
      const to = pipeline.vertexCount * WORDS;
      const from = done * WORDS;
      // As 32-bit words, so the tints go over bit for bit.
      pipeline.vertexViewU32.set(this.u32.subarray(from, from + n * WORDS), to);
      if (!identity) {
        const out = pipeline.vertexViewF32;
        const f32 = this.f32;
        for (let v = 0; v < n; v++) {
          const x = f32[from + v * WORDS];
          const y = f32[from + v * WORDS + 1];
          out[to + v * WORDS] = x * m.a + y * m.c + m.e;
          out[to + v * WORDS + 1] = x * m.b + y * m.d + m.f;
        }
      }
      pipeline.vertexCount += n;
      pipeline.currentBatch!.count = pipeline.vertexCount - pipeline.currentBatch!.start;
      done += n;
    }

    pipelines.postBatch(src);
  }
}
