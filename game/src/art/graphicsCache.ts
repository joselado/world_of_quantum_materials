import Phaser from 'phaser';

// A vector object that is drawn once and then left alone is still paid for on
// every frame. The WebGL renderer walks a Graphics' command list again each
// time it renders, rebuilding every path, triangulating every fill and
// transforming every vertex; a shape object (a circle, an ellipse, a polygon,
// a star) keeps its triangulation but is still pushed into the batch one
// triangle and one function call at a time, a hundred of them for a circle.
// Nearly every vector object in the game is like that -- a pickup, a crystal,
// a guardian, the boss, the icons of the turn row are built when they are
// made and afterwards only moved, scaled and faded -- and a screen holds
// dozens of them.
//
// So the triangles are kept. The first frame an object renders in a given
// state goes through Phaser as always. If the state is the same on the next
// frame, Phaser's own renderer is run once more with the object's transform
// set aside, and the vertices it produces are copied out of the batch instead
// of being drawn: the object's tessellation in its own coordinates, made by
// exactly the code that would have drawn it. From then on a frame is those
// vertices carried through the object's current matrix into the batch, which
// is a few arithmetic operations a vertex. A change of state drops the copy
// -- for a Graphics its command list (any drawing call lengthens it; `clear`
// is counted), for a shape its path, colours, line width and origin -- and an
// object that changes every frame never gets one and renders exactly as
// before.
//
// What it does not take: an object with a post-pipeline or a pipeline other
// than the default one, one whose art is more than MAX_KEPT_VERTICES, and one
// filled from a texture. Those render through Phaser untouched, as do the
// shapes that are a quad or a line already (Rectangle, Line, Grid, the Iso
// boxes). The overworld's terrain layer is not a retained object at all
// (art/fastGraphics.ts) and has its own renderer.
//
// Alpha is part of what is kept: Phaser folds an object's alpha into each
// vertex's colour before rounding it to a byte, so the copy is taken at the
// alpha the object has, and taken again once the object has settled on
// another. While the alpha is on the move (a fade) the kept bytes are scaled
// instead, which can sit one level in 255 off Phaser's own rounding for the
// length of the fade.

// Words per vertex in the batch: x, y, u, v, texture unit, tint effect, tint.
const WORDS = 7;
const TINT_FILL = 2;
// How many copies are taken in one frame. Taking one empties the batch
// first, and a scene that has just started has a hundred objects all due
// theirs on the same frame; the rest wait their turn rendering as before.
const CAPTURES_PER_FRAME = 8;
// The most vertices kept for one object, about 7 MB of them. Art larger than
// a batch (24576 vertices) is taken a batch at a time; art larger than this
// is drawn with more geometry than a sprite should have, and is left to
// render as it always did rather than held in memory.
const MAX_KEPT_VERTICES = 262144;
let captureFrame = -1;
let capturesThisFrame = 0;

interface Cached {
  // The state the copy was made from. A Graphics: how often it had been
  // cleared, and how long its command list was. A shape: its path, its
  // colours and its origin.
  cleared: number;
  length: number;
  shape: unknown[];
  // Frames rendered in that state before the copy is taken.
  seen: number;
  refused: boolean;
  f32: Float32Array | null;
  u32: Uint32Array | null;
  count: number;
  // The alpha the copy was taken at, and the last alpha asked for that was
  // not it.
  alpha: number;
  askedAlpha: number;
}

interface BatchPipeline {
  vertexViewF32: Float32Array;
  vertexViewU32: Uint32Array;
  vertexCount: number;
  vertexCapacity: number;
  batch: unknown[];
  currentBatch: { start: number; count: number } | null;
  currentTexture: unknown;
  currentUnit: number;
  setTexture2D(): number;
  flush(): unknown;
}

// What the cache needs of an object, Graphics or shape.
interface Vector extends Phaser.GameObjects.GameObject {
  alpha: number;
  hasPostPipeline: boolean;
  pipeline: Phaser.Renderer.WebGL.WebGLPipeline;
}

type RenderWebGL = (
  this: Vector,
  renderer: Phaser.Renderer.WebGL.WebGLRenderer,
  src: Vector,
  camera: Phaser.Cameras.Scene2D.Camera,
  parentMatrix: Phaser.GameObjects.Components.TransformMatrix
) => void;

type Counted = Phaser.GameObjects.Graphics & { __cleared?: number };

// The fields of a shape its renderer reads, apart from its transform. The
// path arrays are replaced whole whenever the geometry changes, so their
// identity stands for their contents.
const SHAPE_STATE = [
  'pathData',
  'pathIndexes',
  'isFilled',
  'fillColor',
  'fillAlpha',
  'isStroked',
  'strokeColor',
  'strokeAlpha',
  'lineWidth',
  'closePath',
  '_displayOriginX',
  '_displayOriginY',
] as const;

