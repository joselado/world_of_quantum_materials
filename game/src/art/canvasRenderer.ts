import Phaser from 'phaser';

// What Phaser's Canvas renderer has to be taught to draw this game as its
// WebGL renderer does. Every machine without a usable GPU runs the game on
// it: main.ts's chooseRenderer passes a software WebGL over for it, and a
// browser offering no WebGL at all lands on it through Phaser.AUTO. Out of
// the box that renderer drops two things the game leans on everywhere:
//
// - Gradient fills. Every sky, mist band, veil and vignette is a
//   fillGradientStyle followed by a fillRect. Phaser's Canvas Graphics
//   renderer skips the gradient command five values short of its eight, so
//   the last three colours are read as commands of their own (a black corner
//   is command 0, an arc), and the rect after it fills in whatever colour was
//   set before -- skies came out black and the mist came out as opaque bands
//   laid over the terrain.
// - Tints. The spectacle moves' textures are white with their shape in the
//   alpha channel (art/fxTextures.ts), and the class colour is the tint;
//   untinted, every Analytic and Ultimate burned white.
//
// installCanvasRenderer() replaces the Canvas Graphics renderer with one that
// reads every command correctly and paints gradients the way WebGL does, and
// wraps the Canvas sprite and particle paths so a tinted object is drawn from
// a tinted copy of its texture. The WebGL renderer is untouched: it never
// calls these paths while drawing a frame.
export function installCanvasRenderer(): void {
  (Phaser.GameObjects.Graphics.prototype as unknown as { renderCanvas: typeof renderGraphicsCanvas }).renderCanvas =
    renderGraphicsCanvas;

  const canvasRenderer = Phaser.Renderer.Canvas.CanvasRenderer.prototype as unknown as {
    batchSprite: (sprite: TintedObject, frame: Phaser.Textures.Frame, camera: Phaser.Cameras.Scene2D.Camera, parent?: unknown) => void;
  };
  const batchSprite = canvasRenderer.batchSprite;
  canvasRenderer.batchSprite = function (sprite, frame, camera, parent) {
    batchSprite.call(this, sprite, spriteFrame(sprite, frame), camera, parent);
  };

  const emitterProto = Phaser.GameObjects.Particles.ParticleEmitter.prototype as unknown as {
    renderCanvas: (renderer: unknown, emitter: TintedEmitter, camera: unknown, parent?: unknown) => void;
  };
  const renderEmitter = emitterProto.renderCanvas;
  emitterProto.renderCanvas = function (renderer, emitter, camera, parent) {
    const swapped: [TintedParticle, Phaser.Textures.Frame][] = [];
    for (const particle of emitter.alive) {
      if (particle.tint === WHITE && !emitter.tintFill) continue;
      swapped.push([particle, particle.frame]);
      particle.frame = cachedTintFrame(particle.frame, quantiseTint(particle.tint), emitter.tintFill);
    }
    renderEmitter.call(this, renderer, emitter, camera, parent);
    for (const [particle, frame] of swapped) particle.frame = frame;
  };
}

// ---------------------------------------------------------------------------
// Graphics

// Phaser's own command ids (gameobjects/graphics/Commands.js, not exported).
const CMD = {
  ARC: 0,
  BEGIN_PATH: 1,
  CLOSE_PATH: 2,
  FILL_RECT: 3,
  LINE_TO: 4,
  MOVE_TO: 5,
  LINE_STYLE: 6,
  FILL_STYLE: 7,
  FILL_PATH: 8,
  STROKE_PATH: 9,
  FILL_TRIANGLE: 10,
  STROKE_TRIANGLE: 11,
  SAVE: 14,
  RESTORE: 15,
  TRANSLATE: 16,
  SCALE: 17,
  ROTATE: 18,
  GRADIENT_FILL_STYLE: 21,
  GRADIENT_LINE_STYLE: 22,
} as const;

// One corner of a gradient: colour channels 0-255 and alpha 0-1, the way
// WebGL holds a vertex's tint.
type Rgba = [number, number, number, number];

