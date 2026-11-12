import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from '../config/screen';
import { liftScratchTexelBudget, setBakeOutputScale } from './bake';

// The game is laid out on a CANVAS_W x CANVAS_H canvas and Phaser's scale
// manager stretches that canvas over the window. Left there, every monitor
// larger than the canvas shows an 854x480 picture interpolated up to its own
// size: on a 1080p screen each glyph and each edge is spread over a little
// more than two pixels. Nothing in the game is a stored image, though -- the
// art is vector fills and the text is rasterized from a font -- so the same
// frame can be drawn with as many pixels as the screen has.
//
// The display scale is how many drawn pixels one game pixel gets. Layout,
// input, cameras and every coordinate in the game stay in game pixels; four
// things are scaled underneath them:
//
// - The canvas's drawing buffer is the scale times its logical size, while
//   its CSS size stays whatever the scale manager gave it.
// - The WebGL viewport and scissor are multiplied by the scale while the
//   screen is the bound target. Phaser's projection maps game pixels onto
//   clip space, so a viewport covering the larger buffer is all it takes for
//   every fill to be rasterized at the buffer's resolution. An offscreen
//   framebuffer (a bake, a mask) is drawn at its own size, untouched.
// - Every Text is rasterized at the scale rounded up to a whole number (its
//   `resolution`), so a glyph has at least one texel per drawn pixel rather
//   than one per game pixel. Rounded up because the scale is rarely whole (a
//   1080p window comes to about 2.25) and a Text sits on a whole game pixel
//   (ui/crispText.ts), which is then part-way into a drawn one: a texture of
//   exactly the display's resolution would be resampled across that offset
//   and lose its thin strokes, where one with texels to spare is averaged
//   down and keeps them. Measured on a 1080p window, text drawn that way is
//   as sharp as the whole frame drawn at 3x, at 56% of the pixels.
// - A bake keeps a whole number of texels per game pixel as well, the same
//   one except where a camera zooms out on it and that would leave it too
//   large for the zoom (art/bake.ts's texelsPerGamePixel).
//
// The particle textures of art/fxTextures.ts stay as painted: they are soft
// falloffs with no edge for a larger raster to sharpen.
//
// Which scale. With a real GPU the scale follows the display: the size the
// scale manager shows the canvas at, in device pixels, over the canvas's own
// size, so a window resize, a fullscreen toggle or a move to another monitor
// each settle on a new one. It is held between 1 and MAX_DISPLAY_SCALE. The
// Canvas renderer and a software WebGL (main.ts's chooseRenderer) stay at 1:
// both fill every pixel on the CPU, and the cost of a frame there grows with
// the pixel count. `?scale=N` in the URL pins a scale under WebGL whatever
// the hardware, which is how the capture scripts under scripts/ render above
// the canvas's size in a headless browser whose WebGL is a software one;
// `?scale=auto` follows the display on a software WebGL as well.
//
// A machine whose GPU cannot hold the frame rate at the display's scale is
// stepped down. When the frames of a few seconds average slower than
// SLOW_FRAME_MS, the scale is first tried at 1 for as long again. Frames that
// are quick there say the scale was the cost: the ceiling drops to the whole
// scale below the one that was slow and never climbs back in that session,
// so a slow machine ends at the scale it can draw rather than oscillating
// around the one it cannot. Frames that are as slow at 1 say it was not (a
// display refreshing at 30 Hz, a browser's energy saver holding the page to
// 30 frames a second, a CPU that is the limit): the scale goes back to the
// display's and is left alone for the session.
export const MAX_DISPLAY_SCALE = 3;

// Frames slower than this on average, over GOVERNOR_FRAMES frames, are slow.
// A frame longer than STALL_MS is a hidden tab, a scene being built or a
// bake being painted rather than the cost of drawing, and is left out.
const SLOW_FRAME_MS = 30;
const GOVERNOR_FRAMES = 150;
const STALL_MS = 250;
// How long the display's size has to hold still before the buffer follows
// it: a window being dragged larger reports a new size on every frame, and
// each change of scale reallocates the buffer and re-rasterizes every Text.
const SETTLE_MS = 200;

let scaleX = 1;
let scaleY = 1;
let textResolution = 1;
let hooked: WebGLRenderingContext | null = null;
let reapply: (() => void) | null = null;

// The scale in force, for anything that paints its own raster.
export function displayScale(): number {
  return scaleY;
}

