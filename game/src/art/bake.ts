import Phaser from 'phaser';

// Static vector art flattened into one texture. Phaser re-tessellates every
// Graphics object's whole command list on every frame it renders, painted
// once or not, so a backdrop built from tens of thousands of fills is paid
// for in full sixty times a second -- on the CPU as triangulation, and on a
// machine without a GPU as every one of its stacked translucent layers being
// filled again in software. Baked, the same picture costs one textured quad.
//
// The layers are rendered, in display-list order, into a DynamicTexture by
// the same WebGL renderer that would have drawn them to the screen, so every
// fill, gradient and blend comes out exactly as it would have; the one thing
// an offscreen texture lacks is the canvas's multisampling, so the layers are
// painted at BAKE_SUPERSAMPLE times the texture's size and averaged back down
// to it, which gives each texel a grid of samples the way the canvas's own
// antialiasing does (a bake too large for that is painted direct, see
// supersampleFor). Under the Canvas renderer the 2D
// context antialiases analytically and the layers are painted at 1:1.
//
// The source layers stay on the display list, hidden, holding their slot: a
// hidden object costs nothing to render, and they are what the texture is
// painted from again when a lost WebGL context comes back (a DynamicTexture
// lives only on the GPU, so the context takes its pixels with it -- see
// scripts/component-check.mjs's context-loss test). The texture lives exactly
// as long as the image showing it: whatever destroys the image (the scene's
// shutdown, or the container it shares with the layers) destroys the layers
// with it and frees the texture, so no scene holds GPU memory, or a texture
// nothing is left to repaint, while it is not running.
//
// A bake is exact at the scale it was painted for. A camera that zooms out on
// one (the battle's Ultimate pull-back, to 0.72) resamples it with linear
// filtering: its finest lines come out a little softer than vectors drawn at
// the smaller size would be, about 8% less fine detail at 0.72, and hold
// steady through the zoom rather than crawling. A texture close to the size
// it is drawn at is what makes that true -- one kept at twice that size and
// shrunk on every frame would skip texels at that zoom and its hairlines
// would shimmer. That is also why a bake follows the display scale rather
// than always being painted at the largest one (texelsPerGamePixel).
//
// Twice the region's size: at 1:1 the offscreen texture's edges stair-step
// visibly against the canvas's multisampled ones, and at 2x a pixel diff
// against the live layers is down to sub-pixel sample positions on thin lines.
export const BAKE_SUPERSAMPLE = 2;

// The most texels a bake may hold per pixel it is drawn over: linear
// filtering reads every texel down to two per pixel and skips some past that.
const BAKE_MAX_TEXELS_PER_PIXEL = 2;

// How many pixels the frame is drawn with per game pixel
// (art/displayScale.ts); 1 wherever it is drawn at the canvas's own size. A
// bake standing when the scale changes (a window resized or sent fullscreen
// mid-scene) and needing a different number of texels for it is painted
// again, from the same hidden layers a restored context repaints it from.
let bakeDisplayScale = 1;
const standing = new Set<() => void>();
export function setBakeOutputScale(displayScale: number) {
  if (displayScale === bakeDisplayScale) return;
  bakeDisplayScale = displayScale;
  for (const rebake of [...standing]) rebake();
}

// How many texels per game pixel a bake keeps at the display scale in force:
// that scale rounded up to a whole number, so the texture has at least one
// texel for each pixel drawn. A bake a camera zooms out on (`deepestZoom`
// under 1) is the exception where rounding up would pass
// BAKE_MAX_TEXELS_PER_PIXEL at that zoom, a window a little larger than a
// whole multiple of the canvas: there the scale is rounded down, and the bake
// is shown enlarged by that little at rest rather than shimmering when the
// camera pulls back. A bake always shown at its own size never rounds down.
function texelsPerGamePixel(deepestZoom: number): number {
  const up = Math.max(1, Math.ceil(bakeDisplayScale - 1e-6));
  if (up <= bakeDisplayScale * deepestZoom * BAKE_MAX_TEXELS_PER_PIXEL) return up;
  return Math.max(1, Math.floor(bakeDisplayScale));
}