interface GraphicsLike {
  commandBuffer: number[];
}

// Phaser's Canvas Graphics renderer, command for command, with the gradient
// fill read in full and honoured. A gradient colours rects and triangles, as
// in WebGL; a path filled under a gradient takes its top-left corner, since
// WebGL's own colouring of one depends on how the triangulator happened to
// cut it and the game never fills a path under a gradient.
function renderGraphicsCanvas(
  this: unknown,
  renderer: Phaser.Renderer.Canvas.CanvasRenderer,
  src: Phaser.GameObjects.Graphics,
  camera: Phaser.Cameras.Scene2D.Camera,
  parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  renderTargetCtx?: CanvasRenderingContext2D,
  allowClip?: boolean
) {
  const commands = (src as unknown as GraphicsLike).commandBuffer;
  const length = commands.length;
  const ctx = renderTargetCtx || renderer.currentContext;
  const setTransform = Phaser.Renderer.Canvas.SetTransform as unknown as (
    renderer: unknown,
    ctx: CanvasRenderingContext2D,
    src: unknown,
    camera: unknown,
    parentMatrix: unknown
  ) => boolean;
  if (length === 0 || !setTransform(renderer, ctx, src, camera, parentMatrix)) return;
  camera.addToRenderList(src);

  // The four corners while a gradient is the fill style; null while a solid
  // colour is.
  let gradient: [Rgba, Rgba, Rgba, Rgba] | null = null;
  let fillAlpha = 1;
  let fillColor = -1;
  // Consecutive opaque triangles of one colour are gathered into a single
  // path and filled once, and the large ones are sealed (see the note on
  // seams below); `batching` says a batch is open.
  let batching = false;
  // One screen pixel in this object's own units, for the seal.
  const m = ctx.getTransform();
  const pixel = 1 / Math.sqrt(Math.abs(m.a * m.d - m.b * m.c) || 1);
  const sealArea = SEAL_MIN_AREA_PX * pixel * pixel;
  const flush = () => {
    if (!batching) return;
    ctx.fill();
    batching = false;
  };
  ctx.beginPath();

  for (let i = 0; i < length; i++) {
    const command = commands[i];
    // Setting the colour already in use leaves a batch open: a run of tiles
    // each setting the same ground colour is one fill, seams and all sealed.
    if (batching && command !== CMD.FILL_TRIANGLE && !(command === CMD.FILL_STYLE && sameFill(commands, i, fillColor, fillAlpha))) flush();
    switch (command) {
      case CMD.ARC:
        ctx.arc(commands[i + 1], commands[i + 2], commands[i + 3], commands[i + 4], commands[i + 5], !!commands[i + 6]);
        // The seventh value is WebGL's overshoot, which Canvas has no use for.
        i += 7;
        break;
      case CMD.LINE_STYLE:
        ctx.strokeStyle = rgba(commands[i + 2], commands[i + 3]);
        ctx.lineWidth = commands[i + 1];
        i += 3;
        break;
      case CMD.FILL_STYLE:
        ctx.fillStyle = rgba(commands[i + 1], commands[i + 2]);
        fillColor = commands[i + 1];
        fillAlpha = commands[i + 2];
        gradient = null;
        i += 2;
        break;
      case CMD.GRADIENT_FILL_STYLE: {
        const corner = (k: number): Rgba => {
          const c = commands[i + 5 + k];
          return [(c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff, commands[i + 1 + k]];
        };
        // Top-left, top-right, bottom-left, bottom-right: alphas first, then
        // colours, as Graphics.fillGradientStyle pushes them.
        gradient = [corner(0), corner(1), corner(2), corner(3)];
        ctx.fillStyle = cssRgba(gradient[0]);
        i += 8;
        break;
      }
      case CMD.GRADIENT_LINE_STYLE:
        // WebGL only, and unused here; its six values are stepped over.
        i += 6;
        break;
      case CMD.BEGIN_PATH:
        ctx.beginPath();
        break;
      case CMD.CLOSE_PATH:
        ctx.closePath();
        break;
      case CMD.FILL_PATH:
        if (!allowClip) ctx.fill();
        break;
      case CMD.STROKE_PATH:
        if (!allowClip) ctx.stroke();
        break;
      case CMD.FILL_RECT: {
        const x = commands[i + 1];
        const y = commands[i + 2];
        const w = commands[i + 3];
        const h = commands[i + 4];
        if (allowClip) ctx.rect(x, y, w, h);
        else if (gradient) fillGradientRect(ctx, x, y, w, h, gradient);
        else ctx.fillRect(x, y, w, h);
        i += 4;
        break;
      }
      case CMD.FILL_TRIANGLE: {
        const x0 = commands[i + 1];
        const y0 = commands[i + 2];
        const x1 = commands[i + 3];
        const y1 = commands[i + 4];
        const x2 = commands[i + 5];
        const y2 = commands[i + 6];
        if (gradient && !allowClip) {
          // WebGL's triangle takes the top-left, top-right and bottom-left
          // corner colours at its first, second and third point.
          fillAffineTriangle(ctx, x0, y0, x1, y1, x2, y2, gradient[0], gradient[1], gradient[2]);
        } else if (!allowClip && fillAlpha >= 1 && ctx.globalAlpha >= 1 && ctx.globalCompositeOperation === 'source-over') {
          // Sealing seams: every triangle wound the same way, so where two
          // overlap the nonzero rule keeps both rather than cutting a hole.
          if (!batching) {
            ctx.beginPath();
            batching = true;
          }
          const cross = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
          const t = Math.abs(cross) / 2 >= sealArea ? grown(x0, y0, x1, y1, x2, y2, pixel * SEAL_GROW_PX) : [x0, y0, x1, y1, x2, y2];
          ctx.moveTo(t[0], t[1]);
          if (cross >= 0) {
            ctx.lineTo(t[2], t[3]);
            ctx.lineTo(t[4], t[5]);
          } else {
            ctx.lineTo(t[4], t[5]);
            ctx.lineTo(t[2], t[3]);
          }
          ctx.closePath();
        } else {
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.closePath();
          if (!allowClip) ctx.fill();
        }
        i += 6;
        break;
      }
      case CMD.STROKE_TRIANGLE:
        ctx.beginPath();
        ctx.moveTo(commands[i + 1], commands[i + 2]);
        ctx.lineTo(commands[i + 3], commands[i + 4]);
        ctx.lineTo(commands[i + 5], commands[i + 6]);
        ctx.closePath();
        if (!allowClip) ctx.stroke();
        i += 6;
        break;
      case CMD.LINE_TO:
        ctx.lineTo(commands[i + 1], commands[i + 2]);
        i += 2;
        break;
      case CMD.MOVE_TO:
        ctx.moveTo(commands[i + 1], commands[i + 2]);
        i += 2;
        break;
      case CMD.SAVE:
        ctx.save();
        break;
      case CMD.RESTORE:
        ctx.restore();
        break;
      case CMD.TRANSLATE:
        ctx.translate(commands[i + 1], commands[i + 2]);
        i += 2;
        break;
      case CMD.SCALE:
        ctx.scale(commands[i + 1], commands[i + 2]);
        i += 2;
        break;
      case CMD.ROTATE:
        ctx.rotate(commands[i + 1]);
        i += 1;
        break;
    }
  }

  flush();
  // Restores the context SetTransform saved.
  ctx.restore();
}

// Seams. Canvas antialiases every fill on its own, so where two shapes share
// an edge each covers the pixels along it only partly and whatever lies
// behind shows through as a hairline -- every projected tile is two triangles
// (art/shapes.ts's fillPolygon), so a floor filled one triangle at a time is
// laced with a grid WebGL's multisampling never shows. Two things close it:
// - Consecutive opaque triangles of one colour are filled as one path, so
//   along an edge they share the coverage is the union's. A run of tiles that
//   all set the same ground colour is a single fill.
// - Where the colour changes from one tile to the next (a row further into
//   the fog, a region tint) the fills cannot be one path, so every large
//   triangle is grown outward by half a screen pixel before it is filled:
//   its edge pixels come out fully covered, and whatever is painted next
//   overlaps it rather than leaving a gap. Growing the outline costs nothing
//   at raster time, where a stroke round every edge doubled the frame.
//   Triangles under SEAL_MIN_AREA_PX are left exactly as drawn, since half a
//   pixel added round a small detail would visibly fatten it.
// Only an opaque, normally blended fill is gathered: for those, filling the
// union is the same picture as filling the pieces in turn, and anything
// translucent or blended stays one fill per shape exactly as drawn.

function sameFill(commands: number[], i: number, color: number, alpha: number): boolean {
  return commands[i + 1] === color && commands[i + 2] === alpha;
}

// Screen area, in square pixels, from which an opaque triangle is sealed,
// and how far out, in screen pixels, its edges are moved.
const SEAL_MIN_AREA_PX = 40;
const SEAL_GROW_PX = 0.5;

// The triangle with every edge moved `d` outward: each corner slides along
// its bisector by d / sin(half its angle), capped for a needle-thin corner so
// it cannot throw a spike.
function grown(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, d: number): number[] {
  const corner = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): [number, number] => {
    const ub = Math.hypot(bx - ax, by - ay) || 1;
    const uc = Math.hypot(cx - ax, cy - ay) || 1;
    const ux = (bx - ax) / ub;
    const uy = (by - ay) / ub;
    const vx = (cx - ax) / uc;
    const vy = (cy - ay) / uc;
    const bis = Math.hypot(ux + vx, uy + vy) || 1;
    const halfSin = Math.sqrt(Math.max(0, (1 - (ux * vx + uy * vy)) / 2));
    const reach = Math.min(d / Math.max(halfSin, 1e-6), d * 3);
    return [ax - ((ux + vx) / bis) * reach, ay - ((uy + vy) / bis) * reach];
  };
  const a = corner(x0, y0, x1, y1, x2, y2);
  const b = corner(x1, y1, x2, y2, x0, y0);
  const c = corner(x2, y2, x0, y0, x1, y1);
  return [a[0], a[1], b[0], b[1], c[0], c[1]];
}