const caches = new WeakMap<Vector, Cached>();

// Off, every Graphics renders through Phaser as if this module were not
// installed: the reference a pixel comparison of the two is taken against
// (DEVELOPMENT.md's "Checking the vector layers"). `?vectors=phaser` in the
// URL starts with it off.
let enabled = true;
export function setGraphicsCacheEnabled(on: boolean): void {
  enabled = on;
}

// Before any Graphics or shape exists.
export function installGraphicsCache(): void {
  if (new URLSearchParams(window.location.search).get('vectors') === 'phaser') enabled = false;

  const graphics = Phaser.GameObjects.Graphics.prototype as unknown as {
    renderWebGL: RenderWebGL;
    clear: (this: Counted) => Phaser.GameObjects.Graphics;
  };
  const clear = graphics.clear;
  graphics.clear = function () {
    this.__cleared = (this.__cleared ?? 0) + 1;
    return clear.call(this);
  };
  wrap(graphics, (src, cached) => {
    const g = src as unknown as Counted;
    const cleared = g.__cleared ?? 0;
    const length = g.commandBuffer.length;
    if (cached.cleared === cleared && cached.length === length) return false;
    cached.cleared = cleared;
    cached.length = length;
    return true;
  });

  const { Arc, Ellipse, Polygon, Star, Triangle, Curve } = Phaser.GameObjects;
  for (const shape of [Arc, Ellipse, Polygon, Star, Triangle, Curve]) {
    wrap(shape.prototype as unknown as { renderWebGL: RenderWebGL }, (src, cached) => {
      const fields = src as unknown as Record<string, unknown>;
      let changed = false;
      for (let i = 0; i < SHAPE_STATE.length; i++) {
        const value = fields[SHAPE_STATE[i]];
        if (cached.shape[i] !== value) {
          cached.shape[i] = value;
          changed = true;
        }
      }
      return changed;
    });
  }
}

// Replaces one class's WebGL renderer with the caching one. `changed` says
// whether the object's state differs from the one recorded in `cached`, and
// records the new one.
function wrap(proto: { renderWebGL: RenderWebGL }, changed: (src: Vector, cached: Cached) => boolean) {
  const render = proto.renderWebGL;
  // A camera that leaves an object where it is: what the tessellation is
  // taken through.
  const still = {
    alpha: 1,
    scrollX: 0,
    scrollY: 0,
    matrix: new Phaser.GameObjects.Components.TransformMatrix(),
    addToRenderList() {},
  } as unknown as Phaser.Cameras.Scene2D.Camera;

  proto.renderWebGL = function (renderer, src, camera, parentMatrix) {
    if (!enabled || src.hasPostPipeline || src.pipeline !== renderer.pipelines.MULTI_PIPELINE) {
      render.call(this, renderer, src, camera, parentMatrix);
      return;
    }

    let cached = caches.get(src);
    if (!cached) {
      cached = { cleared: -1, length: -1, shape: [], seen: 0, refused: false, f32: null, u32: null, count: -1, alpha: 1, askedAlpha: 1 };
      caches.set(src, cached);
    }
    if (changed(src, cached)) {
      cached.seen = 0;
      cached.refused = false;
      cached.count = -1;
    }
    const alpha = camera.alpha * src.alpha;
    if (cached.count < 0) {
      if (cached.refused || cached.seen++ < 1 || !captureDue(renderer)) {
        render.call(this, renderer, src, camera, parentMatrix);
        return;
      }
      capture(render, renderer, src, still, cached, alpha);
      if (cached.count < 0) {
        render.call(this, renderer, src, camera, parentMatrix);
        return;
      }
    } else if (alpha !== cached.alpha) {
      // The second frame in a row at a new alpha: the object has settled
      // there, and the copy is taken again at it. A first frame, or an alpha
      // still moving, scales the copy it has.
      if ((alpha === cached.askedAlpha && captureDue(renderer)) || cached.alpha === 0) {
        capture(render, renderer, src, still, cached, alpha);
        if (cached.count < 0) {
          render.call(this, renderer, src, camera, parentMatrix);
          return;
        }
      } else {
        cached.askedAlpha = alpha;
      }
    }
    const fade = alpha === cached.alpha ? 1 : alpha / cached.alpha;

    camera.addToRenderList(src);
    const pipelines = renderer.pipelines;
    const pipeline = pipelines.set(src.pipeline, src) as unknown as BatchPipeline;
    const m = Phaser.GameObjects.GetCalcMatrix(src as unknown as Phaser.GameObjects.Graphics, camera, parentMatrix).calc;
    const { a, b, c, d, e, f } = m;
    const from32 = cached.u32!;
    const fromF = cached.f32!;

    let done = 0;
    while (done < cached.count) {
      if (!pipeline.currentBatch) pipeline.setTexture2D();
      let free = pipeline.vertexCapacity - pipeline.vertexCount;
      free -= free % 3;
      if (free < 3) {
        pipeline.flush();
        continue;
      }
      const n = Math.min(free, cached.count - done);
      const to = pipeline.vertexCount * WORDS;
      const from = done * WORDS;
      const out32 = pipeline.vertexViewU32;
      const outF = pipeline.vertexViewF32;
      out32.set(from32.subarray(from, from + n * WORDS), to);
      for (let v = 0; v < n; v++) {
        const i = from + v * WORDS;
        const o = to + v * WORDS;
        const x = fromF[i];
        const y = fromF[i + 1];
        outF[o] = x * a + y * c + e;
        outF[o + 1] = x * b + y * d + f;
        if (fade !== 1) {
          const tint = from32[i + 6];
          out32[o + 6] = ((tint & 0xffffff) | (Math.min(255, ((tint >>> 24) * fade) | 0) << 24)) >>> 0;
        }
      }
      pipeline.vertexCount += n;
      pipeline.currentBatch!.count = pipeline.vertexCount - pipeline.currentBatch!.start;
      done += n;
    }
  };
}

