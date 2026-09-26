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
// painted at BAKE_SUPERSAMPLE times the region's size and averaged back down
// to one texel per screen pixel, which gives each pixel a grid of samples the
// way the canvas's own antialiasing does. Under the Canvas renderer the 2D
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
// steady through the zoom rather than crawling. One texel per screen pixel is
// what makes that true -- a texture kept at twice the size and shrunk on
// every frame would skip texels at that zoom and its hairlines would shimmer.
//
// Twice the region's size: at 1:1 the offscreen texture's edges stair-step
// visibly against the canvas's multisampled ones, and at 2x a pixel diff
// against the live layers is down to sub-pixel sample positions on thin lines.
export const BAKE_SUPERSAMPLE = 2;

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
// names one bake site: baking it again replaces the texture.
//
// Every layer must blend normally. Normal blending is associative, which is
// what makes a stack flattened on its own and then laid over the frame come
// out the same as the stack drawn over the frame layer by layer; an additive
// layer baked over the texture's transparency would have nothing to add to.
// For the same reason nothing may fade the image afterwards: Phaser applies a
// container's alpha to each fill of a Graphics on its own, so where two fills
// overlap, fading their flattened result is not the same picture. A layer's
// own alpha is baked in, fill by fill, and is fine.
export function bakeLayers(
  scene: Phaser.Scene,
  key: string,
  layers: Phaser.GameObjects.GameObject[],
  region: BakeRegion
): Phaser.GameObjects.Image {
  const renderer = scene.sys.game.renderer;
  const webgl = renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer;
  const drawn = layers.filter((o) => (o as Phaser.GameObjects.Graphics).visible !== false) as Phaser.GameObjects.Graphics[];
  if (import.meta.env.DEV && drawn.some((l) => l.blendMode !== Phaser.BlendModes.NORMAL)) {
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
  const supersample = webgl ? supersampleFor(renderer, w, h) : 1;

  const textures = scene.textures;
  if (textures.exists(key)) textures.remove(key);
  const created = textures.addDynamicTexture(key, w, h);
  if (!created) throw new Error(`bake texture ${key} could not be created`);
  const target = created;

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
      drawLayers(target, 1);
      return;
    }
    // Painted large on a scratch texture, then stamped down at exactly
    // 1/supersample: linear filtering at that ratio averages each block of
    // samples into one texel, which is the downsample done once here rather
    // than by every frame sampling a texture four times the size it shows.
    const scratchKey = `${key}-supersampled`;
    if (textures.exists(scratchKey)) textures.remove(scratchKey);
    const scratch = textures.addDynamicTexture(scratchKey, w * supersample, h * supersample);
    if (!scratch) throw new Error(`bake texture ${scratchKey} could not be created`);
    drawLayers(scratch, supersample);
    target.stamp(scratchKey, undefined, 0, 0, { originX: 0, originY: 0, scale: 1 / supersample });
    textures.remove(scratchKey);
  };
  paint();
  for (const layer of drawn) layer.setVisible(false);

  const image = scene.add
    .image(region.x - fx, region.y - fy, key)
    .setOrigin(0, 0)
    .setDepth(first?.depth ?? 0);
  if (parent) parent.addAt(image, parent.getIndex(first));
  else if (first) scene.children.moveTo(image, scene.children.getIndex(first));

  const restore = () => paint();
  if (webgl) renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, restore);
  image.once(Phaser.GameObjects.Events.DESTROY, () => {
    if (webgl) renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, restore);
    // Only this bake's own texture: a later bake of the same key may already
    // have replaced it by the time this image goes.
    if (textures.exists(key) && textures.get(key) === target) textures.remove(key);
  });
  return image;
}

function evenCeil(v: number): number {
  const n = Math.ceil(v);
  return n % 2 === 0 ? n : n + 1;
}

// The largest supersample up to BAKE_SUPERSAMPLE whose texture this GPU can
// hold. Every desktop and phone GPU in use takes 4096 or more, which a 2x
// arena fits inside; the fallback exists so a smaller limit degrades to a
// softer bake rather than to a missing backdrop.
function supersampleFor(renderer: Phaser.Renderer.WebGL.WebGLRenderer, w: number, h: number): number {
  const max = renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE) as number;
  let s = BAKE_SUPERSAMPLE;
  while (s > 1 && (w * s > max || h * s > max)) s--;
  return s;
}