// A gradient rect as WebGL draws it: two triangles cut along the top-left to
// bottom-right diagonal (top-left, bottom-left, bottom-right, then top-left,
// bottom-right, top-right), each coloured by linear interpolation between its
// corners. Where the corners only vary top to bottom or left to right -- every
// sky, wash and band in the game -- that is one linear gradient over the
// whole rect, drawn as one fill so no seam runs down the diagonal.
function fillGradientRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: [Rgba, Rgba, Rgba, Rgba]) {
  const [tl, tr, bl, br] = c;
  if (sameRgba(tl, tr) && sameRgba(bl, br)) {
    ctx.fillStyle = linearGradient(ctx, x, y, x, y + h, tl, bl);
    ctx.fillRect(x, y, w, h);
    return;
  }
  if (sameRgba(tl, bl) && sameRgba(tr, br)) {
    ctx.fillStyle = linearGradient(ctx, x, y, x + w, y, tl, tr);
    ctx.fillRect(x, y, w, h);
    return;
  }
  fillAffineTriangle(ctx, x, y, x, y + h, x + w, y + h, tl, bl, br);
  fillAffineTriangle(ctx, x, y, x + w, y + h, x + w, y, tl, br, tr);
}

// A triangle whose colour is interpolated linearly between its three
// corners, as a WebGL triangle's is. A linear field over a triangle changes
// along one direction wherever one channel is doing the changing -- every
// gradient triangle the game draws varies its alpha alone -- and a Canvas
// linear gradient along that direction reproduces it exactly. Were colour and
// alpha ever to vary along different directions, the gradient follows the
// strongest of them.
function fillAffineTriangle(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  c0: Rgba,
  c1: Rgba,
  c2: Rgba
) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();

  const e1x = x1 - x0;
  const e1y = y1 - y0;
  const e2x = x2 - x0;
  const e2y = y2 - y0;
  const det = e1x * e2y - e1y * e2x;
  if (Math.abs(det) < 1e-9) return;

  // The strongest channel's gradient, colours measured on alpha's 0-1 scale.
  let gx = 0;
  let gy = 0;
  let best = 0;
  for (let k = 0; k < 4; k++) {
    const scale = k === 3 ? 1 : 1 / 255;
    const d1 = (c1[k] - c0[k]) * scale;
    const d2 = (c2[k] - c0[k]) * scale;
    const kx = (d1 * e2y - d2 * e1y) / det;
    const ky = (e1x * d2 - e2x * d1) / det;
    const m = kx * kx + ky * ky;
    if (m > best) {
      best = m;
      gx = kx;
      gy = ky;
    }
  }
  if (best === 0) {
    ctx.fillStyle = cssRgba(c0);
    ctx.fill();
    return;
  }
  const len = Math.sqrt(best);
  const dx = gx / len;
  const dy = gy / len;
  const s1 = e1x * dx + e1y * dy;
  const s2 = e2x * dx + e2y * dy;
  const sMin = Math.min(0, s1, s2);
  const sMax = Math.max(0, s1, s2);
  // The field evaluated where the gradient line starts and ends, through the
  // triangle's own barycentric weights (extended past its edges if needed).
  const at = (s: number): Rgba => {
    const px = dx * s;
    const py = dy * s;
    const b1 = (px * e2y - py * e2x) / det;
    const b2 = (e1x * py - e1y * px) / det;
    const b0 = 1 - b1 - b2;
    return [0, 1, 2, 3].map((k) => b0 * c0[k] + b1 * c1[k] + b2 * c2[k]) as Rgba;
  };
  ctx.fillStyle = linearGradient(ctx, x0 + dx * sMin, y0 + dy * sMin, x0 + dx * sMax, y0 + dy * sMax, at(sMin), at(sMax));
  ctx.fill();
}