function captureDue(renderer: Phaser.Renderer.WebGL.WebGLRenderer): boolean {
  const frame = renderer.game.loop.frame;
  if (frame !== captureFrame) {
    captureFrame = frame;
    capturesThisFrame = 0;
  }
  return capturesThisFrame++ < CAPTURES_PER_FRAME;
}

// Runs Phaser's renderer over the object with no transform and at the given
// alpha, into an emptied batch, and takes the vertices instead
// of letting them be drawn. Leaves `cached.count` at -1, and the object
// refused, where the result is not something to keep.
function capture(
  render: RenderWebGL,
  renderer: Phaser.Renderer.WebGL.WebGLRenderer,
  src: Vector,
  still: Phaser.Cameras.Scene2D.Camera,
  cached: Cached,
  alpha: number
) {
  cached.count = -1;
  const pipeline = renderer.pipelines.set(src.pipeline, src) as unknown as BatchPipeline;
  // Whatever is waiting in the batch belongs to objects under this one.
  pipeline.flush();

  // The same object as far as what it draws goes, standing at the origin,
  // unscaled and unrotated.
  const stand = Object.create(src, {
    x: { value: 0 },
    y: { value: 0 },
    rotation: { value: 0 },
    scaleX: { value: 1 },
    scaleY: { value: 1 },
    alpha: { value: alpha },
    scrollFactorX: { value: 1 },
    scrollFactorY: { value: 1 },
  }) as Vector;

  // A batch that fills up asks to be drawn, which here would draw it in the
  // wrong place: its vertices are taken instead, and the batch starts again.
  // Phaser only asks between two triangles, so the pieces join up whole.
  const pieces: Uint32Array[] = [];
  let count = 0;
  let whole = true;
  const take = () => {
    const n = pipeline.vertexCount;
    if (n % 3 !== 0) whole = false;
    if (n > 0 && whole && count + n <= MAX_KEPT_VERTICES) pieces.push(pipeline.vertexViewU32.slice(0, n * WORDS));
    count += n;
  };
  const drop = () => {
    pipeline.vertexCount = 0;
    pipeline.batch.length = 0;
    pipeline.currentBatch = null;
    pipeline.currentTexture = null;
    pipeline.currentUnit = 0;
  };
  const flush = pipeline.flush;
  pipeline.flush = () => {
    take();
    drop();
    return pipeline;
  };
  try {
    render.call(stand, renderer, stand, still, undefined as unknown as Phaser.GameObjects.Components.TransformMatrix);
  } finally {
    pipeline.flush = flush;
  }

  take();
  let keep = whole && count > 0 && count <= MAX_KEPT_VERTICES;
  const buffer = keep ? new ArrayBuffer(count * WORDS * 4) : null;
  if (buffer) {
    const u32 = new Uint32Array(buffer);
    let at = 0;
    for (const piece of pieces) {
      u32.set(piece, at);
      at += piece.length;
    }
    const words = new Float32Array(buffer);
    for (let v = 0; v < count; v++) {
      if (words[v * WORDS + 5] !== TINT_FILL) {
        keep = false;
        break;
      }
    }
  }
  if (keep && buffer) {
    cached.u32 = new Uint32Array(buffer);
    cached.f32 = new Float32Array(buffer);
    cached.count = count;
    cached.alpha = alpha;
    cached.askedAlpha = alpha;
  } else {
    cached.refused = true;
  }
  drop();
}