// Before any Text exists: a Text reads its resolution in updateText, on
// creation and on every change, so that is where it is held to the display's.
export function installDisplayScale(): void {
  const proto = Phaser.GameObjects.Text.prototype as unknown as { updateText: (this: Phaser.GameObjects.Text) => Phaser.GameObjects.Text };
  const updateText = proto.updateText;
  proto.updateText = function () {
    if (this.style && this.style.resolution !== textResolution) this.style.resolution = textResolution;
    return updateText.call(this);
  };
}

export interface DisplayScaleOptions {
  // Follow the display's size. False on a software renderer, where the scale
  // stays 1 unless `pinned`.
  follow: boolean;
  // A fixed scale (`?scale=N`), followed by nothing.
  pinned?: number;
}

// Reads `?scale=` from the URL: a number pins that scale, `auto` follows the
// display even on a software WebGL, anything else leaves the choice to the
// hardware.
export function displayScaleFromUrl(softwareRenderer: boolean): DisplayScaleOptions {
  const asked = new URLSearchParams(window.location.search).get('scale');
  if (asked === 'auto') return { follow: true };
  const pinned = asked === null ? NaN : Number(asked);
  if (Number.isFinite(pinned) && pinned >= 1) return { follow: false, pinned };
  return { follow: !softwareRenderer };
}

// After the game exists. Does nothing under the Canvas renderer.
export function followDisplayScale(game: Phaser.Game, options: DisplayScaleOptions): void {
  const start = () => {
    const renderer = game.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
    hookContext(game.canvas, renderer.gl);
    if (options.pinned !== undefined) {
      liftScratchTexelBudget();
      applyBuffer(game, Math.round(CANVAS_W * options.pinned), Math.round(CANVAS_H * options.pinned));
      return;
    }
    if (!options.follow) return;

    let ceiling = MAX_DISPLAY_SCALE;
    // 'watch' while the display's scale is being timed, 'trial' while scale 1
    // is, 'off' once slow frames have turned out not to be the scale's doing.
    let governor: 'watch' | 'trial' | 'off' = 'watch';
    let slowAt = 1;
    let candidate = '';
    let candidateSince = 0;
    let frames = 0;
    let frameMs = 0;
    let last = 0;
    game.events.on(Phaser.Core.Events.PRE_RENDER, () => {
      const now = performance.now();
      const [w, h] = wantedBuffer(game, ceiling);
      const wanted = `${w}x${h}`;
      if (wanted !== candidate) {
        candidate = wanted;
        candidateSince = now;
      }
      const current = `${game.canvas.width}x${game.canvas.height}`;
      // The first change from the canvas's own size is taken at once, so the
      // game never opens on a stretched frame; later ones wait for the
      // display to hold still.
      if (candidate !== current && (scaleY === 1 || now - candidateSince >= SETTLE_MS)) {
        applyBuffer(game, w, h);
        frames = 0;
        frameMs = 0;
      }

      const dt = now - last;
      last = now;
      if (governor === 'off' || dt > STALL_MS) return;
      if (governor === 'watch' && scaleY <= 1) return;
      if (governor === 'trial' && scaleY > 1) return;
      frames += 1;
      frameMs += dt;
      if (frames < GOVERNOR_FRAMES) return;
      const slow = frameMs / frames > SLOW_FRAME_MS;
      frames = 0;
      frameMs = 0;
      if (governor === 'watch') {
        if (!slow) return;
        slowAt = wholeScale();
        ceiling = 1;
        governor = 'trial';
      } else if (slow) {
        ceiling = MAX_DISPLAY_SCALE;
        governor = 'off';
      } else {
        ceiling = Math.max(1, slowAt - 1);
        governor = 'watch';
      }
    });
  };
  if (game.isBooted) start();
  else game.events.once(Phaser.Core.Events.BOOT, start);
}

// The drawing buffer at which one drawn pixel is one device pixel: the size
// the scale manager shows the canvas at, in device pixels. Never smaller than
// the canvas's own size, and never more than `ceiling` times it.
function wantedBuffer(game: Phaser.Game, ceiling: number): [number, number] {
  const dpr = window.devicePixelRatio || 1;
  const shown = game.scale.displaySize;
  const w = Math.round(shown.width * dpr);
  const h = Math.round(shown.height * dpr);
  if (w <= CANVAS_W || h <= CANVAS_H) return [CANVAS_W, CANVAS_H];
  if (h > CANVAS_H * ceiling) return [CANVAS_W * ceiling, CANVAS_H * ceiling];
  return [w, h];
}

