import Phaser from 'phaser';

// Every Text object is drawn with its top-left corner on a whole pixel. A Text
// is a canvas texture with one texel per game pixel, so drawn anywhere else it
// is resampled and every glyph smears across two pixel columns or rows. The
// usual way a Text lands off the grid is being centred: `setOrigin(0.5, ...)`
// puts its left edge at `x - width / 2`, half a pixel off for any label an odd
// number of pixels wide, and a panel that stacks its content at
// `y += element.height` carries any fractional height into everything below
// it.
//
// Two parts, one per renderer, both render-only -- a Text keeps its own
// `x`/`y`, so layout, tweens and hit areas are untouched:
//
// - WebGL: the draw runs with the camera's `renderRoundPixels` set, the flag
//   Phaser's own roundPixels mode uses to snap a quad's top-left corner to the
//   nearest pixel and shift the other three corners with it, so the text keeps
//   its exact size. Only for a whole-number zoom, as Phaser itself does: under
//   the battle's pulled-back arena camera the text is scaled anyway, and
//   snapping each run on its own would jitter the runs of one line against
//   each other through the zoom.
// - Canvas: the same flag snaps only the drawn translation, not the origin
//   offset the image is drawn at from it, so the display origin is a whole
//   number as well. That shifts a centred odd-width label by half a pixel,
//   which nothing can see.
//
// Phaser's `roundPixels` game setting is not used: it snaps every textured
// object -- the baked crystal art, particles, every other sprite -- so all of
// it would move in whole-pixel steps, and in the Canvas renderer it widens
// every drawn image by half a pixel, a resample of exactly the kind this
// exists to prevent. A Text that moves does step in whole pixels; for a
// label that is the price of its glyphs staying sharp while it moves.
type TextRender = (
  renderer: unknown,
  src: Phaser.GameObjects.Text,
  camera: Phaser.Cameras.Scene2D.Camera,
  parentMatrix?: unknown
) => void;

export function installCrispText(): void {
  const proto = Phaser.GameObjects.Text.prototype as unknown as {
    renderWebGL: TextRender;
    renderCanvas: TextRender;
    updateDisplayOrigin: (this: TextOrigin) => TextOrigin;
  };

  proto.updateDisplayOrigin = function () {
    this._displayOriginX = Math.round(this.originX * this.width);
    this._displayOriginY = Math.round(this.originY * this.height);
    return this;
  };

  const snapped = (render: TextRender): TextRender =>
    function (this: unknown, renderer, src, camera, parentMatrix) {
      const cam = camera as Phaser.Cameras.Scene2D.Camera & { renderRoundPixels: boolean };
      const previous = cam.renderRoundPixels;
      cam.renderRoundPixels = Number.isInteger(cam.zoomX) && Number.isInteger(cam.zoomY);
      render.call(this, renderer, src, camera, parentMatrix);
      cam.renderRoundPixels = previous;
    };
  proto.renderWebGL = snapped(proto.renderWebGL);
  proto.renderCanvas = snapped(proto.renderCanvas);
}

interface TextOrigin {
  originX: number;
  originY: number;
  width: number;
  height: number;
  _displayOriginX: number;
  _displayOriginY: number;
}