export interface BakeRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Bakes `layers` (in the order given, which should be their display-list
// order) into a new texture `key` over `region`, and returns the image that
// shows it, placed where the first layer was -- in the scene's display list, or in the
// container holding the layers, whose coordinates `region` is then in. A key
// names one bake site: baking it again replaces the texture. `deepestZoom`
// is the furthest any camera zooms out on the image (1 for a bake always
// shown at its own size), which bounds how large its texture may be.
//
// Every layer must blend normally. Normal blending is associative, which is
// what makes a stack flattened on its own and then laid over the frame come
// out the same as the stack drawn over the frame layer by layer; an additive
// layer baked over the texture's transparency would have nothing to add to.
// For the same reason nothing may fade the image afterwards: Phaser applies a
// container's alpha to each fill of a Graphics on its own, so where two fills
// overlap, fading their flattened result is not the same picture. A layer's
// own alpha is baked in, fill by fill, and is fine -- a translucent container
// passed as a layer included, since the bake draws it the way the screen does,
// its alpha reaching each child's fills one at a time.
export function bakeLayers(
  scene: Phaser.Scene,
  key: string,
  layers: Phaser.GameObjects.GameObject[],
  region: BakeRegion,
  deepestZoom = 1
): Phaser.GameObjects.Image {
  const renderer = scene.sys.game.renderer;
  const webgl = renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer;
  const drawn = layers.filter((o) => (o as Phaser.GameObjects.Graphics).visible !== false) as Phaser.GameObjects.Graphics[];
  if (import.meta.env.DEV && !drawn.every(blendsNormally)) {
    throw new Error(`bake ${key}: a layer with a non-normal blend mode cannot be flattened`);
  }
  const first = drawn[0];
  const parent = first?.parentContainer;
  if (import.meta.env.DEV) {
    for (let p = parent; p; p = p.parentContainer) {
      if (p.alpha < 1) throw new Error(`bake ${key}: a translucent container fades each fill separately, so its layers cannot be flattened`);
    }
  }

  // The image goes down on a whole screen pixel, so each texel lands on one
  // pixel exactly. Where the region starts part-way into a pixel (a
  // container placed at x.5), that fraction is painted into the texture
  // instead: the art ends up where it was, and nothing is resampled between
  // texels, which would soften every edge by half a pixel. This holds for as
  // long as the parents move by whole pixels only.
  let screenX = region.x;
  let screenY = region.y;
  for (let p = parent; p; p = p.parentContainer) {
    screenX += p.x;
    screenY += p.y;
  }
  const fx = screenX - Math.floor(screenX);
  const fy = screenY - Math.floor(screenY);
  // Even on both sides, always. Phaser rounds an odd DynamicTexture up to the
  // next even size but keeps drawing into it as if it were the odd one, which
  // stretches everything painted by a column over the texture's width.
  const w = evenCeil(region.w + fx);
  const h = evenCeil(region.h + fy);
  const textures = scene.textures;
  let out = 1;
  let supersample = 1;
  let target!: Phaser.Textures.DynamicTexture;

  const drawLayers = (into: Phaser.Textures.DynamicTexture, scale: number) => {
    into.beginDraw();
    for (const layer of drawn) {
      const { x, y, scaleX, scaleY } = layer;
      layer.setScale(scaleX * scale, scaleY * scale);
      into.batchDraw(layer, (x - region.x + fx) * scale, (y - region.y + fy) * scale);
      layer.setScale(scaleX, scaleY);
    }
    into.endDraw();
  };
  const paint = () => {
    target.clear();
    if (supersample === 1) {
      drawLayers(target, out);
      return;
    }
    // Painted large on a scratch texture, then stamped down at exactly
    // 1/supersample: linear filtering at that ratio averages each block of
    // samples into one texel, which is the downsample done once here rather
    // than by every frame sampling a texture four times the size it shows.
    const scratchKey = `${key}-supersampled`;
    if (textures.exists(scratchKey)) textures.remove(scratchKey);
    const scratch = textures.addDynamicTexture(scratchKey, w * out * supersample, h * out * supersample);
    if (!scratch) throw new Error(`bake texture ${scratchKey} could not be created`);
    drawLayers(scratch, out * supersample);
    target.stamp(scratchKey, undefined, 0, 0, { originX: 0, originY: 0, scale: 1 / supersample });
    textures.remove(scratchKey);
  };
  // The texture at the scale now in force, painted.
  const build = () => {
    out = webgl ? texelsPerGamePixel(deepestZoom) : 1;
    supersample = webgl ? supersampleFor(renderer, w * out, h * out) : 1;
    if (textures.exists(key)) textures.remove(key);
    const created = textures.addDynamicTexture(key, w * out, h * out);
    if (!created) throw new Error(`bake texture ${key} could not be created`);
    target = created;
    paint();
  };
  build();
  for (const layer of drawn) layer.setVisible(false);

  const image = scene.add
    .image(region.x - fx, region.y - fy, key)
    .setOrigin(0, 0)
    .setScale(1 / out)
    .setDepth(first?.depth ?? 0);
  if (parent) parent.addAt(image, parent.getIndex(first));
  else if (first) scene.children.moveTo(image, scene.children.getIndex(first));

  const restore = () => paint();
  // Only while this bake still owns its key: a later bake of the same key
  // has replaced the texture, and this image is about to go.
  const rebake = () => {
    if (!textures.exists(key) || textures.get(key) !== target) return;
    if (!webgl || texelsPerGamePixel(deepestZoom) === out) return;
    build();
    image.setTexture(key).setScale(1 / out);
  };
  if (webgl) renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, restore);
  standing.add(rebake);
  image.once(Phaser.GameObjects.Events.DESTROY, () => {
    if (webgl) renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, restore);
    standing.delete(rebake);
    // Only this bake's own texture: a later bake of the same key may already
    // have replaced it by the time this image goes.
    if (textures.exists(key) && textures.get(key) === target) textures.remove(key);
  });
  return image;
}