// A Canvas linear gradient from `a` to `b`. WebGL interpolates a vertex's
// colour and its alpha separately and multiplies them afterwards; Canvas
// interpolates colour already multiplied by alpha. The two agree whenever
// only one of them changes, and where both do, stops every quarter of the way
// hold Canvas to WebGL's curve.
function linearGradient(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, a: Rgba, b: Rgba): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  const colourMoves = a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2];
  const steps = colourMoves && a[3] !== b[3] ? 4 : 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    g.addColorStop(t, cssRgba([0, 1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * t) as Rgba));
  }
  return g;
}

function sameRgba(a: Rgba, b: Rgba): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function cssRgba(c: Rgba): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3]})`;
}

function rgba(color: number, alpha: number): string {
  return `rgba(${(color >>> 16) & 0xff},${(color >>> 8) & 0xff},${color & 0xff},${alpha})`;
}

// ---------------------------------------------------------------------------
// Tints

const WHITE = 0xffffff;

interface TintedObject {
  isTinted?: boolean;
  tintTopLeft?: number;
  tintFill?: boolean;
}

interface TintedParticle {
  tint: number;
  frame: Phaser.Textures.Frame;
}

interface TintedEmitter {
  alive: TintedParticle[];
  tintFill: boolean;
}

// The frame a sprite is drawn from: its own, or a stand-in reading the same
// region out of a tinted copy of the texture. Only the top-left tint is
// honoured; the game tints whole objects, never one corner. A tile sprite's
// canvas is repainted as its pattern scrolls, so its copy is tinted afresh on
// every draw instead of being cached.
function spriteFrame(sprite: TintedObject, frame: Phaser.Textures.Frame): Phaser.Textures.Frame {
  if (!sprite.isTinted) return frame;
  const tint = sprite.tintTopLeft ?? WHITE;
  const fill = !!sprite.tintFill;
  if (sprite instanceof Phaser.GameObjects.TileSprite || sprite instanceof Phaser.GameObjects.Text) {
    let canvas = liveTints.get(sprite);
    if (!canvas) {
      canvas = document.createElement('canvas');
      liveTints.set(sprite, canvas);
    }
    paintTint(canvas, frame.source.image as CanvasImageSource, frame.source.width, frame.source.height, tint, fill);
    return standIn(frame, canvas);
  }
  return cachedTintFrame(frame, tint, fill);
}

const liveTints = new WeakMap<object, HTMLCanvasElement>();

// Tinted copies of whole texture sources, least recently used first out,
// kept under a pixel budget so a long run of particle colours cannot grow it
// without bound. A copy covers the whole source, so every frame and crop in
// it keeps its own coordinates.
const TINT_CACHE_PIXELS = 6_000_000;
interface TintEntry {
  canvas: HTMLCanvasElement;
  pixels: number;
  standIns: Map<Phaser.Textures.Frame, Phaser.Textures.Frame>;
}
const tintCache = new Map<string, TintEntry>();
let tintCachePixels = 0;
const sourceIds = new WeakMap<object, number>();
let nextSourceId = 1;

function cachedTintFrame(frame: Phaser.Textures.Frame, tint: number, fill: boolean): Phaser.Textures.Frame {
  const source = frame.source;
  let id = sourceIds.get(source);
  if (id === undefined) {
    id = nextSourceId++;
    sourceIds.set(source, id);
  }
  const key = `${id}:${tint}:${fill ? 1 : 0}`;
  let entry = tintCache.get(key);
  if (entry) {
    tintCache.delete(key);
    tintCache.set(key, entry);
  } else {
    const canvas = document.createElement('canvas');
    paintTint(canvas, source.image as CanvasImageSource, source.width, source.height, tint, fill);
    entry = { canvas, pixels: source.width * source.height, standIns: new Map() };
    tintCache.set(key, entry);
    tintCachePixels += entry.pixels;
    for (const [oldKey, old] of tintCache) {
      if (tintCachePixels <= TINT_CACHE_PIXELS || old === entry) break;
      tintCache.delete(oldKey);
      tintCachePixels -= old.pixels;
    }
  }
  let stand = entry.standIns.get(frame);
  if (!stand) {
    stand = standIn(frame, entry.canvas);
    entry.standIns.set(frame, stand);
  }
  return stand;
}

// The frame itself in every respect but the image its source hands over.
function standIn(frame: Phaser.Textures.Frame, image: HTMLCanvasElement): Phaser.Textures.Frame {
  const source = Object.create(frame.source, { image: { value: image } });
  return Object.create(frame, { source: { value: source } });
}

// WebGL's tint multiplies every texel's colour by the tint and leaves its
// alpha alone; a fill tint replaces the colour outright. Multiply is laid over
// the texture and its own alpha is then cut back in -- exact for the white,
// alpha-shaped textures the effects use, and for any opaque texel.
function paintTint(canvas: HTMLCanvasElement, image: CanvasImageSource, w: number, h: number, tint: number, fill: boolean) {
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = fill ? 'source-in' : 'multiply';
  ctx.fillStyle = `#${tint.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, w, h);
  if (!fill) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(image, 0, 0);
  }
  ctx.globalCompositeOperation = 'source-over';
}

// A particle's tint ramps continuously over its life, so exact values would
// make every live particle a cache entry of its own. Rounded to 32 steps a
// channel (at most 4 of 255 off), a ramp settles into a few dozen copies.
function quantiseTint(tint: number): number {
  const q = (v: number) => Math.min(255, Math.round(v / 8) * 8);
  return (q((tint >>> 16) & 0xff) << 16) | (q((tint >>> 8) & 0xff) << 8) | q(tint & 0xff);
}