function applyBuffer(game: Phaser.Game, w: number, h: number): void {
  w = Math.max(CANVAS_W, w);
  h = Math.max(CANVAS_H, h);
  scaleX = w / CANVAS_W;
  scaleY = h / CANVAS_H;
  if (game.canvas.width !== w) game.canvas.width = w;
  if (game.canvas.height !== h) game.canvas.height = h;
  reapply?.();

  textResolution = wholeScale();
  for (const scene of game.scene.scenes) eachText(scene.children.list, (text) => text.setResolution(textResolution));
  setBakeOutputScale(scaleY);
}

// The scale rounded up to a whole number: what a Text and a bake are
// rasterized at.
function wholeScale(): number {
  return Math.max(1, Math.ceil(scaleY - 1e-6));
}

function eachText(list: Phaser.GameObjects.GameObject[], fn: (text: Phaser.GameObjects.Text) => void): void {
  for (const obj of list) {
    if (obj instanceof Phaser.GameObjects.Text) {
      if (obj.style.resolution !== textResolution) fn(obj);
    } else if (obj instanceof Phaser.GameObjects.Container) {
      eachText(obj.list, fn);
    }
  }
}

// Phaser sets a viewport before binding the target it is meant for as often
// as after (a texture stamp sets the source's size, then binds the
// destination), so whether a viewport is the screen's is only known when
// something is drawn. The viewport and scissor are therefore recorded as
// Phaser asks for them and applied at each draw: multiplied by the scale
// while the screen is the bound target, as asked otherwise.
function hookContext(canvas: HTMLCanvasElement, gl: WebGLRenderingContext): void {
  if (hooked === gl) return;
  hooked = gl;
  const ctx = gl as unknown as Record<string, (...a: number[]) => unknown>;
  const viewport = gl.viewport.bind(gl);
  const scissor = gl.scissor.bind(gl);
  let vp = Array.from(gl.getParameter(gl.VIEWPORT) as Int32Array);
  let sc = Array.from(gl.getParameter(gl.SCISSOR_BOX) as Int32Array);
  // Which scale the context's own viewport and scissor currently carry, as
  // "x,y" -- null when they have to be sent again.
  let applied: string | null = null;
  ctx.viewport = (...a: number[]) => {
    vp = a;
    applied = null;
  };
  ctx.scissor = (...a: number[]) => {
    sc = a;
    applied = null;
  };
  // A box in game pixels as the whole drawn pixels that cover it. At a
  // whole-number scale that is the box times the scale exactly.
  const box = (b: number[], kx: number, ky: number): [number, number, number, number] => {
    const x0 = Math.floor(b[0] * kx);
    const y0 = Math.floor(b[1] * ky);
    return [x0, y0, Math.ceil((b[0] + b[2]) * kx) - x0, Math.ceil((b[1] + b[3]) * ky) - y0];
  };
  const sync = () => {
    const screen = gl.getParameter(gl.FRAMEBUFFER_BINDING) === null;
    const kx = screen ? scaleX : 1;
    const ky = screen ? scaleY : 1;
    const key = `${kx},${ky}`;
    if (applied === key) return;
    viewport(...box(vp, kx, ky));
    scissor(...box(sc, kx, ky));
    applied = key;
  };
  for (const name of ['drawArrays', 'drawElements', 'clear', 'readPixels', 'copyTexImage2D', 'copyTexSubImage2D']) {
    const bound = ctx[name].bind(gl);
    ctx[name] = (...a: number[]) => {
      sync();
      return bound(...a);
    };
  }
  // Phaser flips a scissor box's y against the drawing buffer's height, which
  // it reads at boot and again whenever the renderer is resized; it has to
  // read the logical one every time, whatever the buffer has grown to.
  Object.defineProperty(gl, 'drawingBufferWidth', { get: () => CANVAS_W });
  Object.defineProperty(gl, 'drawingBufferHeight', { get: () => CANVAS_H });
  const bindFramebuffer = gl.bindFramebuffer.bind(gl);
  gl.bindFramebuffer = (target: number, framebuffer: WebGLFramebuffer | null) => {
    applied = null;
    bindFramebuffer(target, framebuffer);
  };
  // A restored context comes back with its own default viewport and scissor,
  // not the ones recorded as applied.
  canvas.addEventListener('webglcontextrestored', () => {
    applied = null;
  });
  reapply = () => {
    applied = null;
  };
}