// A container carries no blend mode of its own unless one is set on it
// (Phaser's SKIP_CHECK): each child draws with its own, so what has to blend
// normally is everything inside it.
function blendsNormally(o: Phaser.GameObjects.GameObject): boolean {
  const layer = o as Phaser.GameObjects.Graphics;
  if (o instanceof Phaser.GameObjects.Container && o.blendMode === Phaser.BlendModes.SKIP_CHECK) {
    return o.list.every(blendsNormally);
  }
  return layer.blendMode === Phaser.BlendModes.NORMAL;
}

function evenCeil(v: number): number {
  const n = Math.ceil(v);
  return n % 2 === 0 ? n : n + 1;
}

// The most texels a bake's scratch texture may hold: 4096 by 4096, 64 MB.
// The scratch lives for one paint, but it is allocated and filled inside the
// frame a scene starts on, and that frame stalls for as long as it takes: on
// an integrated GPU a battle whose arena is supersampled at three texels per
// game pixel (a 7404x4200 scratch) starts about 150 ms later than one that is
// not, for 124 MB of GPU memory asked for at once.
const SCRATCH_TEXEL_BUDGET = 4096 * 4096;
let scratchTexelBudget = SCRATCH_TEXEL_BUDGET;

// For a scale pinned from the URL (art/displayScale.ts), which is how the
// capture scripts render stills at up to four times the canvas: a capture
// waits for its frame however long it takes, and its edges are the ones
// looked at enlarged, so every bake there is supersampled as far as the GPU's
// own texture limit allows.
export function liftScratchTexelBudget() {
  scratchTexelBudget = Infinity;
}

// The largest supersample up to BAKE_SUPERSAMPLE whose scratch texture this
// GPU can hold and the scratch budget allows, for a bake of `w` by `h`
// texels. The arena supersampled at two texels per game pixel fits both;
// at three it does not and is painted straight into its texture, where the
// stair-steps an unsupersampled edge has are a third of a game pixel tall
// and the frame shows them at one pixel or less. A GPU with a small texture
// limit degrades the same way, to a slightly rougher bake rather than to a
// missing backdrop.
function supersampleFor(renderer: Phaser.Renderer.WebGL.WebGLRenderer, w: number, h: number): number {
  const max = renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE) as number;
  let s = BAKE_SUPERSAMPLE;
  while (s > 1 && (w * s > max || h * s > max || w * s * h * s > scratchTexelBudget)) s--;
  return s;
}
